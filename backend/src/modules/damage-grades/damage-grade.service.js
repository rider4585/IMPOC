import { DamageGrade, sequelize } from '../../../database/models/index.js';

export const getDamageGrades = async () => {
    const damageGrades = await DamageGrade.findAll({
        attributes: ['uuid', 'name', 'outcome', 'isActive', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
    });

    return damageGrades;
};

export const createDamageGrade = async ({ name, outcome }) => {
    const transaction = await sequelize.transaction();

    try {
        // Check for duplicate (active damage grade with same name)
        const existing = await DamageGrade.findOne({
            where: { name, isActive: true, deletedAt: null },
            transaction,
        });

        if (existing) {
            const error = new Error('Damage grade already exists');
            error.statusCode = 409;
            throw error;
        }

        // Create the damage grade
        const damageGrade = await DamageGrade.create({
            name,
            outcome,
        }, { transaction });

        await transaction.commit();
        return damageGrade;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getDamageGradeByUuid = async (uuid) => {
    const damageGrade = await DamageGrade.findOne({
        where: { uuid },
        attributes: ['uuid', 'name', 'outcome', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!damageGrade) {
        const error = new Error('Damage grade not found');
        error.statusCode = 404;
        throw error;
    }

    return damageGrade;
};

export const updateDamageGrade = async (uuid, data) => {
    const transaction = await sequelize.transaction();

    try {
        const damageGrade = await DamageGrade.findOne({
            where: { uuid },
            attributes: ['id', 'uuid', 'name', 'outcome', 'isActive', 'createdAt', 'updatedAt'],
            transaction,
        });

        if (!damageGrade) {
            const error = new Error('Damage grade not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};

        // Handle name update
        if (data.name !== undefined) {
            updateData.name = data.name;

            // Check for name duplicates if name is being updated
            const existing = await DamageGrade.findOne({
                where: { name: data.name, isActive: true, deletedAt: null },
                transaction,
            });

            if (existing && existing.id !== damageGrade.id) {
                const error = new Error('Damage grade already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        // Handle outcome update
        if (data.outcome !== undefined) {
            updateData.outcome = data.outcome;
        }

        // Handle isActive update
        if (data.isActive !== undefined) {
            updateData.isActive = data.isActive;
        }

        await damageGrade.update(updateData, { transaction });

        await transaction.commit();
        return damageGrade;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const deactivateDamageGrade = async (uuid) => {
    const damageGrade = await DamageGrade.findOne({
        where: { uuid },
    });

    if (!damageGrade) {
        const error = new Error('Damage grade not found');
        error.statusCode = 404;
        throw error;
    }

    await damageGrade.update({ isActive: false });

    return damageGrade;
};

