import { Vendor, Trip, TripVendor, Stock, Unit, ProductType, Colour, Size, sequelize } from '../../../database/models/index.js';
import { Sequelize } from 'sequelize';

export const getVendors = async () => {
    const vendors = await Vendor.findAll({
        attributes: ['uuid', 'name', 'phone', 'address', 'notes', 'isActive', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
    });

    return vendors;
};

export const createVendor = async ({ name, phone, address, notes }) => {
    const transaction = await sequelize.transaction();

    try {
        // Create the vendor - partial unique index on name WHERE deleted_at IS NULL
        const vendor = await Vendor.create({
            name,
            phone: phone || null,
            address: address || null,
            notes: notes || null,
        }, { transaction });

        await transaction.commit();
        return vendor;
    } catch (error) {
        await transaction.rollback();
        // Handle unique index violation on active vendors with same name
        if (error.name === 'SequelizeUniqueConstraintError' ||
            error.original?.code === '23505' ||
            error.message?.includes('idx_vendors_name') ||
            error.message?.includes('duplicate key')) {
            const constraintError = new Error('Vendor with this name already exists');
            constraintError.statusCode = 409;
            throw constraintError;
        }
        throw error;
    }
};

export const getVendorByUuid = async (uuid) => {
    const vendor = await Vendor.findOne({
        where: { uuid },
        attributes: ['uuid', 'name', 'phone', 'address', 'notes', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!vendor) {
        const error = new Error('Vendor not found');
        error.statusCode = 404;
        throw error;
    }

    return vendor;
};

export const updateVendor = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const vendor = await Vendor.findOne({
            where: { uuid },
            attributes: ['id', 'uuid', 'name', 'phone', 'address', 'notes', 'isActive', 'createdAt', 'updatedAt'],
            transaction,
        });

        if (!vendor) {
            const error = new Error('Vendor not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};

        // Handle name update
        if (data.name !== undefined) {
            updateData.name = data.name;
        }

        // Handle phone update
        if (data.phone !== undefined) {
            updateData.phone = data.phone || null;
        }

        // Handle address update
        if (data.address !== undefined) {
            updateData.address = data.address || null;
        }

        // Handle notes update
        if (data.notes !== undefined) {
            updateData.notes = data.notes || null;
        }

        // Handle isActive update
        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        await vendor.update(updateData, { transaction });

        await transaction.commit();
        return vendor;
    } catch (error) {
        await transaction.rollback();
        // Handle unique index violation on active vendors with same name
        if (error.name === 'SequelizeUniqueConstraintError' ||
            error.original?.code === '23505' ||
            error.message?.includes('idx_vendors_name') ||
            error.message?.includes('duplicate key')) {
            const constraintError = new Error('Vendor with this name already exists');
            constraintError.statusCode = 409;
            throw constraintError;
        }
        throw error;
    }
};

/**
 * Get vendor history: vendor with nested trip_vendors, stocks, and units
 * Per-vendor purchase history: sorted by trip purchasedOn DESC, stocks by createdAt ASC, units by createdAt ASC
 * Variance computed per trip_vendor (total_paid_paise - sum of stock quantities × buying prices)
 * All money fields returned as strings, UUIDs only (no internal id)
 * @param {string} vendorUuid - The vendor UUID
 * @returns {Object} DTO with vendor and trips array (one entry per trip_vendor bill)
 */
export const getVendorHistory = async (vendorUuid) => {
    try {
        // Query vendor with nested trip_vendors -> trip + stocks + units
        const vendor = await Vendor.findOne({
            where: { uuid: vendorUuid },
            attributes: ['uuid', 'name', 'phone', 'address', 'notes', 'isActive', 'createdAt', 'updatedAt'],
            include: [
                {
                    model: TripVendor,
                    as: 'tripVendors',
                    where: { deletedAt: { [Sequelize.Op.is]: null } },
                    attributes: ['uuid', 'tripId', 'billReference', 'totalPaidPaise', 'notes', 'createdAt'],
                    required: false,
                    include: [
                        {
                            model: Trip,
                            as: 'trip',
                            where: { deletedAt: { [Sequelize.Op.is]: null } },
                            attributes: ['uuid', 'name', 'purchasedOn'],
                            required: false,
                        },
                        {
                            model: Stock,
                            as: 'stocks',
                            where: { deletedAt: { [Sequelize.Op.is]: null } },
                            attributes: ['uuid', 'productTypeId', 'quantity', 'buyingPricePaise', 'sellingPricePaise', 'floorPricePaise', 'channel', 'rentPerDayPaise', 'depositPaise', 'overduePerDayPaise', 'createdAt'],
                            required: false,
                            include: [
                                {
                                    model: ProductType,
                                    as: 'productType',
                                    attributes: ['uuid', 'name'],
                                    required: false,
                                },
                                {
                                    model: ProductType,
                                    as: 'subType',
                                    attributes: ['uuid', 'name'],
                                    required: false,
                                },
                                {
                                    model: Unit,
                                    as: 'units',
                                    where: { deletedAt: { [Sequelize.Op.is]: null } },
                                    attributes: ['uuid', 'barcode', 'status', 'channel', 'buyingPricePaise', 'sellingPricePaise', 'floorPricePaise', 'rentPerDayPaise', 'depositPaise', 'overduePerDayPaise', 'createdAt'],
                                    required: false,
                                    include: [
                                        {
                                            model: Colour,
                                            as: 'colour',
                                            attributes: ['uuid', 'name'],
                                            required: false,
                                        },
                                        {
                                            model: Size,
                                            as: 'size',
                                            attributes: ['uuid', 'name'],
                                            required: false,
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        if (!vendor) {
            const error = new Error('Vendor not found');
            error.statusCode = 404;
            throw error;
        }

        // Map vendor to DTO with nested trips
        return mapVendorHistoryDTO(vendor);
    } catch (error) {
        if (error.statusCode === 404) {
            throw error;
        }
        throw error;
    }
};

/**
 * Compute variance for a specific trip
 * variance = totalPaidPaise - sum(stock.quantity * stock.buyingPricePaise) for non-deleted stocks
 * @param {number} totalPaidPaise - The total paid amount
 * @param {Array} stocks - The stock lines for this trip
 * @returns {number} The variance in paise
 */
export function computeVarianceForTrip(totalPaidPaise, stocks) {
    if (!stocks || stocks.length === 0) {
        return totalPaidPaise;
    }

    const stockSum = stocks.reduce((sum, stock) => {
        return sum + (stock.quantity * Number(stock.buyingPricePaise));
    }, 0);

    return totalPaidPaise - stockSum;
}

function deriveStockName(stock) {
    const parts = [];
    if (stock.productType?.name) parts.push(stock.productType.name);
    if (stock.subType?.name) parts.push(stock.subType.name);
    return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Map vendor and nested data to history DTO
 * Money fields returned as strings, UUIDs only, variance computed per trip_vendor
 * Ensures trips are sorted by purchasedOn DESC, stocks by createdAt ASC, units by createdAt ASC
 * @param {Object} vendor - Vendor with nested tripVendors/stocks/units
 * @returns {Object} DTO with vendor and trips array
 */
function mapVendorHistoryDTO(vendor) {
    let tripVendors = (vendor.tripVendors || []);

    // Sort by trip purchasedOn DESC (most recent first)
    tripVendors = tripVendors.sort((a, b) => {
        const dateA = new Date(a.trip?.purchasedOn || 0);
        const dateB = new Date(b.trip?.purchasedOn || 0);
        return dateB - dateA;
    });

    const mappedTrips = tripVendors.map(tv => {
        // Sort stocks by createdAt ASC (creation order)
        let stocks = (tv.stocks || []);
        stocks = stocks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Compute variance for this vendor's bill on this trip
        const variancePaise = computeVarianceForTrip(Number(tv.totalPaidPaise), stocks);

        return {
            uuid: tv.trip?.uuid || tv.uuid,
            tripVendorUuid: tv.uuid,
            name: tv.trip?.name || null,
            purchasedOn: tv.trip?.purchasedOn || null,
            billReference: tv.billReference,
            totalPaidPaise: String(tv.totalPaidPaise),
            variancePaise: String(variancePaise),
            notes: tv.notes,
            createdAt: tv.createdAt,
            stocks: stocks.map(stock => {
                // Sort units by createdAt ASC (scan order)
                let units = (stock.units || []);
                units = units.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                return {
                    uuid: stock.uuid,
                    stockName: deriveStockName(stock),
                    productTypeUuid: stock.productType?.uuid || null,
                    subTypeUuid: stock.subType?.uuid || null,
                    quantity: stock.quantity,
                    buyingPricePaise: String(stock.buyingPricePaise),
                    sellingPricePaise: String(stock.sellingPricePaise),
                    floorPricePaise: String(stock.floorPricePaise),
                    channel: stock.channel,
                    rentPerDayPaise: stock.rentPerDayPaise !== null ? String(stock.rentPerDayPaise) : null,
                    depositPaise: stock.depositPaise !== null ? String(stock.depositPaise) : null,
                    overduePerDayPaise: stock.overduePerDayPaise !== null ? String(stock.overduePerDayPaise) : null,
                    units: units.map(unit => ({
                        uuid: unit.uuid,
                        barcode: unit.barcode,
                        status: unit.status,
                        channel: unit.channel,
                        colour: unit.colour?.uuid || null,
                        colourName: unit.colour?.name || null,
                        size: unit.size?.uuid || null,
                        sizeName: unit.size?.name || null,
                        buyingPricePaise: String(unit.buyingPricePaise),
                        sellingPricePaise: String(unit.sellingPricePaise),
                        floorPricePaise: String(unit.floorPricePaise),
                        rentPerDayPaise: unit.rentPerDayPaise !== null ? String(unit.rentPerDayPaise) : null,
                        depositPaise: unit.depositPaise !== null ? String(unit.depositPaise) : null,
                        overduePerDayPaise: unit.overduePerDayPaise !== null ? String(unit.overduePerDayPaise) : null,
                    })),
                };
            }),
        };
    });

    return {
        vendor: {
            uuid: vendor.uuid,
            name: vendor.name,
            phone: vendor.phone,
            address: vendor.address,
            notes: vendor.notes,
            isActive: vendor.isActive,
            createdAt: vendor.createdAt,
            updatedAt: vendor.updatedAt,
        },
        trips: mappedTrips,
    };
}
