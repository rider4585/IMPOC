import { CustomerSource, sequelize } from '../../../database/models/index.js';

export const getCustomerSources = async () => {
    const customerSources = await CustomerSource.findAll({
        attributes: ['uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
    });

    return customerSources;
};

export const createCustomerSource = async ({ name }) => {
    const transaction = await sequelize.transaction();

    try {
        // Check for duplicate active customer source with same name
        // (deactivated names are reusable).
        const existing = await CustomerSource.findOne({
            where: { name, isActive: true, deletedAt: null },
            transaction,
        });

        if (existing) {
            const error = new Error('Customer source already exists');
            error.statusCode = 409;
            throw error;
        }

        const customerSource = await CustomerSource.create({
            name,
        }, { transaction });

        await transaction.commit();
        return customerSource;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getCustomerSourceByUuid = async (uuid) => {
    const customerSource = await CustomerSource.findOne({
        where: { uuid },
        attributes: ['uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!customerSource) {
        const error = new Error('Customer source not found');
        error.statusCode = 404;
        throw error;
    }

    return customerSource;
};

export const updateCustomerSource = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const customerSource = await CustomerSource.findOne({
            where: { uuid },
            attributes: ['id', 'uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
            transaction,
        });

        if (!customerSource) {
            const error = new Error('Customer source not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};

        // Handle name update
        if (data.name !== undefined) {
            updateData.name = data.name;

            // Check for name duplicates if name is being updated
            // (only active customer sources block name reuse).
            const existing = await CustomerSource.findOne({
                where: { name: data.name, isActive: true, deletedAt: null },
                transaction,
            });

            if (existing && existing.id !== customerSource.id) {
                const error = new Error('Customer source already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        // Handle isActive update
        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        await customerSource.update(updateData, { transaction });

        await transaction.commit();
        return customerSource;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};