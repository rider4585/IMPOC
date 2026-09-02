import { Vendor, StockIntake, StockIntakeLine, Unit, ProductType, Colour, Size, sequelize } from '../../../database/models/index.js';
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
 * Get vendor history: vendor with nested trips, lots, and units
 * Trips sorted by purchasedOn DESC, lots sorted by createdAt ASC, units sorted by createdAt ASC
 * Variance computed per trip (totalPaidPaise - sum of lot quantities × buying prices)
 * All money fields returned as strings, UUIDs only (no internal id)
 * @param {string} vendorUuid - The vendor UUID
 * @returns {Object} DTO with vendor and nested trips/lots/units
 */
export const getVendorHistory = async (vendorUuid) => {
    try {
        // Query vendor with nested trips, lots, and units
        const vendor = await Vendor.findOne({
            where: { uuid: vendorUuid },
            attributes: ['uuid', 'name', 'phone', 'address', 'notes', 'isActive', 'createdAt', 'updatedAt'],
            include: [
                {
                    model: StockIntake,
                    as: 'stockIntakes',
                    where: { deletedAt: { [Sequelize.Op.is]: null } },
                    attributes: ['uuid', 'purchasedOn', 'totalPaidPaise', 'createdAt', 'updatedAt'],
                    required: false,
                    include: [
                        {
                            model: StockIntakeLine,
                            as: 'lines',
                            where: { deletedAt: { [Sequelize.Op.is]: null } },
                            attributes: ['uuid', 'productTypeId', 'quantity', 'buyingPricePaise', 'sellingPricePaise', 'floorPricePaise', 'channel', 'rentPerDayPaise', 'depositPaise', 'overduePerDayPaise', 'createdAt'],
                            required: false,
                            include: [
                                {
                                    model: ProductType,
                                    as: 'productType',
                                    attributes: ['uuid'],
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
                                            attributes: ['uuid'],
                                            required: false,
                                        },
                                        {
                                            model: Size,
                                            as: 'size',
                                            attributes: ['uuid'],
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
 * variance = totalPaidPaise - sum(line.quantity * line.buyingPricePaise) for non-deleted lines
 * @param {number} stockIntakeId - The stock intake ID
 * @param {number} totalPaidPaise - The total paid amount
 * @param {Array} lines - The lot lines for this trip
 * @returns {number} The variance in paise
 */
export function computeVarianceForTrip(totalPaidPaise, lines) {
    if (!lines || lines.length === 0) {
        return totalPaidPaise;
    }

    const lotSum = lines.reduce((sum, line) => {
        return sum + (line.quantity * Number(line.buyingPricePaise));
    }, 0);

    return totalPaidPaise - lotSum;
}

/**
 * Map vendor and nested data to history DTO
 * Money fields returned as strings, UUIDs only, variance computed per trip
 * Ensures trips are sorted by purchasedOn DESC, lines by createdAt ASC, units by createdAt ASC
 * @param {Object} vendor - Vendor with nested stockIntakes/lines/units
 * @returns {Object} DTO with vendor and trips array
 */
function mapVendorHistoryDTO(vendor) {
    let trips = (vendor.stockIntakes || []);

    // Sort trips by purchasedOn DESC (most recent first)
    trips = trips.sort((a, b) => {
        const dateA = new Date(a.purchasedOn);
        const dateB = new Date(b.purchasedOn);
        return dateB - dateA;
    });

    const mappedTrips = trips.map(trip => {
        // Sort lines by createdAt ASC (creation order)
        let lines = (trip.lines || []);
        lines = lines.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Compute variance for this trip
        const variancePaise = computeVarianceForTrip(Number(trip.totalPaidPaise), lines);

        return {
            uuid: trip.uuid,
            purchasedOn: trip.purchasedOn,
            totalPaidPaise: String(trip.totalPaidPaise),
            variancePaise: String(variancePaise),
            lines: lines.map(line => {
                // Sort units by createdAt ASC (scan order)
                let units = (line.units || []);
                units = units.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                return {
                    uuid: line.uuid,
                    productTypeUuid: line.productType?.uuid || null,
                    quantity: line.quantity,
                    buyingPricePaise: String(line.buyingPricePaise),
                    sellingPricePaise: String(line.sellingPricePaise),
                    floorPricePaise: String(line.floorPricePaise),
                    channel: line.channel,
                    rentPerDayPaise: line.rentPerDayPaise !== null ? String(line.rentPerDayPaise) : null,
                    depositPaise: line.depositPaise !== null ? String(line.depositPaise) : null,
                    overduePerDayPaise: line.overduePerDayPaise !== null ? String(line.overduePerDayPaise) : null,
                    units: units.map(unit => ({
                        uuid: unit.uuid,
                        barcode: unit.barcode,
                        status: unit.status,
                        channel: unit.channel,
                        colour: unit.colour?.uuid || null,
                        size: unit.size?.uuid || null,
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
