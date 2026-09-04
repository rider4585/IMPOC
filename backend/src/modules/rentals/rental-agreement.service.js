import {
    RentalAgreement,
    RentalLine,
    RentalReturn,
    RentalReversal,
    Unit,
    DamageGrade,
    Customer,
    sequelize,
} from '../../../database/models/index.js';
import { transitionUnit } from '../units/units.service.js';
import { CHANNEL } from '../../constants/channel.js';
import { DAMAGE_GRADE_OUTCOMES } from '../../constants/damage-grade-outcome.js';

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

// Default hand-out period when no rentalDays is supplied. Due date is derived
// from this + start date; it is never stored as a mutable field.
const DEFAULT_RENTAL_DAYS = 3;

/**
 * Generate the next agreement number, e.g. R-0001
 * @returns {Promise<string>}
 */
async function nextAgreementNumber(transaction) {
    const last = await RentalAgreement.findOne({
        order: [['id', 'DESC']],
        attributes: ['agreementNumber'],
        paranoid: false,
        transaction,
    });
    const lastNum = last ? parseInt(last.agreementNumber.replace(/\D/g, ''), 10) || 0 : 0;
    return `R-${String(lastNum + 1).padStart(4, '0')}`;
}

function pad(n) {
    return n < 10 ? `0${n}` : String(n);
}

function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + days);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function daysBetween(fromStr, toStr) {
    const [fy, fm, fd] = fromStr.split('-').map(Number);
    const [ty, tm, td] = toStr.split('-').map(Number);
    const from = Date.UTC(fy, fm - 1, fd);
    const to = Date.UTC(ty, tm - 1, td);
    return Math.round((to - from) / 86400000);
}

/**
 * Resolve a single rentable unit (RENTAL + in_stock).
 * @returns {Promise<Unit>}
 */
async function resolveRentableUnit({ unitUuid, barcode }, transaction) {
    const where = unitUuid ? { uuid: unitUuid } : { barcode };
    const unit = await Unit.findOne({
        where: { ...where, deletedAt: null },
        attributes: ['id', 'uuid', 'barcode', 'status', 'channel', 'rentPerDayPaise', 'depositPaise', 'overduePerDayPaise'],
        transaction,
    });

    if (!unit) {
        const error = new Error(`Unit ${barcode || unitUuid} not found`);
        error.statusCode = 404;
        throw error;
    }

    if (unit.channel !== CHANNEL.RENTAL) {
        const error = new Error(`Unit ${unit.barcode} is not a RENTAL unit and cannot be rented`);
        error.statusCode = 400;
        throw error;
    }

    if (unit.status !== 'in_stock') {
        const error = new Error(`Unit ${unit.barcode} is not available for rent (status: ${unit.status})`);
        error.statusCode = 409;
        throw error;
    }

    if (unit.rentPerDayPaise === null || unit.depositPaise === null) {
        const error = new Error(`Unit ${unit.barcode} has no rental pricing and cannot be rented`);
        error.statusCode = 400;
        throw error;
    }

    return unit;
}

function mapAgreementDTO(agreement, lines = [], returns = [], reversals = []) {
    const customer = agreement.customer && agreement.customer.deletedAt === null
        ? { name: agreement.customer.name, phone: agreement.customer.phone, email: agreement.customer.email }
        : null;

    return {
        uuid: agreement.uuid,
        agreementNumber: agreement.agreementNumber,
        customerName: agreement.customerName,
        customerMobile: agreement.customerMobile,
        customerId: agreement.customerId,
        customer,
        startDate: agreement.startDate,
        dueDate: agreement.dueDate,
        depositRefundablePaise: String(agreement.depositRefundablePaise),
        status: agreement.status,
        notes: agreement.notes,
        createdAt: agreement.createdAt,
        updatedAt: agreement.updatedAt,
        lines: lines.map((line) => ({
            uuid: line.uuid,
            unitUuid: line.unitUuid,
            barcode: line.barcode,
            rentPerDayPaise: String(line.rentPerDayPaise),
            depositPaise: String(line.depositPaise),
            overduePerDayPaise: String(line.overduePerDayPaise),
            unitStatus: line.unit ? line.unit.status : null,
            returns: (line.returns || []).map((r) => ({
                uuid: r.uuid,
                actualReturnDate: r.actualReturnDate,
                damageGradeName: r.damageGradeName,
                damageGradeOutcome: r.damageGradeOutcome,
                lateDays: r.lateDays,
                overdueChargePaise: String(r.overdueChargePaise),
                damageChargePaise: String(r.damageChargePaise),
                depositRefundedPaise: String(r.depositRefundedPaise),
            })),
        })),
        returns: returns.map((r) => ({
            uuid: r.uuid,
            unitUuid: r.unitUuid,
            actualReturnDate: r.actualReturnDate,
            damageGradeName: r.damageGradeName,
            damageGradeOutcome: r.damageGradeOutcome,
            lateDays: r.lateDays,
            overdueChargePaise: String(r.overdueChargePaise),
            damageChargePaise: String(r.damageChargePaise),
            depositRefundedPaise: String(r.depositRefundedPaise),
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
 * Create/checkout a rental: one or more in_stock RENTAL units.
 * Snapshots each unit's rent/deposit/overdue paise onto the line at hand-out,
 * transitions each unit in_stock -> rented (HAND_OVER), and computes due_date
 * from start_date + rental period, all inside one transaction.
 *
 * @param {Object} params - { customerName, customerUuid, startDate, rentalDays, notes, items, actorUserId }
 * @returns {Object} agreement DTO
 */
export const createRental = async ({ customerName, customerUuid, startDate, rentalDays, notes, items, actorUserId }) => {
    const transaction = await sequelize.transaction();
    try {
        const units = [];
        for (const item of items) {
            // eslint-disable-next-line no-await-in-loop
            const unit = await resolveRentableUnit(item, transaction);
            units.push(unit);
        }

        const linkedCustomer = await resolveCustomer(customerUuid, transaction);

        const start = startDate || new Date().toISOString().split('T')[0];
        const days = rentalDays || DEFAULT_RENTAL_DAYS;
        const due = addDays(start, days);
        const agreementNumber = await nextAgreementNumber(transaction);

        // Snapshot of total deposit collected at hand-out (never mutated)
        const depositRefundablePaise = units.reduce((sum, u) => sum + Number(u.depositPaise), 0);

        const agreement = await RentalAgreement.create(
            {
                agreementNumber,
                customerName: linkedCustomer ? linkedCustomer.name : (customerName || null),
                customerMobile: linkedCustomer ? linkedCustomer.phone : null,
                customerId: linkedCustomer ? linkedCustomer.id : null,
                startDate: start,
                dueDate: due,
                depositRefundablePaise,
                status: 'active',
                notes: notes || null,
                createdBy: actorUserId || null,
            },
            { transaction }
        );

        const lines = [];
        for (const unit of units) {
            // eslint-disable-next-line no-await-in-loop
            const line = await RentalLine.create(
                {
                    agreementId: agreement.id,
                    unitId: unit.id,
                    unitUuid: unit.uuid,
                    barcode: unit.barcode,
                    rentPerDayPaise: unit.rentPerDayPaise,
                    depositPaise: unit.depositPaise,
                    overduePerDayPaise: unit.overduePerDayPaise,
                },
                { transaction }
            );
            lines.push(line);

            // eslint-disable-next-line no-await-in-loop
            await transitionUnit(
                {
                    unitUuid: unit.uuid,
                    to: 'rented',
                    cause: 'HAND_OVER',
                    actorUserId,
                    agreementId: agreement.id,
                },
                { transaction }
            );
        }

        await transaction.commit();

        const fullAgreement = await RentalAgreement.findByPk(agreement.id, {
            include: [
                { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }, { association: 'returns' }] },
                { association: 'customer' },
                { association: 'returns' },
                { association: 'reversals' },
            ],
        });

        return mapAgreementDTO(fullAgreement, fullAgreement.lines, fullAgreement.returns, fullAgreement.reversals);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * List agreements, newest first, with lines and returns.
 */
export const listRentals = async () => {
    const agreements = await RentalAgreement.findAll({
        where: { deletedAt: null },
        order: [['createdAt', 'DESC']],
        include: [
            { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }, { association: 'returns' }] },
            { association: 'customer' },
            { association: 'returns' },
            { association: 'reversals' },
        ],
    });

    return agreements.map((agreement) =>
        mapAgreementDTO(agreement, agreement.lines || [], agreement.returns || [], agreement.reversals || [])
    );
};

/**
 * Get a single agreement by uuid.
 */
export const getRentalByUuid = async (uuid) => {
    const agreement = await RentalAgreement.findOne({
        where: { uuid, deletedAt: null },
        include: [
            { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }, { association: 'returns' }] },
            { association: 'customer' },
            { association: 'returns' },
            { association: 'reversals' },
        ],
    });

    if (!agreement) {
        return null;
    }

    return mapAgreementDTO(agreement, agreement.lines || [], agreement.returns || [], agreement.reversals || []);
};

/**
 * Resolve the damage grade by uuid (if supplied) for a return.
 * @returns {Promise<DamageGrade|null>}
 */
async function resolveDamageGrade(gradeUuid, transaction) {
    if (!gradeUuid) return null;
    const grade = await DamageGrade.findOne({
        where: { uuid: gradeUuid, deletedAt: null, isActive: true },
        attributes: ['id', 'name', 'outcome'],
        transaction,
    });
    if (!grade) {
        const error = new Error('Damage grade not found');
        error.statusCode = 404;
        throw error;
    }
    return grade;
}

/**
 * Process a return: returns one or more rented units.
 * For each unit: computes overdue days + overdue charge (derived from due_date
 * and overdue_per_day_paise snapshot), applies the damage grade outcome
 * (RETURN_TO_STOCK / SEND_TO_MAINTENANCE / RETIRE), transitions the unit
 * rented -> in_stock|in_maintenance|retired via RETURN, and writes a
 * rental_returns row. All inside one transaction.
 *
 * @param {Object} params - { uuid, actualReturnDate, items, actorUserId }
 * @returns {Object} agreement DTO
 */
export const processRentalReturn = async ({ uuid, actualReturnDate, items, actorUserId }) => {
    const transaction = await sequelize.transaction();
    try {
        const agreement = await RentalAgreement.findOne({
            where: { uuid, deletedAt: null },
            include: [
                { association: 'lines', include: [{ association: 'unit', attributes: ['id', 'uuid', 'barcode', 'status'] }, { association: 'returns' }] },
            ],
            transaction,
        });

        if (!agreement) {
            const error = new Error('Rental agreement not found');
            error.statusCode = 404;
            throw error;
        }

        if (agreement.status !== 'active') {
            const error = new Error(`Agreement ${agreement.agreementNumber} is not active and cannot be returned`);
            error.statusCode = 409;
            throw error;
        }

        const returnDate = actualReturnDate || new Date().toISOString().split('T')[0];

        // Track lines already returned (before this request) so we can detect
        // completion after adding the new return row below.
        const returnedLineIds = new Set();
        for (const l of agreement.lines) {
            if ((l.returns || []).length > 0) {
                returnedLineIds.add(l.id);
            }
        }

        for (const item of items) {
            const line = item.unitUuid
                ? agreement.lines.find((l) => l.unitUuid === item.unitUuid)
                : agreement.lines.find((l) => l.barcode === item.barcode);

            if (!line) {
                const error = new Error(`Unit ${item.unitUuid || item.barcode} is not part of this agreement`);
                error.statusCode = 404;
                throw error;
            }

            if (line.unit && line.unit.status !== 'rented') {
                const error = new Error(`Unit ${line.unit.barcode} is not currently rented (status: ${line.unit.status})`);
                error.statusCode = 409;
                throw error;
            }

            // Prevent duplicate return for the same line
            if ((line.returns || []).length > 0) {
                const error = new Error(`Unit ${line.unit.barcode} has already been returned`);
                error.statusCode = 409;
                throw error;
            }

            const grade = item.gradeUuid ? await resolveDamageGrade(item.gradeUuid, transaction) : null;

            // Derived overdue: never stored as a mutable field
            const lateDays = Math.max(0, daysBetween(agreement.dueDate, returnDate));
            const overdueChargePaise = lateDays * Number(line.overduePerDayPaise);

            // Damage charge is decided per item at return time; defaults to 0
            const damageChargePaise = item.damageChargePaise !== undefined ? Number(item.damageChargePaise) : 0;

            // Deposit actually refunded = deposit - overdue - damage, min 0
            const depositRefundedPaise = Math.max(0, Number(line.depositPaise) - overdueChargePaise - damageChargePaise);

            let to;
            let cause = 'RETURN';
            let outcome = null;
            if (grade && grade.outcome) {
                outcome = grade.outcome;
                if (grade.outcome === DAMAGE_GRADE_OUTCOMES.SEND_TO_MAINTENANCE) {
                    to = 'in_maintenance';
                } else if (grade.outcome === DAMAGE_GRADE_OUTCOMES.RETIRE) {
                    to = 'retired';
                } else {
                    to = 'in_stock';
                }
            } else {
                to = 'in_stock';
            }

            // Rental return rows (history is rewritten only by adding rows)
            // eslint-disable-next-line no-await-in-loop
            await RentalReturn.create(
                {
                    agreementId: agreement.id,
                    rentalLineId: line.id,
                    unitId: line.unitId,
                    unitUuid: line.unitUuid,
                    actualReturnDate: returnDate,
                    damageGradeName: grade ? grade.name : null,
                    damageGradeOutcome: outcome,
                    lateDays,
                    overdueChargePaise,
                    damageChargePaise,
                    depositRefundedPaise,
                    notes: item.notes || null,
                },
                { transaction }
            );

            // eslint-disable-next-line no-await-in-loop
            await transitionUnit(
                {
                    unitUuid: line.unitUuid,
                    to,
                    cause,
                    actorUserId,
                    agreementId: agreement.id,
                },
                { transaction }
            );

            returnedLineIds.add(line.id);
        }

        // If every line has been returned, the agreement is complete
        const allReturned = agreement.lines.every((l) => returnedLineIds.has(l.id));
        if (allReturned) {
            agreement.status = 'completed';
            // eslint-disable-next-line no-await-in-loop
            await agreement.save({ transaction });
        }

        await transaction.commit();

        const fullAgreement = await RentalAgreement.findByPk(agreement.id, {
            include: [
                { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }, { association: 'returns' }] },
                { association: 'customer' },
                { association: 'returns' },
                { association: 'reversals' },
            ],
        });

        return mapAgreementDTO(fullAgreement, fullAgreement.lines, fullAgreement.returns, fullAgreement.reversals);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Cancel an active agreement: snapshot a reversal row (CANCEL) and reverse each
 * still-rented unit back to in_stock via RETURN. Lines already returned are left
 * untouched. Completed financials are never mutated.
 */
export const cancelRental = async ({ uuid, reason, actorUserId }) => {
    const transaction = await sequelize.transaction();
    try {
        const agreement = await RentalAgreement.findOne({
            where: { uuid, deletedAt: null },
            include: [
                { association: 'lines', include: [{ association: 'unit', attributes: ['id', 'uuid', 'status'] }, { association: 'returns' }] },
            ],
            transaction,
        });

        if (!agreement) {
            const error = new Error('Rental agreement not found');
            error.statusCode = 404;
            throw error;
        }

        if (agreement.status !== 'active') {
            const error = new Error(`Agreement ${agreement.agreementNumber} is not active and cannot be cancelled`);
            error.statusCode = 409;
            throw error;
        }

        await RentalReversal.create(
            {
                agreementId: agreement.id,
                reversalType: 'CANCEL',
                amountPaise: agreement.depositRefundablePaise,
                reason: reason || null,
            },
            { transaction }
        );

        for (const line of agreement.lines) {
            // Reverse only units still rented (not those already returned)
            if (line.unit && line.unit.status === 'rented') {
                // eslint-disable-next-line no-await-in-loop
                await transitionUnit(
                    {
                        unitUuid: line.unit.uuid,
                        to: 'in_stock',
                        cause: 'RETURN',
                        reason: reason || `Agreement ${agreement.agreementNumber} cancelled`,
                        actorUserId,
                        agreementId: agreement.id,
                    },
                    { transaction }
                );
            }
        }

        agreement.status = 'cancelled';
        await agreement.save({ transaction });

        await transaction.commit();

        const fullAgreement = await RentalAgreement.findByPk(agreement.id, {
            include: [
                { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }, { association: 'returns' }] },
                { association: 'customer' },
                { association: 'returns' },
                { association: 'reversals' },
            ],
        });

        return mapAgreementDTO(fullAgreement, fullAgreement.lines, fullAgreement.returns, fullAgreement.reversals);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Update an agreement's linkable fields: link/unlink a customer (customerUuid)
 * and optionally refresh snapshot contact fields. Financial fields are never mutable.
 *
 * @param {Object} params - { uuid, payload: { customerUuid, customerName, notes } }
 * @returns {Object} agreement DTO
 */
export const patchRental = async ({ uuid, payload }) => {
    const agreement = await RentalAgreement.findOne({
        where: { uuid, deletedAt: null },
        include: [
            { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }, { association: 'returns' }] },
            { association: 'returns' },
            { association: 'reversals' },
        ],
    });

    if (!agreement) {
        const error = new Error('Rental agreement not found');
        error.statusCode = 404;
        throw error;
    }

    const updates = {};

    if (payload.customerName !== undefined) {
        updates.customerName = payload.customerName === null ? null : payload.customerName;
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
        await agreement.update(updates);
    }

    const fullAgreement = await RentalAgreement.findByPk(agreement.id, {
        include: [
            { association: 'lines', include: [{ association: 'unit', attributes: ['status'] }, { association: 'returns' }] },
            { association: 'customer' },
            { association: 'returns' },
            { association: 'reversals' },
        ],
    });

    return mapAgreementDTO(fullAgreement, fullAgreement.lines, fullAgreement.returns, fullAgreement.reversals);
};
