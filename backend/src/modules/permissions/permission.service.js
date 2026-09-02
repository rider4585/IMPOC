import { Permission, RolePermission, sequelize } from '../../../database/models/index.js';

export const getPermissions = async () => {
    const permissions = await Permission.findAll({
        attributes: ['uuid', 'name', 'description', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
    });

    return permissions;
};

export const createPermission = async ({ name, description }) => {
    const normalizedName = name.toLowerCase();

    const existingPermission = await Permission.findOne({
        where: {
            name: normalizedName,
        },
    });

    if (existingPermission) {
        const error = new Error('Permission name already exists');
        error.statusCode = 409;
        throw error;
    }

    const permission = await Permission.create({
        name: normalizedName,
        description,
    });

    return permission;
};

export const getPermissionByUuid = async (uuid) => {
    const permission = await Permission.findOne({
        where: {
            uuid,
        },
        attributes: ['uuid', 'name', 'description', 'createdAt', 'updatedAt'],
    });

    if (!permission) {
        const error = new Error('Permission not found');
        error.statusCode = 404;
        throw error;
    }

    return permission;
};

export const updatePermission = async (uuid, data) => {
    const permission = await Permission.findOne({
        where: {
            uuid,
        },
    });

    if (!permission) {
        const error = new Error('Permission not found');
        error.statusCode = 404;
        throw error;
    }

    const updateData = {};

    if (data.name !== undefined) {
        const normalizedName = data.name.toLowerCase();

        const existingPermission = await Permission.findOne({
            where: {
                name: normalizedName,
            },
        });

        if (existingPermission && existingPermission.id !== permission.id) {
            const error = new Error('Permission name already exists');
            error.statusCode = 409;
            throw error;
        }

        updateData.name = normalizedName;
    }

    if (data.description !== undefined) {
        updateData.description = data.description;
    }

    await permission.update(updateData);

    return permission;
};

export const deletePermission = async (uuid) => {
    const transaction = await sequelize.transaction();

    try {
        const permission = await Permission.findOne({
            where: {
                uuid,
            },
            transaction,
        });

        if (!permission) {
            const error = new Error('Permission not found');
            error.statusCode = 404;
            throw error;
        }

        const assignmentCount = await RolePermission.count({
            where: {
                permissionId: permission.id,
            },
            transaction,
        });

        if (assignmentCount > 0) {
            const error = new Error('Cannot delete permission with assigned roles');
            error.statusCode = 409;
            throw error;
        }

        await permission.destroy({
            transaction,
        });

        await transaction.commit();

        return permission;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};
