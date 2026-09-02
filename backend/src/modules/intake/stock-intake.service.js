import { StockIntake, Vendor, StockIntakeLine, ProductType, sequelize } from '../../../database/models/index.js';
import { Sequelize } from 'sequelize';
import { computeVarianceForTrip } from '../vendors/vendor.service.js';

export const getStockIntakes = async () => {
    const intakes = await StockIntake.findAll({
        attributes: ['id', 'uuid', 'vendorId', 'purchasedOn', 'billReference', 'totalPaidPaise', 'createdAt', 'updatedAt'],
        order: [['purchasedOn', 'DESC']],
        include: [
            {
                model: Vendor,
                as: 'vendor',
                attributes: ['uuid'],
            },
        ],
    });

    // Compute variancePaise for each intake
    const intakesWithVariance = await Promise.all(
        intakes.map(async (intake) => {
            const variancePaise = await computeVariancePaise(intake.id, intake.totalPaidPaise);
            return mapStockIntakeDTO(intake, variancePaise);
        })
    );

    return intakesWithVariance;
};

export const createStockIntake = async ({ vendorUuid, purchasedOn, billReference, totalPaidPaise }) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate vendor exists
        const vendor = await Vendor.findOne({
            where: { uuid: vendorUuid },
            transaction,
        });

        if (!vendor) {
            const error = new Error('Vendor not found');
            error.statusCode = 404;
            throw error;
        }

        // Validate vendor is active
        if (!vendor.isActive) {
            const error = new Error(`Vendor is inactive`);
            error.statusCode = 400;
            throw error;
        }

        // Create the stock intake
        const intake = await StockIntake.create({
            vendorId: vendor.id,
            purchasedOn,
            billReference: billReference || null,
            totalPaidPaise,
        }, { transaction });

        await transaction.commit();

        // Compute variance (no lots yet, so variance = totalPaidPaise)
        const variancePaise = totalPaidPaise;

        return {
            uuid: intake.uuid,
            vendorUuid: vendor.uuid,
            purchasedOn: intake.purchasedOn,
            billReference: intake.billReference,
            totalPaidPaise: Number(intake.totalPaidPaise),
            variancePaise: Number(variancePaise),
            createdAt: intake.createdAt,
            updatedAt: intake.updatedAt,
        };
    } catch (error) {
        await transaction.rollback();
        // Handle unique index violation on bill references
        try {
            if (error.name === 'SequelizeUniqueConstraintError' ||
                error.original?.code === '23505' ||
                error.message?.includes('idx_stock_intakes_vendor_bill') ||
                error.message?.includes('duplicate key')) {
                const constraintError = new Error(`Bill reference "${billReference}" already exists for this vendor`);
                constraintError.statusCode = 409;
                throw constraintError;
            }
        } catch (dupError) {
            if (dupError.statusCode === 409) {
                throw dupError;
            }
        }
        throw error;
    }
};

export const getStockIntakeByUuid = async (uuid) => {
    const intake = await StockIntake.findOne({
        where: { uuid },
        attributes: ['id', 'uuid', 'vendorId', 'purchasedOn', 'billReference', 'totalPaidPaise', 'createdAt', 'updatedAt'],
        include: [
            {
                model: Vendor,
                as: 'vendor',
                attributes: ['uuid'],
            },
        ],
    });

    if (!intake) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
    }

    // Compute variance for this intake
    const variancePaise = await computeVariancePaise(intake.id, intake.totalPaidPaise);

    return mapStockIntakeDTO(intake, variancePaise);
};

/**
 * Compute variance as totalPaidPaise - sum(quantity * buyingPricePaise) for all non-deleted lots
 * Explicitly filters lots WHERE deleted_at IS NULL to exclude soft-deleted records
 * @param {number} stockIntakeId - The stock intake ID
 * @param {number} totalPaidPaise - The total paid amount
 * @returns {number} The variance in paise
 */
async function computeVariancePaise(stockIntakeId, totalPaidPaise) {
    try {
        // Fetch all non-deleted lot lines for this stock intake
        const lines = await StockIntakeLine.findAll({
            where: {
                stockIntakeId: stockIntakeId,
                deletedAt: { [sequelize.Sequelize.Op.is]: null },
            },
            attributes: ['quantity', 'buyingPricePaise'],
        });
        // Reuse shared variance computation logic
        return computeVarianceForTrip(totalPaidPaise, lines);
    } catch (error) {
        // On any error computing variance, return totalPaidPaise as safe default
        return totalPaidPaise;
    }
}

export const getLastLotForTrip = async (tripUuid) => {
    // Validate trip exists
    const trip = await StockIntake.findOne({
        where: { uuid: tripUuid },
    });

    if (!trip) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
    }

    // Query the most recent non-deleted lot for this trip
    // Order by created_at DESC, then id DESC as tiebreaker
    const line = await StockIntakeLine.findOne({
        where: {
            stockIntakeId: trip.id,
            deletedAt: { [sequelize.Sequelize.Op.is]: null },
        },
        attributes: [
            'uuid',
            'productTypeId',
            'quantity',
            'buyingPricePaise',
            'sellingPricePaise',
            'floorPricePaise',
            'channel',
            'rentPerDayPaise',
            'depositPaise',
            'overduePerDayPaise',
            'createdAt',
        ],
        include: [
            {
                model: ProductType,
                as: 'productType',
                attributes: ['uuid'],
            },
        ],
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });

    if (!line) {
        const error = new Error('No lots found to clone for this trip');
        error.statusCode = 404;
        throw error;
    }

    return mapCloneLotDTO(line);
};

/**
 * Map StockIntake to DTO response
 * @param {Object} intake - StockIntake from database
 * @param {number} variancePaise - Computed variance
 * @returns {Object} DTO with uuid, vendorUuid, purchasedOn, billReference, totalPaidPaise, variancePaise, createdAt, updatedAt
 */
function mapStockIntakeDTO(intake, variancePaise) {
    return {
        uuid: intake.uuid,
        vendorUuid: intake.vendor?.uuid || null,
        purchasedOn: intake.purchasedOn,
        billReference: intake.billReference,
        totalPaidPaise: Number(intake.totalPaidPaise),
        variancePaise: Number(variancePaise),
        createdAt: intake.createdAt,
        updatedAt: intake.updatedAt,
    };
}

/**
 * Map StockIntakeLine to clone DTO response
 * Numeric fields are returned as STRINGS (not Number) to preserve BIGINT precision per AD-24 tier 1
 * NOTE: createdAt is returned for reference (audit trail) only and is READ-ONLY.
 *       Frontend must NOT use this historical timestamp when creating a new lot.
 *       New lots must set their own timestamp (purchasedOn) to today's date or user-selected date.
 * @param {Object} line - StockIntakeLine from database
 * @returns {Object} DTO with productTypeUuid, quantity, prices as strings, channel, rental fields, and createdAt (read-only reference only)
 */
function mapCloneLotDTO(line) {
    return {
        productTypeUuid: line.productType.uuid,
        quantity: line.quantity,
        buyingPricePaise: String(line.buyingPricePaise),
        sellingPricePaise: String(line.sellingPricePaise),
        floorPricePaise: String(line.floorPricePaise),
        channel: line.channel,
        rentPerDayPaise: line.rentPerDayPaise !== null ? String(line.rentPerDayPaise) : null,
        depositPaise: line.depositPaise !== null ? String(line.depositPaise) : null,
        overduePerDayPaise: line.overduePerDayPaise !== null ? String(line.overduePerDayPaise) : null,
        createdAt: line.createdAt,
    };
}
