import { createColourSchema, colourUuidParamSchema, updateColourSchema } from './colour.validation.js';
import {
    getColours as getColoursList,
    createColour as createColourAccount,
    getColourByUuid as getColourByUuidAccount,
    updateColour as updateColourAccount,
} from './colour.service.js';

/**
 * Map colour to DTO response
 * @param {Object} colour - Colour from service
 * @returns {Object} DTO with uuid, name, isActive, createdAt, updatedAt
 */
function mapColourDTO(colour) {
    return {
        uuid: colour.uuid,
        name: colour.name,
        isActive: colour.isActive,
        createdAt: colour.createdAt,
        updatedAt: colour.updatedAt,
    };
}

export const getColours = async (req, res, next) => {
    try {
        const colours = await getColoursList();

        return res.status(200).json({
            success: true,
            data: colours.map(mapColourDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createColour = async (req, res, next) => {
    try {
        const data = createColourSchema.parse(req.body);

        const colour = await createColourAccount(data);

        return res.status(201).json({
            success: true,
            data: mapColourDTO(colour),
        });
    } catch (error) {
        next(error);
    }
};

export const getColourByUuid = async (req, res, next) => {
    try {
        const { uuid } = colourUuidParamSchema.parse(req.params);

        const colour = await getColourByUuidAccount(uuid);

        return res.status(200).json({
            success: true,
            data: mapColourDTO(colour),
        });
    } catch (error) {
        next(error);
    }
};

export const updateColour = async (req, res, next) => {
    try {
        const { uuid } = colourUuidParamSchema.parse(req.params);

        const data = updateColourSchema.parse(req.body);

        const colour = await updateColourAccount(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapColourDTO(colour),
        });
    } catch (error) {
        next(error);
    }
};

