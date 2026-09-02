import { StockIntakeLine, StockIntake, ProductType, Unit, Colour, Size, sequelize } from '../../../database/models/index.js';

/**
 * Verify that the user has access to the given trip
 * Currently, all authenticated users have access to all trips (can be enhanced with trip ownership)
 * @param {string} tripUuid - Trip UUID to verify access to
 * @param {Object} user - User object from authentication middleware
 * @throws {Error} with statusCode 404 if trip not found or 403 if access denied
 */
export const verifyTripAccess = async (tripUuid, user) => {
    // Verify trip exists (implicitly verifies user has access if trip is accessible)
    const trip = await StockIntake.findOne({
        where: { uuid: tripUuid },
    });

    if (!trip) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
    }

    // For now, all authenticated users have access to all trips
    // This can be enhanced with trip ownership checks or permission-based access
};

export const createStockIntakeLine = async ({
    tripUuid,
    productTypeUuid,
    quantity,
    buyingPricePaise,
    sellingPricePaise,
    floorPricePaise,
    channel,
    rentPerDayPaise,
    depositPaise,
    overduePerDayPaise,
}) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate trip exists
        const trip = await StockIntake.findOne({
            where: { uuid: tripUuid },
            transaction,
        });

        if (!trip) {
            const error = new Error('Trip not found');
            error.statusCode = 404;
            throw error;
        }

        // Validate product type exists and is active (inside transaction to prevent deactivation race)
        const productType = await ProductType.findOne({
            where: { uuid: productTypeUuid },
            transaction,
        });

        if (!productType) {
            const error = new Error('Product type not found');
            error.statusCode = 404;
            throw error;
        }

        if (!productType.isActive) {
            const error = new Error('Product type is inactive');
            error.statusCode = 400;
            throw error;
        }

        // Additional constraint validations
        if (floorPricePaise > sellingPricePaise) {
            const error = new Error('Floor price cannot exceed selling price');
            error.statusCode = 400;
            throw error;
        }

        if (channel === 'RENTAL' && overduePerDayPaise !== null && rentPerDayPaise !== null) {
            if (overduePerDayPaise <= rentPerDayPaise) {
                const error = new Error('Overdue per day must be greater than rent per day');
                error.statusCode = 400;
                throw error;
            }
        }

        // Create the stock intake line
        const line = await StockIntakeLine.create(
            {
                stockIntakeId: trip.id,
                productTypeId: productType.id,
                quantity,
                buyingPricePaise,
                sellingPricePaise,
                floorPricePaise,
                channel,
                rentPerDayPaise: rentPerDayPaise || null,
                depositPaise: depositPaise || null,
                overduePerDayPaise: overduePerDayPaise || null,
            },
            { transaction }
        );

        await transaction.commit();

        return mapStockIntakeLineDTO(line, tripUuid, productTypeUuid);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getStockIntakeLines = async (tripUuid) => {
    // Validate trip exists
    const trip = await StockIntake.findOne({
        where: { uuid: tripUuid },
    });

    if (!trip) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
    }

    const lines = await StockIntakeLine.findAll({
        where: { stockIntakeId: trip.id },
        attributes: [
            'id',
            'uuid',
            'stockIntakeId',
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
            'updatedAt',
        ],
        include: [
            {
                model: ProductType,
                as: 'productType',
                attributes: ['uuid'],
            },
        ],
        order: [['createdAt', 'ASC']],
    });

    return lines.map((line) => mapStockIntakeLineDTO(line, tripUuid, line.productType.uuid));
};

export const getStockIntakeLineByUuid = async (tripUuid, lotUuid) => {
    // Validate trip exists
    const trip = await StockIntake.findOne({
        where: { uuid: tripUuid },
    });

    if (!trip) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
    }

    const line = await StockIntakeLine.findOne({
        where: {
            uuid: lotUuid,
            stockIntakeId: trip.id,
        },
        attributes: [
            'id',
            'uuid',
            'stockIntakeId',
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
            'updatedAt',
        ],
        include: [
            {
                model: ProductType,
                as: 'productType',
                attributes: ['uuid'],
            },
        ],
    });

    if (!line) {
        const error = new Error('Lot not found');
        error.statusCode = 404;
        throw error;
    }

    // Count non-deleted units scanned into this lot
    const { Unit } = await import('../../../database/models/index.js');
    const unitsScannedCount = await Unit.count({
        where: {
            stockIntakeLineId: line.id,
            deletedAt: null,
        },
    });

    const dto = mapStockIntakeLineDTO(line, tripUuid, line.productType.uuid);
    dto.unitsScannedCount = unitsScannedCount;
    return dto;
};

export const updateStockIntakeLine = async (tripUuid, lotUuid, updates) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate trip exists
        const trip = await StockIntake.findOne({
            where: { uuid: tripUuid },
            transaction,
        });

        if (!trip) {
            const error = new Error('Trip not found');
            error.statusCode = 404;
            throw error;
        }

        // Find the line
        const line = await StockIntakeLine.findOne({
            where: {
                uuid: lotUuid,
                stockIntakeId: trip.id,
            },
            transaction,
        });

        if (!line) {
            const error = new Error('Lot not found');
            error.statusCode = 404;
            throw error;
        }

        // Get current values for constraint validation
        const currentSellingPrice = updates.sellingPricePaise !== undefined ? updates.sellingPricePaise : line.sellingPricePaise;
        const currentFloorPrice = updates.floorPricePaise !== undefined ? updates.floorPricePaise : line.floorPricePaise;
        const currentRentPerDay = updates.rentPerDayPaise !== undefined ? updates.rentPerDayPaise : line.rentPerDayPaise;
        const currentOverduePerDay = updates.overduePerDayPaise !== undefined ? updates.overduePerDayPaise : line.overduePerDayPaise;

        // Validate floor price constraint
        if (currentFloorPrice > currentSellingPrice) {
            const error = new Error('Floor price cannot exceed selling price');
            error.statusCode = 400;
            throw error;
        }

        // Validate rental constraint
        if (line.channel === 'RENTAL' && currentOverduePerDay !== null && currentRentPerDay !== null) {
            if (currentOverduePerDay <= currentRentPerDay) {
                const error = new Error('Overdue per day must be greater than rent per day');
                error.statusCode = 400;
                throw error;
            }
        }

        // Update the line
        await line.update(updates, { transaction });

        await transaction.commit();

        // Fetch the product type UUID for the response
        const productType = await ProductType.findOne({
            where: { id: line.productTypeId },
            attributes: ['uuid'],
        });

        return mapStockIntakeLineDTO(line, tripUuid, productType.uuid);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Map StockIntakeLine to DTO response
 * Paise values are returned as STRINGS (not Number) to preserve BIGINT precision
 * @param {Object} line - StockIntakeLine from database
 * @param {string} tripUuid - Trip UUID
 * @param {string} productTypeUuid - Product Type UUID
 * @returns {Object} DTO with uuid, tripUuid, productTypeUuid, quantity, prices as strings, channel, rental fields, createdAt, updatedAt
 */
function mapStockIntakeLineDTO(line, tripUuid, productTypeUuid) {
    return {
        uuid: line.uuid,
        tripUuid,
        productTypeUuid,
        quantity: line.quantity,
        buyingPricePaise: String(line.buyingPricePaise),
        sellingPricePaise: String(line.sellingPricePaise),
        floorPricePaise: String(line.floorPricePaise),
        channel: line.channel,
        rentPerDayPaise: line.rentPerDayPaise !== null ? String(line.rentPerDayPaise) : null,
        depositPaise: line.depositPaise !== null ? String(line.depositPaise) : null,
        overduePerDayPaise: line.overduePerDayPaise !== null ? String(line.overduePerDayPaise) : null,
        createdAt: line.createdAt,
        updatedAt: line.updatedAt,
    };
}

/**
 * Scan a barcode into a lot (stock intake line)
 * Validates barcode uniqueness, lot quantity limits, inactive picklists
 * Delegates unit row insertion to units.service to preserve AD-8's invariant
 * A successful scan inserts both a units row and its first unit_status_events row atomically
 * 
 * @param {Object} params
 * @param {string} params.barcode - Barcode to scan (1-12 chars)
 * @param {string} params.stockIntakeLineUuid - Lot UUID
 * @param {string} params.colourUuid - Colour UUID
 * @param {string} params.sizeUuid - Size UUID
 * @param {integer} params.actorUserId - User ID of the actor performing the scan
 * @returns {Object} Created unit DTO
 * @throws {Error} with statusCode property for HTTP mapping
 */
export const scanIntoLot = async ({
    barcode,
    stockIntakeLineUuid,
    colourUuid,
    sizeUuid,
    actorUserId,
}) => {
    // Patch 4: Null check for actorUserId
    if (actorUserId == null) {
        const error = new Error('Actor user ID required');
        error.statusCode = 400;
        throw error;
    }

    const transaction = await sequelize.transaction();

    try {
        const { createUnitFromScan } = await import('../units/units.service.js');

        // Resolve stock intake line by UUID
        const lot = await StockIntakeLine.findOne({
            where: { uuid: stockIntakeLineUuid },
            transaction,
        });

        if (!lot) {
            const error = new Error('Lot not found');
            error.statusCode = 404;
            throw error;
        }

        // Patch 2: Soft-deleted lot check
        if (lot.deletedAt) {
            const error = new Error('Lot is deleted');
            error.statusCode = 400;
            throw error;
        }

        // Patch 3: Null check for lot.quantity
        if (lot.quantity == null) {
            const error = new Error('Lot quantity not set');
            error.statusCode = 500;
            throw error;
        }

        // Patch 1: Lock the lot row to prevent race conditions on quantity check
        await StockIntakeLine.findByPk(lot.id, { transaction, lock: 'UPDATE' });

        // Resolve colour by UUID
        const colour = await Colour.findOne({
            where: { uuid: colourUuid, deletedAt: null },
            transaction,
        });

        if (!colour) {
            const error = new Error('Colour not found');
            error.statusCode = 404;
            throw error;
        }

        // Validate colour is active
        if (!colour.isActive) {
            const error = new Error('Colour is inactive');
            error.statusCode = 400;
            throw error;
        }

        // Resolve size by UUID
        const size = await Size.findOne({
            where: { uuid: sizeUuid, deletedAt: null },
            transaction,
        });

        if (!size) {
            const error = new Error('Size not found');
            error.statusCode = 404;
            throw error;
        }

        // Validate size is active
        if (!size.isActive) {
            const error = new Error('Size is inactive');
            error.statusCode = 400;
            throw error;
        }

        // Validate barcode uniqueness: check if barcode is already bound to a non-deleted unit
        const existingUnit = await Unit.findOne({
            where: {
                barcode,
                deletedAt: null,
            },
            attributes: ['uuid', 'barcode', 'status', 'colourId', 'sizeId'],
            include: [
                {
                    model: Colour,
                    as: 'colour',
                    attributes: ['uuid'],
                },
                {
                    model: Size,
                    as: 'size',
                    attributes: ['uuid'],
                },
            ],
            transaction,
        });

        if (existingUnit) {
            const error = new Error(
                `Barcode already bound to unit ${existingUnit.uuid} (status: ${existingUnit.status}, colour: ${existingUnit.colour.uuid}, size: ${existingUnit.size.uuid})`
            );
            error.statusCode = 409;
            throw error;
        }

        // Validate lot quantity not reached: count non-deleted units in this lot
        const unitCount = await Unit.count({
            where: {
                stockIntakeLineId: lot.id,
                deletedAt: null,
            },
            transaction,
        });

        if (unitCount >= lot.quantity) {
            const error = new Error(
                `Lot has reached its declared quantity of ${lot.quantity}`
            );
            error.statusCode = 400;
            throw error;
        }

        // Create unit atomically with its first status event (delegation to units.service, AD-8)
        const unit = await createUnitFromScan({
            lot,
            colour,
            size,
            barcode,
            actorUserId,
            transaction,
        });

        // Enrich DTO with UUIDs from resolved models
        const enrichedUnit = {
            ...unit,
            stockIntakeLineUuid,
            colourUuid,
            sizeUuid,
        };

        await transaction.commit();
        return enrichedUnit;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};
