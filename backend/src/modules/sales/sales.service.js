import { Sale, SaleLine, SaleReversal, Unit, Customer, sequelize } from '../../../database/models/index.js';
import { transitionUnit } from '../units/units.service.js';
import { CHANNEL } from '../../constants/channel.js';

/**
 * Resolve a linked customer by uuid (if supplied).
 * @returns {Promise<{id: number, name: string, phone: string, email: string}|null>}
 */
async function resolveCustomer(customerUuid, transaction) {
    if (!customerUuid) {
        return null;
    }
    const customer = await Customer.findOne({
        where: { uuid: customerUuid, deletedAt: null },
        attributes: ['id', 'name', 'phone', 'email'],
        transaction,
    });
    if (!customer) {
        const error = new Error('Customer not found');
        error.statusCode = 404;
        throw error;
    }
    return customer;
}

/**
 * Generate the next sale number, e.g. S-0001
 * @returns {Promise<string>}
 */
async function nextSaleNumber(transaction) {
    const last = await Sale.findOne({
        order: [['id', 'DESC']],
        attributes: ['saleNumber'],
        paranoid: false,
        transaction,
    });
    const lastNum = last ? parseInt(last.saleNumber.replace(/\D/g, ''), 10) || 0 : 0;
    return `S-${String(lastNum + 1).padStart(4, '0')}`;
}

function mapSaleDTO(sale, lines = [], reversals = []) {
    const customer = sale.customer && sale.customer.deletedAt === null
        ? { name: sale.customer.name, phone: sale.customer.phone, email: sale.customer.email }
        : null;

    return {
        uuid: sale.uuid,
        saleNumber: sale.saleNumber,
        customerName: sale.customerName,
        customerMobile: sale.customerMobile,
        customerId: sale.customerId,
        customer,
        soldAt: sale.soldAt,
        paymentMethod: sale.paymentMethod || null,
        customerSource: sale.customerSource || null,
        totalPaise: String(sale.totalPaise),
        status: sale.status,
        notes: sale.notes,
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt,
        lines: lines.map((line) => ({
            uuid: line.uuid,
            unitUuid: line.unitUuid,
            barcode: line.barcode,
            sellingPricePaise: String(line.sellingPricePaise),
            unitStatus: line.unit ? line.unit.status : null,
        })),
        reversals: reversals.map((rev) => ({
            uuid: rev.uuid,
            reversalType: rev.reversalType,
            amountPaise: String(rev.amountPaise),
            reason: rev.reason,
            createdAt: rev.createdAt,
        })),
    };
}

/**
 * Resolve a single sellable unit (RETAIL + in_stock).
 * @returns {Promise<Unit>}
 */
async function resolveSellableUnit({ unitUuid, barcode }, transaction) {
    const where = unitUuid ? { uuid: unitUuid } : { barcode };
    const unit = await Unit.findOne({
        where: { ...where, deletedAt: null },
        attributes: ['id', 'uuid', 'barcode', 'status', 'channel', 'sellingPricePaise', 'floorPricePaise', 'rentPerDayPaise', 'depositPaise', 'overduePerDayPaise'],
        transaction,
    });

    if (!unit) {
        const error = new Error(`Unit ${barcode || unitUuid} not found`);
        error.statusCode = 404;
        throw error;
    }

    if (unit.channel !== CHANNEL.RETAIL) {
        const error = new Error(`Unit ${unit.barcode} is not a RETAIL unit and cannot be sold`);
        error.statusCode = 400;
        throw error;
    }

    if (unit.status !== 'in_stock') {
        const error = new Error(`Unit ${unit.barcode} is not available for sale (status: ${unit.status})`);
        error.statusCode = 409;
        throw error;
    }

    return unit;
}

/**
 * Create/checkout a RETAIL sale: one or more in_stock RETAIL units.
 * Snapshots each unit's selling_price_paise at checkout and moves each unit
 * in_stock -> sold via the state machine inside one transaction.
 *
 * @param {Object} params - { customerName, customerUuid, soldAt, paymentMethod, customerSource, notes, items, actorUserId }
 * @returns {Object} sale DTO
 */
const MAX_NUMBER_RETRIES = 3;

/**
 * The body of createSale, run inside its own transaction. Retried by createSale
 * when two concurrent checkouts race on the next S-number.
 */
const createSaleOnce = async ({ customerName, customerUuid, soldAt, paymentMethod, customerSource, notes, items, actorUserId }) => {
    const transaction = await sequelize.transaction();
    try {
        const units = [];
        for (const item of items) {
            // eslint-disable-next-line no-await-in-loop
            const unit = await resolveSellableUnit(item, transaction);
            units.push(unit);
        }

        const linkedCustomer = await resolveCustomer(customerUuid, transaction);

        const date = soldAt || new Date().toISOString().split('T')[0];
        const saleNumber = await nextSaleNumber(transaction);

        const totalPaise = units.reduce((sum, u) => sum + Number(u.sellingPricePaise), 0);

        const sale = await Sale.create(
            {
                saleNumber,
                customerName: linkedCustomer ? linkedCustomer.name : (customerName || null),
                customerMobile: linkedCustomer ? linkedCustomer.phone : null,
                customerId: linkedCustomer ? linkedCustomer.id : null,
                soldAt: date,
                totalPaise,
                status: 'completed',
                paymentMethod: paymentMethod || null,
                customerSource: customerSource || null,
                notes: notes || null,
                createdBy: actorUserId || null,
            },
            { transaction }
        );

        const lines = [];
        for (const unit of units) {
            // eslint-disable-next-line no-await-in-loop
            const line = await SaleLine.create(
                {
                    saleId: sale.id,
                    unitId: unit.id,
                    unitUuid: unit.uuid,
                    barcode: unit.barcode,
                    sellingPricePaise: unit.sellingPricePaise,
                },
                { transaction }
            );
            lines.push(line);

            // eslint-disable-next-line no-await-in-loop
            await transitionUnit(
                {
                    unitUuid: unit.uuid,
                    to: 'sold',
                    cause: 'CHECKOUT',
                    actorUserId,
                    saleLineId: line.id,
                },
                { transaction }
            );
        }

        await transaction.commit();

        const fullSale = await Sale.findByPk(sale.id, {
            include: [
                { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }] },
                { association: 'customer' },
                { association: 'reversals' },
            ],
        });

        return mapSaleDTO(fullSale, fullSale.lines, fullSale.reversals);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Create/checkout a RETAIL sale. Wrapped in a retry loop so two concurrent
 * checkouts that race on the next S-number (read MAX + 1) do not collide: the
 * loser hits the unique sale_number constraint, rolls back, regenerates a fresh
 * number and retries.
 */
export const createSale = async (params) => {
    for (let attempt = 1; attempt <= MAX_NUMBER_RETRIES; attempt += 1) {
        try {
            return await createSaleOnce(params);
        } catch (error) {
            const isNumberCollision =
                error &&
                (error.parent && error.parent.code === '23505') &&
                error.name === 'SequelizeUniqueConstraintError';
            if (!isNumberCollision || attempt === MAX_NUMBER_RETRIES) {
                throw error;
            }
        }
    }
    // Unreachable: the loop always returns or throws above.
    throw new Error('createSale retry exhausted');
};

/**
 * List sales, newest first, with their lines.
 */
export const listSales = async () => {
    const sales = await Sale.findAll({
        where: { deletedAt: null },
        order: [['createdAt', 'DESC']],
        include: [
            { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }] },
            { association: 'reversals' },
        ],
    });

    return sales.map((sale) => mapSaleDTO(sale, sale.lines || [], sale.reversals || []));
};

/**
 * Get a single sale by uuid.
 */
export const getSaleByUuid = async (uuid) => {
    const sale = await Sale.findOne({
        where: { uuid, deletedAt: null },
        include: [
            { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }] },
            { association: 'reversals' },
        ],
    });

    if (!sale) {
        return null;
    }

    return mapSaleDTO(sale, sale.lines || [], sale.reversals || []);
};

/**
 * Cancel a completed sale: snapshot a reversal row (CANCEL), reverse each
 * sold unit back to in_stock (EXCHANGE), and mark the sale cancelled.
 * The completed sale's financial fields are never mutated.
 */
export const cancelSale = async ({ uuid, reason, actorUserId }) => {
    const transaction = await sequelize.transaction();
    try {
        const sale = await Sale.findOne({
            where: { uuid, deletedAt: null },
            include: [
                { association: 'lines', include: [{ association: 'unit', attributes: ['id', 'uuid', 'status'] }] },
            ],
            transaction,
        });

        if (!sale) {
            const error = new Error('Sale not found');
            error.statusCode = 404;
            throw error;
        }

        if (sale.status !== 'completed') {
            const error = new Error(`Sale ${sale.saleNumber} is not completed and cannot be cancelled`);
            error.statusCode = 409;
            throw error;
        }

        // CAS: atomically flip status completed -> cancelled before writing the
        // reversal, so two concurrent cancels cannot both double-issue.
        const [, affectedCount] = await sequelize.query(
            `UPDATE sales
             SET status = :to, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND status = :expectedFrom AND deleted_at IS NULL`,
            {
                replacements: {
                    id: sale.id,
                    to: 'cancelled',
                    expectedFrom: 'completed',
                },
                type: sequelize.QueryTypes.UPDATE,
                transaction,
            }
        );

        if (affectedCount === 0) {
            const realSale = await Sale.findByPk(sale.id, {
                attributes: ['saleNumber', 'status', 'deletedAt'],
                transaction,
            });
            if (!realSale || realSale.deletedAt) {
                const error = new Error(`Sale ${sale.saleNumber} was deleted`);
                error.statusCode = 409;
                throw error;
            }
            const realStatus = realSale.status || 'unknown';
            const error = new Error(
                `Sale ${realSale.saleNumber} is already ${realStatus}, cannot cancel`
            );
            error.statusCode = 409;
            throw error;
        }

        // Record the reversal (settlement) row after the conditional update
        // wins, in the same transaction - history is never rewritten
        await SaleReversal.create(
            {
                saleId: sale.id,
                reversalType: 'CANCEL',
                amountPaise: sale.totalPaise,
                reason: reason || null,
            },
            { transaction }
        );

        // Reverse each sold unit back to in_stock via EXCHANGE
        for (const line of sale.lines) {
            if (line.unit && line.unit.status === 'sold') {
                // eslint-disable-next-line no-await-in-loop
                await transitionUnit(
                    {
                        unitUuid: line.unit.uuid,
                        to: 'in_stock',
                        cause: 'EXCHANGE',
                        reason: reason || `Sale ${sale.saleNumber} cancelled`,
                        actorUserId,
                        saleLineId: line.id,
                    },
                    { transaction }
                );
            }
        }

        // Status already flipped to cancelled by the CAS above; stale in-memory
        // value is refreshed for the DTO.
        sale.status = 'cancelled';

        await transaction.commit();

        const fullSale = await Sale.findByPk(sale.id, {
            include: [
                { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }] },
                { association: 'customer' },
                { association: 'reversals' },
            ],
        });

        return mapSaleDTO(fullSale, fullSale.lines, fullSale.reversals);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Refund a completed sale: snapshot a reversal row (REFUND). Units stay sold.
 * An identical-item return/exchange is handled by the cancel flow.
 */
export const refundSale = async ({ uuid, reason, actorUserId }) => {
    const transaction = await sequelize.transaction();
    try {
        const sale = await Sale.findOne({ where: { uuid, deletedAt: null }, transaction });

        if (!sale) {
            const error = new Error('Sale not found');
            error.statusCode = 404;
            throw error;
        }

        // CAS: atomically flip status completed -> refunded to prevent two concurrent
        // requests from both passing the check and double-issuing the refund.
        const [, affectedCount] = await sequelize.query(
            `UPDATE sales
             SET status = :to, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND status = :expectedFrom AND deleted_at IS NULL`,
            {
                replacements: {
                    id: sale.id,
                    to: 'refunded',
                    expectedFrom: 'completed',
                },
                type: sequelize.QueryTypes.UPDATE,
                transaction,
            }
        );

        if (affectedCount === 0) {
            const realSale = await Sale.findByPk(sale.id, {
                attributes: ['saleNumber', 'status', 'deletedAt'],
                transaction,
            });
            if (!realSale || realSale.deletedAt) {
                const error = new Error(`Sale ${sale.saleNumber} was deleted`);
                error.statusCode = 409;
                throw error;
            }
            const realStatus = realSale.status || 'unknown';
            const error = new Error(
                `Sale ${realSale.saleNumber} is already ${realStatus}, cannot refund`
            );
            error.statusCode = 409;
            throw error;
        }

        // Record the refund reversal AFTER the conditional update wins, in the
        // same transaction. History is never rewritten; reversals are append-only.
        await SaleReversal.create(
            {
                saleId: sale.id,
                reversalType: 'REFUND',
                amountPaise: sale.totalPaise,
                reason: reason || null,
            },
            { transaction }
        );

        await transaction.commit();

        const fullSale = await Sale.findByPk(sale.id, {
            include: [
                { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }] },
                { association: 'customer' },
                { association: 'reversals' },
            ],
        });

        return mapSaleDTO(fullSale, fullSale.lines, fullSale.reversals);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Update a sale's linkable fields: link/unlink a customer (customerUuid) and
 * optionally refresh snapshot contact fields. Financial fields are never mutable.
 *
 * @param {Object} params - { uuid, payload: { customerUuid, customerName, notes, soldAt } }
 * @returns {Object} sale DTO
 */
export const patchSale = async ({ uuid, payload }) => {
    const sale = await Sale.findOne({
        where: { uuid, deletedAt: null },
        include: [
            { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }] },
            { association: 'reversals' },
        ],
    });

    if (!sale) {
        const error = new Error('Sale not found');
        error.statusCode = 404;
        throw error;
    }

    const updates = {};

    if (payload.customerName !== undefined) {
        updates.customerName = payload.customerName === null ? null : payload.customerName;
    }

    if (payload.soldAt !== undefined) {
        updates.soldAt = payload.soldAt;
    }

    if (payload.notes !== undefined) {
        updates.notes = payload.notes === null ? null : payload.notes;
    }

    if (payload.customerUuid !== undefined) {
        if (payload.customerUuid === null) {
            // Explicitly unlink; keep snapshot contact fields for backward compat
            updates.customerId = null;
        } else {
            const linkedCustomer = await resolveCustomer(payload.customerUuid);
            updates.customerId = linkedCustomer.id;
            updates.customerName = linkedCustomer.name;
            updates.customerMobile = linkedCustomer.phone;
        }
    }

    if (Object.keys(updates).length > 0) {
        await sale.update(updates);
    }

    const fullSale = await Sale.findByPk(sale.id, {
        include: [
            { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }] },
            { association: 'customer' },
            { association: 'reversals' },
        ],
    });

    return mapSaleDTO(fullSale, fullSale.lines, fullSale.reversals);
};
