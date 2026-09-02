import { createVendorSchema, vendorUuidParamSchema, updateVendorSchema } from './vendor.validation.js';
import {
    getVendors as getVendorsList,
    createVendor as createVendorAccount,
    getVendorByUuid as getVendorByUuidAccount,
    updateVendor as updateVendorAccount,
    getVendorHistory as getVendorHistoryService,
} from './vendor.service.js';

/**
 * Map vendor to DTO response
 * @param {Object} vendor - Vendor from service
 * @returns {Object} DTO with uuid, name, phone, address, notes, isActive, createdAt, updatedAt
 */
function mapVendorDTO(vendor) {
    return {
        uuid: vendor.uuid,
        name: vendor.name,
        phone: vendor.phone,
        address: vendor.address,
        notes: vendor.notes,
        isActive: vendor.isActive,
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt,
    };
}

export const getVendors = async (req, res, next) => {
    try {
        const vendors = await getVendorsList();

        return res.status(200).json({
            success: true,
            data: vendors.map(mapVendorDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createVendor = async (req, res, next) => {
    try {
        const data = createVendorSchema.parse(req.body);

        const vendor = await createVendorAccount(data);

        return res.status(201).json({
            success: true,
            data: mapVendorDTO(vendor),
        });
    } catch (error) {
        next(error);
    }
};

export const getVendorByUuid = async (req, res, next) => {
    try {
        const { uuid } = vendorUuidParamSchema.parse(req.params);

        const vendor = await getVendorByUuidAccount(uuid);

        return res.status(200).json({
            success: true,
            data: mapVendorDTO(vendor),
        });
    } catch (error) {
        next(error);
    }
};

export const updateVendor = async (req, res, next) => {
    try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.params.uuid)) {
            const error = new Error('Invalid UUID format');
            error.statusCode = 400;
            throw error;
        }

        const { uuid } = vendorUuidParamSchema.parse(req.params);

        const data = updateVendorSchema.parse(req.body);

        const vendor = await updateVendorAccount(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapVendorDTO(vendor),
        });
    } catch (error) {
        next(error);
    }
};

export const getVendorHistory = async (req, res, next) => {
    try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.params.uuid)) {
            const error = new Error('Invalid UUID format');
            error.statusCode = 400;
            throw error;
        }

        const { uuid } = vendorUuidParamSchema.parse(req.params);

        const history = await getVendorHistoryService(uuid);

        return res.status(200).json({
            success: true,
            data: history,
        });
    } catch (error) {
        next(error);
    }
};
