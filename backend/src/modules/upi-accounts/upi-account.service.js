import { UpiAccount, sequelize } from '../../../database/models/index.js';

export const getUpiAccounts = async () => {
    const upiAccounts = await UpiAccount.findAll({
        attributes: ['uuid', 'label', 'vpa', 'isActive', 'createdAt', 'updatedAt'],
        order: [['isActive', 'DESC'], ['createdAt', 'DESC']],
    });

    return upiAccounts;
};

export const createUpiAccount = async ({ label, vpa }) => {
    const transaction = await sequelize.transaction();

    try {
        const existing = await UpiAccount.findOne({
            where: { label, isActive: true, deletedAt: null },
            transaction,
        });

        if (existing) {
            const error = new Error('UPI account already exists');
            error.statusCode = 409;
            throw error;
        }

        const upiAccount = await UpiAccount.create({
            label,
            vpa,
        }, { transaction });

        await transaction.commit();
        return upiAccount;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getUpiAccountByUuid = async (uuid) => {
    const upiAccount = await UpiAccount.findOne({
        where: { uuid },
        attributes: ['uuid', 'label', 'vpa', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!upiAccount) {
        const error = new Error('UPI account not found');
        error.statusCode = 404;
        throw error;
    }

    return upiAccount;
};

export const updateUpiAccount = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const upiAccount = await UpiAccount.findOne({
            where: { uuid },
            attributes: ['id', 'uuid', 'label', 'vpa', 'isActive', 'createdAt', 'updatedAt'],
            transaction,
        });

        if (!upiAccount) {
            const error = new Error('UPI account not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};

        if (data.label !== undefined) {
            updateData.label = data.label;

            const existing = await UpiAccount.findOne({
                where: { label: data.label, isActive: true, deletedAt: null },
                transaction,
            });

            if (existing && existing.id !== upiAccount.id) {
                const error = new Error('UPI account already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        if (data.vpa !== undefined) {
            updateData.vpa = data.vpa;
        }

        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        await upiAccount.update(updateData, { transaction });

        await transaction.commit();
        return upiAccount;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};
