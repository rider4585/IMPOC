import { Trip, TripVendor, Vendor, Stock, ProductType, sequelize } from '../../../database/models/index.js';
import { Sequelize } from 'sequelize';
import { userHasPermission } from '../auth/permission.service.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const STOCK_INCLUDE = (whereDeleted = { [Sequelize.Op.is]: null }) => ({
    model: Stock,
    as: 'stocks',
    where: { deletedAt: whereDeleted },
    required: false,
    attributes: [
        'id',
        'uuid',
        'tripVendorId',
        'vendorId',
        'productTypeId',
        'quantity',
        'buyingPricePaise',
        'wholeBuyingPricePaise',
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
            model: ProductType,
            as: 'subType',
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
        {
            model: sequelize.model('Unit'),
            as: 'units',
            where: { deletedAt: { [Sequelize.Op.is]: null } },
            required: false,
            attributes: ['id'],
        },
    ],
});

const TRIP_VENDOR_INCLUDE = (whereDeleted = { [Sequelize.Op.is]: null }) => ({
    model: TripVendor,
    as: 'tripVendors',
    where: { deletedAt: whereDeleted },
    required: false,
    attributes: ['id', 'uuid', 'tripId', 'vendorId', 'billReference', 'totalPaidPaise', 'notes', 'receiptImage', 'createdAt', 'updatedAt'],
    include: [
        {
            model: Vendor,
            as: 'vendor',
            attributes: ['uuid', 'name'],
        },
    ],
});

export const listTrips = async () => {
    const trips = await Trip.findAll({
        attributes: ['id', 'uuid', 'name', 'purchasedOn', 'notes', 'status', 'createdAt', 'updatedAt'],
        order: [['purchasedOn', 'DESC'], ['createdAt', 'DESC']],
        include: [TRIP_VENDOR_INCLUDE()],
    });

    // Sum of (whole_buying_price_paise when present, else quantity * buying_price_paise)
    // across all active stocks per trip
    const stockSums = await Stock.findAll({
        attributes: [
            'tripId',
            [Sequelize.fn('SUM', Sequelize.literal('COALESCE(whole_buying_price_paise, quantity * buying_price_paise)')), 'buyingSum'],
        ],
        where: { deletedAt: { [Sequelize.Op.is]: null } },
        group: ['tripId'],
        raw: true,
    });
    const sumByTrip = new Map(stockSums.map((row) => [row.tripId, row.buyingSum != null ? BigInt(row.buyingSum) : 0n]));

    return trips.map((trip) => mapTripDTO(trip, sumByTrip.get(trip.id) ?? 0n));
};

/**
 * Create a trip with optional per-vendor bills.
 * @param {Object} params
 * @param {string} params.name - Trip name
 * @param {string} params.purchasedOn - YYYY-MM-DD
 * @param {string} [params.notes] - Optional notes
 * @param {Array} [params.vendors] - Optional per-vendor bills [{ vendorUuid, billReference, totalPaidPaise, notes }]
 */
export const createTrip = async ({ name, purchasedOn, notes, vendors = [] }) => {
    const transaction = await sequelize.transaction();

    try {
        const trip = await Trip.create(
            {
                name,
                purchasedOn,
                notes: notes || null,
                status: 'active',
            },
            { transaction }
        );

        const createdVendors = [];
        for (const vendorBill of vendors) {
            const vendor = await Vendor.findOne({
                where: { uuid: vendorBill.vendorUuid },
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

            const tripVendor = await TripVendor.create(
                {
                    tripId: trip.id,
                    vendorId: vendor.id,
                    billReference: vendorBill.billReference || null,
                    totalPaidPaise: vendorBill.totalPaidPaise,
                    notes: vendorBill.notes || null,
                    receiptImage: vendorBill.receiptImage || null,
                },
                { transaction }
            );

            createdVendors.push(mapTripVendorDTO(tripVendor, vendor, trip.uuid));
        }

        await transaction.commit();

        const totalPaidPaise = createdVendors.reduce((sum, tv) => sum + BigInt(tv.totalPaidPaise), 0n);

        return {
            uuid: trip.uuid,
            name: trip.name,
            purchasedOn: trip.purchasedOn,
            notes: trip.notes,
            status: trip.status,
            totalPaidPaise: String(totalPaidPaise),
            variancePaise: String(totalPaidPaise),
            vendors: createdVendors,
            createdAt: trip.createdAt,
            updatedAt: trip.updatedAt,
        };
    } catch (error) {
        await transaction.rollback();
        // Handle unique index violation on duplicate vendor within the same trip
        try {
            if (error.name === 'SequelizeUniqueConstraintError' ||
                error.original?.code === '23505' ||
                error.message?.includes('idx_trip_vendors_trip_vendor') ||
                error.message?.includes('duplicate key')) {
                const constraintError = new Error('Vendor already added to this trip');
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

export const getTripByUuid = async (uuid) => {
    const trip = await Trip.findOne({
        where: { uuid },
        attributes: ['id', 'uuid', 'name', 'purchasedOn', 'notes', 'status', 'createdAt', 'updatedAt'],
        include: [TRIP_VENDOR_INCLUDE(), STOCK_INCLUDE()],
    });

    if (!trip) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
    }

    // Derive variance from the nested stocks (stockBuyingSum flag null)
    return mapTripDTO(trip, null);
};

/**
 * Verify that the given user has access to the given trip.
 *
 * The app is single-tenant (trips carry no owner/user tenant column), so the
 * "ownership" boundary is the permission boundary: only a user holding
 * INVENTORY.VIEW may resolve trips at all. An unknown trip stays a 404 so we
 * never reveal whether a trip exists to a caller that merely lacks
 * permission.
 * @param {string} tripUuid - Trip UUID to verify access to
 * @param {Object} user - User object from authentication middleware
 * @throws {Error} with statusCode 404 if trip not found
 * @throws {Error} with statusCode 403 if user lacks INVENTORY.VIEW
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

    if (user == null || user.uuid == null) {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        throw error;
    }

    const hasViewPermission = await userHasPermission(user.uuid, PERMISSIONS.INVENTORY.VIEW);

    if (!hasViewPermission) {
        const error = new Error('Forbidden');
        error.statusCode = 403;
        throw error;
    }
};

/**
 * Add a vendor (with its own bill) to an existing trip.
 * @param {string} tripUuid - Trip UUID
 * @param {Object} data - { vendorUuid, billReference, totalPaidPaise, notes }
 */
export const addTripVendor = async (tripUuid, { vendorUuid, billReference, totalPaidPaise, notes, receiptImage }) => {
    const transaction = await sequelize.transaction();

    try {
        const trip = await Trip.findOne({
            where: { uuid: tripUuid },
            transaction,
        });

        if (!trip) {
            const error = new Error('Trip not found');
            error.statusCode = 404;
            throw error;
        }

        const vendor = await Vendor.findOne({
            where: { uuid: vendorUuid },
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

        const tripVendor = await TripVendor.create(
            {
                tripId: trip.id,
                vendorId: vendor.id,
                billReference: billReference || null,
                totalPaidPaise,
                notes: notes || null,
                receiptImage: receiptImage || null,
            },
            { transaction }
        );

        await transaction.commit();

        return mapTripVendorDTO(tripVendor, vendor, trip.uuid);
    } catch (error) {
        await transaction.rollback();
        // Handle unique index violation on (trip_id, vendor_id)
        try {
            if (error.name === 'SequelizeUniqueConstraintError' ||
                error.original?.code === '23505' ||
                error.message?.includes('idx_trip_vendors_trip_vendor') ||
                error.message?.includes('duplicate key')) {
                const constraintError = new Error('Vendor already added to this trip');
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

export const getLastStockForTrip = async (tripUuid) => {
    // Validate trip exists
    const trip = await Trip.findOne({
        where: { uuid: tripUuid },
    });

    if (!trip) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
    }

    // Query the most recent non-deleted stock for this trip
    // Order by created_at DESC, then id DESC as tiebreaker
    const stock = await Stock.findOne({
        where: {
            tripId: trip.id,
            deletedAt: { [sequelize.Sequelize.Op.is]: null },
        },
        attributes: [
            'uuid',
            'tripVendorId',
            'vendorId',
            'productTypeId',
            'quantity',
            'buyingPricePaise',
            'wholeBuyingPricePaise',
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
            {
                model: ProductType,
                as: 'subType',
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
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });

    if (!stock) {
        const error = new Error('No stocks found to clone for this trip');
        error.statusCode = 404;
        throw error;
    }

    return mapCloneStockDTO(stock);
};

/**
 * Map Trip (with nested tripVendors + optionally stocks) to DTO response.
 * @param {Object} trip - Trip from database
 * @param {number|null} stockBuyingSum - Precomputed sum(quantity * buying), null when stocks are nested
 * @returns {Object} DTO
 */
function mapTripDTO(trip, stockBuyingSum) {
    const tripVendors = trip.tripVendors || [];
    const totalPaidPaise = tripVendors.reduce((sum, tv) => sum + BigInt(tv.totalPaidPaise), 0n);

    let buyingSum;
    if (stockBuyingSum !== null) {
        buyingSum = stockBuyingSum;
    } else {
        buyingSum = (trip.stocks || []).reduce((sum, s) => {
            const cost = s.wholeBuyingPricePaise != null
                ? BigInt(s.wholeBuyingPricePaise)
                : (BigInt(s.quantity) * BigInt(s.buyingPricePaise));
            return sum + cost;
        }, 0n);
    }

    const dto = {
        uuid: trip.uuid,
        name: trip.name,
        purchasedOn: trip.purchasedOn,
        notes: trip.notes,
        status: trip.status,
        totalPaidPaise: String(totalPaidPaise),
        variancePaise: String(totalPaidPaise - buyingSum),
        vendorSummary: tripVendors.map((tv) => ({
            vendorUuid: tv.vendor?.uuid || null,
            vendorName: tv.vendor?.name || null,
            billReference: tv.billReference,
            totalPaidPaise: String(tv.totalPaidPaise),
        })),
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
    };

    if (trip.stocks) {
        dto.vendors = tripVendors.map((tv) => mapTripVendorDTO(tv, tv.vendor, trip.uuid));
        dto.stocks = trip.stocks.map((stock) => mapStockDTO(stock, trip.uuid));
    }

    return dto;
}

/**
 * Map TripVendor to DTO response
 * @param {Object} tripVendor - TripVendor from database
 * @param {Object} vendor - Vendor from database (may be null)
 * @param {string} tripUuid - Trip UUID
 * @returns {Object} DTO
 */
function mapTripVendorDTO(tripVendor, vendor, tripUuid) {
    return {
        uuid: tripVendor.uuid,
        tripUuid,
        vendorUuid: vendor?.uuid || null,
        vendorName: vendor?.name || null,
        billReference: tripVendor.billReference,
        totalPaidPaise: String(tripVendor.totalPaidPaise),
        notes: tripVendor.notes,
        receiptImage: tripVendor.receiptImage ?? null,
        createdAt: tripVendor.createdAt,
        updatedAt: tripVendor.updatedAt,
    };
}

/**
 * Map Stock to DTO response
 * Numeric price fields returned as STRINGS (not Number) to preserve BIGINT precision per AD-24 tier 1
 * @param {Object} stock - Stock from database (may include productType, vendor, tripVendor, units)
 * @param {string} tripUuid - Trip UUID
 * @returns {Object} DTO
 */
function mapStockDTO(stock, tripUuid) {
    const units = stock.units || [];
    return {
        uuid: stock.uuid,
        tripUuid,
        tripVendorUuid: stock.tripVendor?.uuid || null,
        vendorUuid: stock.vendor?.uuid || null,
        productTypeUuid: stock.productType?.uuid || null,
        subTypeUuid: stock.subType?.uuid || null,
        quantity: stock.quantity,
        buyingPricePaise: String(stock.buyingPricePaise),
        wholeBuyingPricePaise: stock.wholeBuyingPricePaise != null ? String(stock.wholeBuyingPricePaise) : null,
        sellingPricePaise: String(stock.sellingPricePaise),
        floorPricePaise: String(stock.floorPricePaise),
        channel: stock.channel,
        rentPerDayPaise: stock.rentPerDayPaise !== null ? String(stock.rentPerDayPaise) : null,
        depositPaise: stock.depositPaise !== null ? String(stock.depositPaise) : null,
        overduePerDayPaise: stock.overduePerDayPaise !== null ? String(stock.overduePerDayPaise) : null,
        unitsScannedCount: units.length,
        createdAt: stock.createdAt,
        updatedAt: stock.updatedAt,
    };
}

/**
 * Map Stock to clone DTO response (GET /api/trips/:tripUuid/clone-last-stock)
 * Numeric fields returned as STRINGS (not Number) to preserve BIGINT precision per AD-24 tier 1
 * NOTE: createdAt is returned for reference (audit trail) only and is READ-ONLY.
 *       Frontend must NOT use this historical timestamp when creating a new stock.
 * @param {Object} stock - Stock from database
 * @returns {Object} DTO
 */
function mapCloneStockDTO(stock) {
    return {
        productTypeUuid: stock.productType?.uuid || null,
        subTypeUuid: stock.subType?.uuid || null,
        vendorUuid: stock.vendor?.uuid || null,
        tripVendorUuid: stock.tripVendor?.uuid || null,
        quantity: stock.quantity,
        buyingPricePaise: String(stock.buyingPricePaise),
        wholeBuyingPricePaise: stock.wholeBuyingPricePaise != null ? String(stock.wholeBuyingPricePaise) : null,
        sellingPricePaise: String(stock.sellingPricePaise),
        floorPricePaise: String(stock.floorPricePaise),
        channel: stock.channel,
        rentPerDayPaise: stock.rentPerDayPaise !== null ? String(stock.rentPerDayPaise) : null,
        depositPaise: stock.depositPaise !== null ? String(stock.depositPaise) : null,
        overduePerDayPaise: stock.overduePerDayPaise !== null ? String(stock.overduePerDayPaise) : null,
        createdAt: stock.createdAt,
    };
}