import { Role, UserRole, RolePermission, sequelize } from '../../../database/models/index.js';

export const getRoles = async () => {
    const roles = await Role.findAll({
        attributes: ['uuid', 'name', 'description', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
    });

    return roles;
};

export const createRole = async ({ name, description }) => {
    const normalizedName = name.toUpperCase();

    const existingRole = await Role.findOne({
        where: {
            name: normalizedName,
        },
    });

    if (existingRole) {
        const error = new Error('Role name already exists');
        error.statusCode = 409;
        throw error;
    }

    const role = await Role.create({
        name: normalizedName,
        description,
    });

    return role;
};

export const getRoleByUuid = async (uuid) => {
    const role = await Role.findOne({
        where: {
            uuid,
        },
        attributes: ['uuid', 'name', 'description', 'createdAt', 'updatedAt'],
    });

    if (!role) {
        const error = new Error('Role not found');
        error.statusCode = 404;
        throw error;
    }

    return role;
};

export const updateRole = async (uuid, data) => {
    const role = await Role.findOne({
        where: {
            uuid,
        },
    });

    if (!role) {
        const error = new Error('Role not found');
        error.statusCode = 404;
        throw error;
    }

    const updateData = {};

    if (data.name !== undefined) {
        const normalizedName = data.name.toUpperCase();

        const existingRole = await Role.findOne({
            where: {
                name: normalizedName,
            },
        });

        if (existingRole && existingRole.id !== role.id) {
            const error = new Error('Role name already exists');
            error.statusCode = 409;
            throw error;
        }

        updateData.name = normalizedName;
    }

    if (data.description !== undefined) {
        updateData.description = data.description;
    }

    await role.update(updateData);

    return role;
};

export const deleteRole = async (uuid) => {
    const transaction = await sequelize.transaction();

    try {
        const role = await Role.findOne({
            where: {
                uuid,
            },
            transaction,
        });

        if (!role) {
            const error = new Error('Role not found');
            error.statusCode = 404;
            throw error;
        }

        const userCount = await UserRole.count({
            where: {
                roleId: role.id,
            },
            transaction,
        });

        if (userCount > 0) {
            const error = new Error('Cannot delete role with assigned users');
            error.statusCode = 409;
            throw error;
        }

        await RolePermission.destroy({
            where: {
                roleId: role.id,
            },
            transaction,
        });

        await role.destroy({
            transaction,
        });

        await transaction.commit();

        return role;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};
