import { ExpenseType, sequelize } from '../../../database/models/index.js';

export const getExpenseTypes = async () => {
    const expenseTypes = await ExpenseType.findAll({
        attributes: ['uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
        order: [['isActive', 'DESC'], ['createdAt', 'DESC']],
    });

    return expenseTypes;
};

export const createExpenseType = async ({ name }) => {
    const transaction = await sequelize.transaction();

    try {
        const existing = await ExpenseType.findOne({
            where: { name, isActive: true, deletedAt: null },
            transaction,
        });

        if (existing) {
            const error = new Error('Expense type already exists');
            error.statusCode = 409;
            throw error;
        }

        const expenseType = await ExpenseType.create({
            name,
        }, { transaction });

        await transaction.commit();
        return expenseType;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getExpenseTypeByUuid = async (uuid) => {
    const expenseType = await ExpenseType.findOne({
        where: { uuid },
        attributes: ['uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!expenseType) {
        const error = new Error('Expense type not found');
        error.statusCode = 404;
        throw error;
    }

    return expenseType;
};

export const updateExpenseType = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const expenseType = await ExpenseType.findOne({
            where: { uuid },
            attributes: ['id', 'uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
            transaction,
        });

        if (!expenseType) {
            const error = new Error('Expense type not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};

        if (data.name !== undefined) {
            updateData.name = data.name;

            const existing = await ExpenseType.findOne({
                where: { name: data.name, isActive: true, deletedAt: null },
                transaction,
            });

            if (existing && existing.id !== expenseType.id) {
                const error = new Error('Expense type already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        await expenseType.update(updateData, { transaction });

        await transaction.commit();
        return expenseType;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const deactivateExpenseType = async (uuid) => {
    const expenseType = await ExpenseType.findOne({
        where: { uuid },
    });

    if (!expenseType) {
        const error = new Error('Expense type not found');
        error.statusCode = 404;
        throw error;
    }

    await expenseType.update({ isActive: false });

    return expenseType;
};
