import { createSizeSchema, sizeUuidParamSchema, updateSizeSchema } from './size.validation.js';
import {
    getSizes as getSizesList,
    createSize as createSizeAccount,
    getSizeByUuid as getSizeByUuidAccount,
    updateSize as updateSizeAccount,
} from './size.service.js';

/**
 * Map size to DTO response
 * @param {Object} size - Size from service
 * @returns {Object} DTO with uuid, name, isActive, createdAt, updatedAt
 */
function mapSizeDTO(size) {
    return {
        uuid: size.uuid,
        name: size.name,
        isActive: size.isActive,
        createdAt: size.createdAt,
        updatedAt: size.updatedAt,
    };
}

export const getSizes = async (req, res, next) => {
    try {
        const sizes = await getSizesList();

        return res.status(200).json({
            success: true,
            data: sizes.map(mapSizeDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createSize = async (req, res, next) => {
    try {
        const data = createSizeSchema.parse(req.body);

        const size = await createSizeAccount(data);

        return res.status(201).json({
            success: true,
            data: mapSizeDTO(size),
        });
    } catch (error) {
        next(error);
    }
};

export const getSizeByUuid = async (req, res, next) => {
    try {
        const { uuid } = sizeUuidParamSchema.parse(req.params);

        const size = await getSizeByUuidAccount(uuid);

        return res.status(200).json({
            success: true,
            data: mapSizeDTO(size),
        });
    } catch (error) {
        next(error);
    }
};

export const updateSize = async (req, res, next) => {
    try {
        const { uuid } = sizeUuidParamSchema.parse(req.params);

        const data = updateSizeSchema.parse(req.body);

        const size = await updateSizeAccount(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapSizeDTO(size),
        });
    } catch (error) {
        next(error);
    }
};

