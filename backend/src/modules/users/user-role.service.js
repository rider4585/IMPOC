import {
    User,
    Role,
    UserRole,
    sequelize,
} from '../../../database/models/index.js';

import { USER_STATUS } from '../../constants/user-status.js';

export const getUserRoles = async (userUuid) => {
    const user = await User.findOne({
        where: {
            uuid: userUuid,
            status: USER_STATUS.ACTIVE,
        },
        attributes: ['uuid', 'username'],
        include: {
            model: Role,
            as: 'roles',
            attributes: ['uuid', 'name', 'description'],
            through: {
                attributes: [],
            },
        },
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    return user.roles;
};

export const assignRoleToUser = async (userUuid, roleUuid) => {
    const transaction = await sequelize.transaction();

    try {
        const user = await User.findOne({
            where: {
                uuid: userUuid,
                status: USER_STATUS.ACTIVE,
            },
            transaction,
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

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

        const existingAssignment =
            await UserRole.findOne({
                where: {
                    userId: user.id,
                    roleId: role.id,
                },
                transaction,
            });

        if (existingAssignment) {
            const error = new Error(
                'User already has this role'
            );
            error.statusCode = 409;
            throw error;
        }

        await UserRole.create(
            {
                userId: user.id,
                roleId: role.id,
            },
            {
                transaction,
            }
        );

        await transaction.commit();

        return role;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const removeRoleFromUser = async (userUuid, roleUuid) => {
    const transaction = await sequelize.transaction();

    try {
        const user = await User.findOne({
            where: {
                uuid: userUuid,
                status: USER_STATUS.ACTIVE,
            },
            transaction,
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

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

        const assignment =
            await UserRole.findOne({
                where: {
                    userId: user.id,
                    roleId: role.id,
                },
                transaction,
            });

        if (!assignment) {
            const error = new Error(
                'User does not have this role'
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