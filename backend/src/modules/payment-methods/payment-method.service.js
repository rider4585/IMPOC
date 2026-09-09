import { PaymentMethod, sequelize } from '../../../database/models/index.js';

export const getPaymentMethods = async () => {
    const paymentMethods = await PaymentMethod.findAll({
        attributes: ['uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
    });

    return paymentMethods;
};

/**
 * SEC-M-8: a paymentMethod snapshot written to the financial ledger (sales /
 * rentals) must be the name of an active payment_methods picklist entry so
 * payment-channel reporting stays clean. Absent/empty values are allowed.
 */
export const assertPaymentMethodInPicklist = async (name, transaction) => {
    if (name === undefined || name === null || name === '') {
        return;
    }
    const method = await PaymentMethod.findOne({
        where: { name, isActive: true, deletedAt: null },
        attributes: ['id'],
        transaction,
    });
    if (!method) {
        const error = new Error(`paymentMethod '${name}' is not in the payment methods picklist`);
        error.statusCode = 400;
        throw error;
    }
};

export const createPaymentMethod = async ({ name }) => {
    const transaction = await sequelize.transaction();

    try {
        // Check for duplicate active payment method with same name
        // (deactivated names are reusable).
        const existing = await PaymentMethod.findOne({
            where: { name, isActive: true, deletedAt: null },
            transaction,
        });

        if (existing) {
            const error = new Error('Payment method already exists');
            error.statusCode = 409;
            throw error;
        }

        const paymentMethod = await PaymentMethod.create({
            name,
        }, { transaction });

        await transaction.commit();
        return paymentMethod;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getPaymentMethodByUuid = async (uuid) => {
    const paymentMethod = await PaymentMethod.findOne({
        where: { uuid },
        attributes: ['uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!paymentMethod) {
        const error = new Error('Payment method not found');
        error.statusCode = 404;
        throw error;
    }

    return paymentMethod;
};

export const updatePaymentMethod = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const paymentMethod = await PaymentMethod.findOne({
            where: { uuid },
            attributes: ['id', 'uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
            transaction,
        });

        if (!paymentMethod) {
            const error = new Error('Payment method not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};

        // Handle name update
        if (data.name !== undefined) {
            updateData.name = data.name;

            // Check for name duplicates if name is being updated
            // (only active payment methods block name reuse).
            const existing = await PaymentMethod.findOne({
                where: { name: data.name, isActive: true, deletedAt: null },
                transaction,
            });

            if (existing && existing.id !== paymentMethod.id) {
                const error = new Error('Payment method already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        // Handle isActive update
        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        await paymentMethod.update(updateData, { transaction });

        await transaction.commit();
        return paymentMethod;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const deactivatePaymentMethod = async (uuid) => {
    const paymentMethod = await PaymentMethod.findOne({
        where: { uuid },
    });

    if (!paymentMethod) {
        const error = new Error('Payment method not found');
        error.statusCode = 404;
        throw error;
    }

    await paymentMethod.update({ isActive: false });

    return paymentMethod;
};