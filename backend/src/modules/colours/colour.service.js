import { Colour, sequelize } from '../../../database/models/index.js';

export const getColours = async () => {
    const colours = await Colour.findAll({
        attributes: ['uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
    });

    return colours;
};

export const createColour = async ({ name }) => {
    const transaction = await sequelize.transaction();

    try {
        // Check for duplicate active colour with same name (deactivated names are reusable per Story 2.2)
        const existing = await Colour.findOne({
            where: { name, isActive: true, deletedAt: null },
            transaction,
        });

        if (existing) {
            const error = new Error('Colour already exists');
            error.statusCode = 409;
            throw error;
        }

        // Create the colour
        const colour = await Colour.create({
            name,
        }, { transaction });

        await transaction.commit();
        return colour;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getColourByUuid = async (uuid) => {
    const colour = await Colour.findOne({
        where: { uuid },
        attributes: ['uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!colour) {
        const error = new Error('Colour not found');
        error.statusCode = 404;
        throw error;
    }

    return colour;
};

export const updateColour = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const colour = await Colour.findOne({
            where: { uuid },
            attributes: ['id', 'uuid', 'name', 'isActive', 'createdAt', 'updatedAt'],
            transaction,
        });

        if (!colour) {
            const error = new Error('Colour not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};

        // Handle name update
        if (data.name !== undefined) {
            updateData.name = data.name;

            // Check for name duplicates if name is being updated (only active colours block name reuse)
            const existing = await Colour.findOne({
                where: { name: data.name, isActive: true, deletedAt: null },
                transaction,
            });

            if (existing && existing.id !== colour.id) {
                const error = new Error('Colour already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        // Handle isActive update
        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        await colour.update(updateData, { transaction });

        await transaction.commit();
        return colour;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const deactivateColour = async (uuid) => {
    const colour = await Colour.findOne({
        where: { uuid },
    });

    if (!colour) {
        const error = new Error('Colour not found');
        error.statusCode = 404;
        throw error;
    }

    await colour.update({ isActive: false });

    return colour;
};
