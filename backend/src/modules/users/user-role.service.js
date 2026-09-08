import {
    User,
    Role,
    UserRole,
    sequelize,
} from '../../../database/models/index.js';

import { USER_STATUS } from '../../constants/user-status.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { userHasPermission } from '../auth/permission.service.js';

const forbidden = (message) => {
    const error = new Error(message);
    error.statusCode = 403;
    throw error;
};

const isPrivilegedRole = (role) => role.isPrivileged === true;

export const isPrivilegedActor = async (userUuid) => {
    return userHasPermission(userUuid, PERMISSIONS.USERS.ASSIGN_ROLE);
};

const getActiveUser = async (userUuid, transaction) => {
    const user = await User.findOne({
        where: {
            uuid: userUuid,
            status: USER_STATUS.ACTIVE,
        },
        transaction,
    });

    return user;
};

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

export const assignRoleToUser = async (userUuid, roleUuid, actorUuid) => {
    const transaction = await sequelize.transaction();

    try {
        if (actorUuid === userUuid) {
            forbidden(
                'You cannot assign roles to your own account'
            );
        }

        const actorPrivileged = await isPrivilegedActor(
            actorUuid
        );

        const user = await getActiveUser(userUuid, transaction);

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

        if (isPrivilegedRole(role) && !actorPrivileged) {
            forbidden(
                'Only an admin can assign privileged roles'
            );
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

export const removeRoleFromUser = async (userUuid, roleUuid, actorUuid) => {
    const transaction = await sequelize.transaction();

    try {
        if (actorUuid === userUuid) {
            forbidden(
                'You cannot remove roles from your own account'
            );
        }

        const actorPrivileged = await isPrivilegedActor(
            actorUuid
        );

        const user = await getActiveUser(userUuid, transaction);

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

        if (isPrivilegedRole(role) && !actorPrivileged) {
            forbidden(
                'Only an admin can remove privileged roles'
            );
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

        if (
            isPrivilegedRole(role) &&
            (await isLastActiveAdmin(userUuid, transaction))
        ) {
            forbidden(
                'Cannot demote the last active admin'
            );
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

const isLastActiveAdmin = async (userUuid, transaction) => {
    const user = await User.findOne({
        where: {
            uuid: userUuid,
        },
        attributes: ['id'],
        transaction,
    });

    if (!user) {
        return false;
    }

    const adminRole = await Role.findOne({
        where: {
            name: 'ADMIN',
        },
        attributes: ['id'],
        transaction,
    });

    if (!adminRole) {
        return true;
    }

    const activeAdminCount = await UserRole.count({
        where: {
            roleId: adminRole.id,
        },
        include: [
            {
                model: User,
                as: 'user',
                where: {
                    status: USER_STATUS.ACTIVE,
                },
                attributes: [],
            },
        ],
        transaction,
    });

    const targetHasAdminRole = await UserRole.findOne({
        where: {
            userId: user.id,
            roleId: adminRole.id,
        },
        transaction,
    });

    return targetHasAdminRole && activeAdminCount <= 1;
};
