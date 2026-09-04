import { Stock, Trip, TripVendor, Vendor, ProductType, Unit, Colour, Size, sequelize } from '../../../database/models/index.js';

/**
 * Verify that the given trip exists (access check for nested stock routes)
 * @param {string} tripUuid - Trip UUID to verify access to
 * @param {Object} user - User object from authentication middleware
 * @throws {Error} with statusCode 404 if trip not found
 */
export const verifyTripAccess = async (tripUuid, user) => {
    const trip = await Trip.findOne({
        where: { uuid: tripUuid },
    });

    if (!trip) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
    }
};

/**
 * Create a stock line for a vendor/channel within a trip.
 * The vendor must already be part of the trip (via trip_vendors) so the stock
 * can be attributed to that vendor's bill.
 * @param {Object} params
 * @param {string} params.tripUuid - Trip UUID
 * @param {string} params.vendorUuid - Vendor UUID
 * @param {string} params.productTypeUuid - Product type UUID
 * @param {number} params.quantity - Declared quantity
 * @param {number} params.buyingPricePaise - Buying price (paise)
 * @param {number} params.sellingPricePaise - Selling price (paise)
 * @param {number} params.floorPricePaise - Floor price (paise)
 * @param {string} params.channel - RETAIL or RENTAL
 * @param {number|null} [params.rentPerDayPaise]
 * @param {number|null} [params.depositPaise]
 * @param {number|null} [params.overduePerDayPaise]
 */
export const createStock = async ({
    tripUuid,
    vendorUuid,
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
        const trip = await Trip.findOne({
            where: { uuid: tripUuid },
            transaction,
        });

        if (!trip) {
            const error = new Error('Trip not found');
            error.statusCode = 404;
            throw error;
        }

        // Validate vendor exists and is active
        const vendor = await Vendor.findOne({
            where: { uuid: vendorUuid, deletedAt: null },
            transaction,
        });

        if (!vendor) {
            const error = new Error('Vendor not found');
            error.statusCode = 404;
            throw error;
        }

        if (!vendor.isActive) {
            const error = new Error('Vendor is inactive');
            error.statusCode = 400;
            throw error;
        }

        // The vendor must have a bill recorded on this trip (trip_vendors junction)
        const tripVendor = await TripVendor.findOne({
            where: { tripId: trip.id, vendorId: vendor.id },
            transaction,
        });

        if (!tripVendor) {
            const error = new Error('Vendor is not part of this trip. Add the vendor to the trip first.');
            error.statusCode = 400;
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

        // Create the stock
        const stock = await Stock.create(
            {
                tripId: trip.id,
                tripVendorId: tripVendor.id,
                vendorId: vendor.id,
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

        return mapStockDTO(stock, tripUuid, vendorUuid, productTypeUuid);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getStocksByTrip = async (tripUuid) => {
    // Validate trip exists
    const trip = await Trip.findOne({
        where: { uuid: tripUuid },
    });

    if (!trip) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
    }

    const stocks = await Stock.findAll({
        where: { tripId: trip.id },
        attributes: [
            'id',
            'uuid',
            'tripVendorId',
            'vendorId',
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
            {
                model: Vendor,
                as: 'vendor',
                attributes: ['uuid'],
            },
            {
                model: TripVendor,
                as: 'tripVendor',
                attributes: ['uuid'],
            },
        ],
        order: [['createdAt', 'ASC']],
    });

    return stocks.map((stock) => mapStockDTO(stock, tripUuid, stock.vendor?.uuid || null, stock.productType?.uuid || null));
};

export const getStockByUuid = async (tripUuid, stockUuid) => {
    // Validate trip exists
    const trip = await Trip.findOne({
        where: { uuid: tripUuid },
    });

    if (!trip) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
    }

    const stock = await Stock.findOne({
        where: {
            uuid: stockUuid,
            tripId: trip.id,
        },
        attributes: [
            'id',
            'uuid',
            'tripVendorId',
            'vendorId',
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
            {
                model: Vendor,
                as: 'vendor',
                attributes: ['uuid'],
            },
            {
                model: TripVendor,
                as: 'tripVendor',
                attributes: ['uuid'],
            },
        ],
    });

    if (!stock) {
        const error = new Error('Stock not found');
        error.statusCode = 404;
        throw error;
    }

    // Count non-deleted units scanned into this stock
    const unitsScannedCount = await Unit.count({
        where: {
            stockId: stock.id,
            deletedAt: null,
        },
    });

    const dto = mapStockDTO(stock, tripUuid, stock.vendor?.uuid || null, stock.productType?.uuid || null);
    dto.unitsScannedCount = unitsScannedCount;
    return dto;
};

export const updateStock = async (tripUuid, stockUuid, updates) => {
    const transaction = await sequelize.transaction();

    try {
        // Validate trip exists
        const trip = await Trip.findOne({
            where: { uuid: tripUuid },
            transaction,
        });

        if (!trip) {
            const error = new Error('Trip not found');
            error.statusCode = 404;
            throw error;
        }

        // Find the stock
        const stock = await Stock.findOne({
            where: {
                uuid: stockUuid,
                tripId: trip.id,
            },
            transaction,
        });

        if (!stock) {
            const error = new Error('Stock not found');
            error.statusCode = 404;
            throw error;
        }

        // Get current values for constraint validation
        const currentSellingPrice = updates.sellingPricePaise !== undefined ? updates.sellingPricePaise : stock.sellingPricePaise;
        const currentFloorPrice = updates.floorPricePaise !== undefined ? updates.floorPricePaise : stock.floorPricePaise;
        const currentRentPerDay = updates.rentPerDayPaise !== undefined ? updates.rentPerDayPaise : stock.rentPerDayPaise;
        const currentOverduePerDay = updates.overduePerDayPaise !== undefined ? updates.overduePerDayPaise : stock.overduePerDayPaise;

        // Validate floor price constraint
        if (currentFloorPrice > currentSellingPrice) {
            const error = new Error('Floor price cannot exceed selling price');
            error.statusCode = 400;
            throw error;
        }

        // Validate rental constraint
        if (stock.channel === 'RENTAL' && currentOverduePerDay !== null && currentRentPerDay !== null) {
            if (currentOverduePerDay <= currentRentPerDay) {
                const error = new Error('Overdue per day must be greater than rent per day');
                error.statusCode = 400;
                throw error;
            }
        }

        // Update the stock
        await stock.update(updates, { transaction });

        await transaction.commit();

        // Fetch the product type + vendor UUIDs for the response
        const productType = await ProductType.findOne({
            where: { id: stock.productTypeId },
            attributes: ['uuid'],
        });

        const vendor = await Vendor.findOne({
            where: { id: stock.vendorId },
            attributes: ['uuid'],
        });

        return mapStockDTO(stock, tripUuid, vendor?.uuid || null, productType?.uuid || null);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Scan a barcode into a stock (atomic unit create with INTAKE status event, CAS protected)
 * Delegates unit row insertion to units.service to preserve AD-8's invariant
 * A successful scan inserts both a units row and its first unit_status_events row atomically
 *
 * @param {Object} params
 * @param {string} params.stockUuid - Stock UUID
 * @param {string} params.barcode - Barcode to scan (1-12 chars)
 * @param {string} params.colourUuid - Colour UUID
 * @param {string} params.sizeUuid - Size UUID
 * @param {integer} params.actorUserId - User ID of the actor performing the scan
 * @returns {Object} Created unit DTO
 * @throws {Error} with statusCode property for HTTP mapping
 */
export const scanIntoStock = async ({
    stockUuid,
    barcode,
    colourUuid,
    sizeUuid,
    actorUserId,
}) => {
    // Null check for actorUserId
    if (actorUserId == null) {
        const error = new Error('Actor user ID required');
        error.statusCode = 400;
        throw error;
    }

    const transaction = await sequelize.transaction();

    try {
        const { createUnitFromScan } = await import('../units/units.service.js');

        // Resolve stock by UUID
        const stock = await Stock.findOne({
            where: { uuid: stockUuid },
            transaction,
        });

        if (!stock) {
            const error = new Error('Stock not found');
            error.statusCode = 404;
            throw error;
        }

        // Soft-deleted stock check
        if (stock.deletedAt) {
            const error = new Error('Stock is deleted');
            error.statusCode = 400;
            throw error;
        }

        // Null check for stock.quantity
        if (stock.quantity == null) {
            const error = new Error('Stock quantity not set');
            error.statusCode = 500;
            throw error;
        }

        // Lock the stock row to prevent race conditions on quantity check
        await Stock.findByPk(stock.id, { transaction, lock: 'UPDATE' });

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

        // Validate stock quantity not reached: count non-deleted units in this stock
        const unitCount = await Unit.count({
            where: {
                stockId: stock.id,
                deletedAt: null,
            },
            transaction,
        });

        if (unitCount >= stock.quantity) {
            const error = new Error(
                `Stock has reached its declared quantity of ${stock.quantity}`
            );
            error.statusCode = 400;
            throw error;
        }

        // Create unit atomically with its first status event (delegation to units.service, AD-8)
        const unit = await createUnitFromScan({
            stock,
            colour,
            size,
            barcode,
            actorUserId,
            transaction,
        });

        // Enrich DTO with UUIDs from resolved models
        const stockIdValue = stock.uuid;
        const enrichedUnit = {
            ...unit,
            stockUuid: stockIdValue,
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

/**
 * Map Stock to DTO response
 * Paise values are returned as STRINGS (not Number) to preserve BIGINT precision
 * @param {Object} stock - Stock from database
 * @param {string} tripUuid - Trip UUID
 * @param {string|null} vendorUuid - Vendor UUID (may be null when not eager-loaded)
 * @param {string|null} productTypeUuid - Product Type UUID
 * @returns {Object} DTO
 */
function mapStockDTO(stock, tripUuid, vendorUuid, productTypeUuid) {
    return {
        uuid: stock.uuid,
        tripUuid,
        tripVendorUuid: stock.tripVendor?.uuid || null,
        vendorUuid,
        productTypeUuid,
        quantity: stock.quantity,
        buyingPricePaise: String(stock.buyingPricePaise),
        sellingPricePaise: String(stock.sellingPricePaise),
        floorPricePaise: String(stock.floorPricePaise),
        channel: stock.channel,
        rentPerDayPaise: stock.rentPerDayPaise !== null ? String(stock.rentPerDayPaise) : null,
        depositPaise: stock.depositPaise !== null ? String(stock.depositPaise) : null,
        overduePerDayPaise: stock.overduePerDayPaise !== null ? String(stock.overduePerDayPaise) : null,
        createdAt: stock.createdAt,
        updatedAt: stock.updatedAt,
    };
}