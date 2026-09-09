import {
    User,
    Role,
    Permission,
} from '../../../database/models/index.js';

export const getUserPermissions = async (userUuid) => {
    const user = await User.findOne({
        where: {
            uuid: userUuid,
        },
        attributes: ['id', 'uuid', 'status'],
        include: {
            model: Role,
            as: 'roles',
            attributes: ['id', 'uuid', 'name'],
            through: {
                attributes: [],
            },
            include: {
                model: Permission,
                as: 'permissions',
                attributes: ['id', 'uuid', 'name'],
                through: {
                    attributes: [],
                },
            },
        },
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 401;
        throw error;
    }

    if (user.status === null || user.status === undefined) {
        const error = new Error('User account status is invalid');
        error.statusCode = 500;
        throw error;
    }

    if (user.status !== 'ACTIVE') {
        const error = new Error('User account is inactive');
        error.statusCode = 403;
        throw error;
    }

    const permissions = new Set();

    for (const role of user.roles) {
        for (const permission of role.permissions) {
            permissions.add(permission.name);
        }
    }

    return permissions;
};

export const userHasPermission = async (
    userUuid,
    requiredPermission
) => {
    const permissions = await getUserPermissions(userUuid);

    return permissions.has(requiredPermission);
};

/*
 * SEC-M-5: roles with a broad read scope may list/get records created by any
 * user. Everyone else only sees records they created themselves.
 */
const BROAD_READ_ROLE_NAMES = new Set(['ADMIN', 'MANAGER']);

export const getUserRoleNames = async (userUuid) => {
    const user = await User.findOne({
        where: { uuid: userUuid },
        attributes: ['id', 'uuid'],
        include: {
            model: Role,
            as: 'roles',
            attributes: ['name'],
            through: {
                attributes: [],
            },
        },
    });

    if (!user) {
        return [];
    }

    return user.roles.map((role) => role.name);
};

export const userHasBroadReadScope = async (userUuid) => {
    if (!userUuid) {
        return false;
    }

    const roleNames = await getUserRoleNames(userUuid);

    return roleNames.some((name) => BROAD_READ_ROLE_NAMES.has(name));
};