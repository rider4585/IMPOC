import { Size, sequelize } from '../../../database/models/index.js';

export const getSizes = async () => {
    const sizes = await Size.findAll({
        attributes: ['uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
    });

    return sizes;
};

export const createSize = async ({ name }) => {
    const transaction = await sequelize.transaction();

    try {
        // Check for duplicate active size with same name (deactivated names are reusable per Story 2.2)
        const existing = await Size.findOne({
            where: { name, isActive: true, deletedAt: null },
            transaction,
        });

        if (existing) {
            const error = new Error('Size already exists');
            error.statusCode = 409;
            throw error;
        }

        // Create the size
        const size = await Size.create({
            name,
        }, { transaction });

        await transaction.commit();
        return size;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getSizeByUuid = async (uuid) => {
    const size = await Size.findOne({
        where: { uuid },
        attributes: ['uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!size) {
        const error = new Error('Size not found');
        error.statusCode = 404;
        throw error;
    }

    return size;
};

export const updateSize = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const size = await Size.findOne({
            where: { uuid },
            attributes: ['id', 'uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
            transaction,
        });

        if (!size) {
            const error = new Error('Size not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};

        // Handle name update
        if (data.name !== undefined) {
            updateData.name = data.name;

            // Check for name duplicates if name is being updated (only active sizes block name reuse)
            const existing = await Size.findOne({
                where: { name: data.name, isActive: true, deletedAt: null },
                transaction,
            });

            if (existing && existing.id !== size.id) {
                const error = new Error('Size already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        // Handle isActive update
        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        await size.update(updateData, { transaction });

        await transaction.commit();
        return size;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const deactivateSize = async (uuid) => {
    const size = await Size.findOne({
        where: { uuid },
    });

    if (!size) {
        const error = new Error('Size not found');
        error.statusCode = 404;
        throw error;
    }

    await size.update({ isActive: false });

    return size;
};
