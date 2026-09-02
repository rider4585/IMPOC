import { createProductTypeSchema, productTypeUuidParamSchema, updateProductTypeSchema } from './product-type.validation.js';
import {
    getProductTypes as getProductTypesList,
    createProductType as createProductTypeAccount,
    getProductTypeByUuid as getProductTypeByUuidAccount,
    updateProductType as updateProductTypeAccount,
    deactivateProductType as deactivateProductTypeAccount,
} from './product-type.service.js';

/**
 * Map product type to DTO response
 * @param {Object} type - Product type from service
 * @returns {Object} DTO with uuid, name, parentUuid, isActive, createdAt, updatedAt
 */
function mapProductTypeDTO(type) {
    return {
        uuid: type.uuid,
        name: type.name,
        parentUuid: type.parent?.uuid ?? null,
        isActive: type.isActive,
        createdAt: type.createdAt,
        updatedAt: type.updatedAt,
    };
}

export const getProductTypes = async (req, res, next) => {
    try {
        const types = await getProductTypesList();

        return res.status(200).json({
            success: true,
            data: types.map(mapProductTypeDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createProductType = async (req, res, next) => {
    try {
        const data = createProductTypeSchema.parse(req.body);

        const type = await createProductTypeAccount(data);

        return res.status(201).json({
            success: true,
            data: mapProductTypeDTO(type),
        });
    } catch (error) {
        next(error);
    }
};

export const getProductTypeByUuid = async (req, res, next) => {
    try {
        const { uuid } = productTypeUuidParamSchema.parse(req.params);

        const type = await getProductTypeByUuidAccount(uuid);

        return res.status(200).json({
            success: true,
            data: mapProductTypeDTO(type),
        });
    } catch (error) {
        next(error);
    }
};

export const updateProductType = async (req, res, next) => {
    try {
        const { uuid } = productTypeUuidParamSchema.parse(req.params);

        const data = updateProductTypeSchema.parse(req.body);

        const type = await updateProductTypeAccount(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapProductTypeDTO(type),
        });
    } catch (error) {
        next(error);
    }
};

export const deactivateProductType = async (req, res, next) => {
    try {
        const { uuid } = productTypeUuidParamSchema.parse(req.params);

        const type = await deactivateProductTypeAccount(uuid);

        return res.status(200).json({
            success: true,
            data: mapProductTypeDTO(type),
        });
    } catch (error) {
        next(error);
    }
};
