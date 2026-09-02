import { createDamageGradeSchema, damageGradeUuidParamSchema, updateDamageGradeSchema } from './damage-grade.validation.js';
import {
    getDamageGrades as getDamageGradesList,
    createDamageGrade as createDamageGradeAccount,
    getDamageGradeByUuid as getDamageGradeByUuidAccount,
    updateDamageGrade as updateDamageGradeAccount,
} from './damage-grade.service.js';

/**
 * Map damage grade to DTO response
 * @param {Object} damageGrade - DamageGrade from service
 * @returns {Object} DTO with uuid, name, defaultChargePaise, outcome, isActive, createdAt, updatedAt
 */
function mapDamageGradeDTO(damageGrade) {
    return {
        uuid: damageGrade.uuid,
        name: damageGrade.name,
        defaultChargePaise: damageGrade.defaultChargePaise,
        outcome: damageGrade.outcome,
        isActive: damageGrade.isActive,
        createdAt: damageGrade.createdAt,
        updatedAt: damageGrade.updatedAt,
    };
}

export const getDamageGrades = async (req, res, next) => {
    try {
        const damageGrades = await getDamageGradesList();

        return res.status(200).json({
            success: true,
            data: damageGrades.map(mapDamageGradeDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createDamageGrade = async (req, res, next) => {
    try {
        const data = createDamageGradeSchema.parse(req.body);

        const damageGrade = await createDamageGradeAccount(data);

        return res.status(201).json({
            success: true,
            data: mapDamageGradeDTO(damageGrade),
        });
    } catch (error) {
        next(error);
    }
};

export const getDamageGradeByUuid = async (req, res, next) => {
    try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.params.uuid)) {
            const error = new Error('Invalid UUID format');
            error.statusCode = 400;
            throw error;
        }

        const { uuid } = damageGradeUuidParamSchema.parse(req.params);

        const damageGrade = await getDamageGradeByUuidAccount(uuid);

        return res.status(200).json({
            success: true,
            data: mapDamageGradeDTO(damageGrade),
        });
    } catch (error) {
        next(error);
    }
};

export const updateDamageGrade = async (req, res, next) => {
    try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.params.uuid)) {
            const error = new Error('Invalid UUID format');
            error.statusCode = 400;
            throw error;
        }

        const { uuid } = damageGradeUuidParamSchema.parse(req.params);

        const data = updateDamageGradeSchema.parse(req.body);

        const damageGrade = await updateDamageGradeAccount(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapDamageGradeDTO(damageGrade),
        });
    } catch (error) {
        next(error);
    }
};
