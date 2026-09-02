import {
    Role,
    Permission,
    RolePermission,
    sequelize,
} from '../../../database/models/index.js';

export const getRolePermissions = async (roleUuid) => {
    const role = await Role.findOne({
        where: {
            uuid: roleUuid,
        },
        attributes: ['id', 'uuid', 'name', 'description'],
        include: {
            model: Permission,
            as: 'permissions',
            attributes: ['uuid', 'name', 'description'],
            through: {
                attributes: [],
            },
        },
    });

    if (!role) {
        const error = new Error('Role not found');
        error.statusCode = 404;
        throw error;
    }

    return role.permissions;
};

export const assignPermissionToRole = async (
    roleUuid,
    permissionUuid
) => {
    const transaction = await sequelize.transaction();

    try {
        const role = await Role.findOne({
            where: {
                uuid: roleUuid,
            },
            transaction,
        });

        if (!role) {
            const error = new Error('Role not found');
            error.statusCode = 404;
            throw error;
        }

        const permission = await Permission.findOne({
            where: {
                uuid: permissionUuid,
            },
            transaction,
        });

        if (!permission) {
            const error = new Error('Permission not found');
            error.statusCode = 404;
            throw error;
        }

        const existingAssignment =
            await RolePermission.findOne({
                where: {
                    roleId: role.id,
                    permissionId: permission.id,
                },
                transaction,
            });

        if (existingAssignment) {
            const error = new Error(
                'Role already has this permission'
            );
            error.statusCode = 409;
            throw error;
        }

        await RolePermission.create(
            {
                roleId: role.id,
                permissionId: permission.id,
            },
            {
                transaction,
            }
        );

        await transaction.commit();

        return permission;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const removePermissionFromRole = async (
    roleUuid,
    permissionUuid
) => {
    const transaction = await sequelize.transaction();

    try {
        const role = await Role.findOne({
            where: {
                uuid: roleUuid,
            },
            transaction,
        });

        if (!role) {
            const error = new Error('Role not found');
            error.statusCode = 404;
            throw error;
        }

        const permission = await Permission.findOne({
            where: {
                uuid: permissionUuid,
            },
            transaction,
        });

        if (!permission) {
            const error = new Error('Permission not found');
            error.statusCode = 404;
            throw error;
        }

        const assignment =
            await RolePermission.findOne({
                where: {
                    roleId: role.id,
                    permissionId: permission.id,
                },
                transaction,
            });

        if (!assignment) {
            const error = new Error(
                'Role does not have this permission'
            );
            error.statusCode = 404;
            throw error;
        }

        await assignment.destroy({
            transaction,
        });

        await transaction.commit();

        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};