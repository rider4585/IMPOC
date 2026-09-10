import { createExpenseTypeSchema, expenseTypeUuidParamSchema, updateExpenseTypeSchema } from './expense-type.validation.js';
import {
    getExpenseTypes as getExpenseTypesList,
    createExpenseType as createExpenseTypeService,
    getExpenseTypeByUuid as getExpenseTypeByUuidService,
    updateExpenseType as updateExpenseTypeService,
} from './expense-type.service.js';

function mapExpenseTypeDTO(expenseType) {
    return {
        uuid: expenseType.uuid,
        name: expenseType.name,
        isActive: expenseType.isActive,
        createdAt: expenseType.createdAt,
        updatedAt: expenseType.updatedAt,
    };
}

export const getExpenseTypes = async (req, res, next) => {
    try {
        const expenseTypes = await getExpenseTypesList();

        return res.status(200).json({
            success: true,
            data: expenseTypes.map(mapExpenseTypeDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createExpenseType = async (req, res, next) => {
    try {
        const data = createExpenseTypeSchema.parse(req.body);

        const expenseType = await createExpenseTypeService(data);

        return res.status(201).json({
            success: true,
            data: mapExpenseTypeDTO(expenseType),
        });
    } catch (error) {
        next(error);
    }
};

export const getExpenseTypeByUuid = async (req, res, next) => {
    try {
        const { uuid } = expenseTypeUuidParamSchema.parse(req.params);

        const expenseType = await getExpenseTypeByUuidService(uuid);

        return res.status(200).json({
            success: true,
            data: mapExpenseTypeDTO(expenseType),
        });
    } catch (error) {
        next(error);
    }
};

export const updateExpenseType = async (req, res, next) => {
    try {
        const { uuid } = expenseTypeUuidParamSchema.parse(req.params);
        const data = updateExpenseTypeSchema.parse(req.body);

        const expenseType = await updateExpenseTypeService(uuid, data);

        return res.status(200).json({
            success: true,
            data: mapExpenseTypeDTO(expenseType),
        });
    } catch (error) {
        next(error);
    }
};
