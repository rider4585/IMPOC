import { createCustomerSourceSchema, customerSourceUuidParamSchema, updateCustomerSourceSchema } from './customer-source.validation.js';
import {
    getCustomerSources as getCustomerSourcesList,
    createCustomerSource as createCustomerSourceService,
    getCustomerSourceByUuid as getCustomerSourceByUuidService,
    updateCustomerSource as updateCustomerSourceService,
} from './customer-source.service.js';

/**
 * Map customer source to DTO response
 * @returns {Object} DTO with uuid, name, isActive, createdAt, updatedAt
 */
function mapCustomerSourceDTO(customerSource) {
    return {
        uuid: customerSource.uuid,
        name: customerSource.name,
        isActive: customerSource.isActive,
        createdAt: customerSource.createdAt,
        updatedAt: customerSource.updatedAt,
    };
}

export const getCustomerSources = async (req, res, next) => {
    try {
        const customerSources = await getCustomerSourcesList();

        return res.status(200).json({
            success: true,
            data: customerSources.map(mapCustomerSourceDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createCustomerSource = async (req, res, next) => {
    try {
        const data = createCustomerSourceSchema.parse(req.body);

        const customerSource = await createCustomerSourceService(data);

        return res.status(201).json({
            success: true,
            data: mapCustomerSourceDTO(customerSource),
        });
    } catch (error) {
        next(error);
    }
};

export const getCustomerSourceByUuid = async (req, res, next) => {
    try {
        const { uuid } = customerSourceUuidParamSchema.parse(req.params);

        const customerSource = await getCustomerSourceByUuidService(uuid);

        return res.status(200).json({
            success: true,
            data: mapCustomerSourceDTO(customerSource),
        });
    } catch (error) {
        next(error);
    }
};

export const updateCustomerSource = async (req, res, next) => {
    try {
        const { uuid } = customerSourceUuidParamSchema.parse(req.params);
        const data = updateCustomerSourceSchema.parse(req.body);

        const customerSource = await updateCustomerSourceService(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapCustomerSourceDTO(customerSource),
        });
    } catch (error) {
        next(error);
    }
};