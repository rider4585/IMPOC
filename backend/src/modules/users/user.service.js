import {Op} from 'sequelize';
import {USER_STATUS} from "../../constants/user-status.js";
import {PERMISSIONS} from '../../constants/permissions.js';
import {
    User,
    Role,
    UserRole,
    sequelize,
} from '../../../database/models/index.js';

import {hashPassword} from '../auth/password.service.js';
import {userHasPermission} from '../auth/permission.service.js';

const forbidden = (message) => {
    const error = new Error(message);
    error.statusCode = 403;
    throw error;
};

const isPrivilegedRole = (role) => role.isPrivileged === true;

const getUserWithRoles = async (uuid) => {
    return User.findOne({
        where: {
            uuid,
            status: {
                [Op.ne]: USER_STATUS.DELETED,
            },
        },
        include: {
            model: Role,
            as: 'roles',
            through: {
                attributes: [],
            },
        },
    });
};

const hasPrivilegedRole = (user) =>
    Array.isArray(user?.roles) &&
    user.roles.some(isPrivilegedRole);

const isLastActiveAdmin = async (userUuid) => {
    const user = await User.findOne({
        where: {
            uuid: userUuid,
        },
        attributes: ['id'],
    });

    if (!user) {
        return false;
    }

    const adminRole = await Role.findOne({
        where: {
            name: 'ADMIN',
        },
        attributes: ['id'],
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
    });

    const targetHasAdminRole = await UserRole.findOne({
        where: {
            userId: user.id,
            roleId: adminRole.id,
        },
    });

    return targetHasAdminRole && activeAdminCount <= 1;
};

const assertCanMutatePrivileged = async (actorUuid, targetUser) => {
    const actorPrivileged = await userHasPermission(
        actorUuid,
        PERMISSIONS.USERS.ASSIGN_ROLE
    );

    if (hasPrivilegedRole(targetUser) && !actorPrivileged) {
        forbidden(
            'Only an admin can update or suspend privileged users'
        );
    }
};

const assertNotLastActiveAdmin = async (userUuid) => {
    if (await isLastActiveAdmin(userUuid)) {
        forbidden('Cannot demote, suspend, or delete the last active admin');
    }
};

export const getUsers = async () => {
    const users = await User.findAll({
        where: {
            status: {
                [Op.ne]: USER_STATUS.DELETED,
            },
        },
        attributes: [
            'uuid',
            'username',
            'email',
            'firstName',
            'lastName',
            'phone',
            'status',
            'lastLoginAt',
            'createdAt',
            'updatedAt',
        ],
        include: {
            model: Role,
            as: 'roles',
            attributes: ['uuid', 'name', 'description'],
            through: {
                attributes: [],
            },
        },
        order: [['createdAt', 'DESC']],
    });

    return users;
};

export const createUser = async ({username, email, password, firstName, lastName, phone, roleUuid}, actorUuid) => {
    const transaction = await sequelize.transaction();

    try {
        const normalizedUsername = username.toLowerCase();

        const existingUser = await User.findOne({
            where: {
                username: normalizedUsername,
            },
            transaction,
        });

        if (existingUser) {
            const error = new Error('Username already exists');
            error.statusCode = 409;
            throw error;
        }

        if (email) {
            email = email.toLowerCase();

            const existingEmail = await User.findOne({
                where: {
                    email,
                },
                transaction,
            });

            if (existingEmail) {
                const error = new Error('Email already exists');
                error.statusCode = 409;
                throw error;
            }
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

        if (isPrivilegedRole(role)) {
            const actorPrivileged = await userHasPermission(
                actorUuid,
                PERMISSIONS.USERS.ASSIGN_ROLE
            );

            if (!actorPrivileged) {
                forbidden(
                    'Only an admin can create a user with a privileged role'
                );
            }
        }

        const passwordHash = await hashPassword(password);

        const user = await User.create(
            {
                username: normalizedUsername,
                email,
                passwordHash,
                firstName,
                lastName,
                phone,
                status: USER_STATUS.ACTIVE,
            },
            {
                transaction,
            }
        );

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

        return user;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const getUserByUuid = async (uuid) => {
    const user = await User.findOne({
        where: {
            uuid,
            status: {
                [Op.ne]: USER_STATUS.DELETED,
            },
        },
        attributes: [
            'uuid',
            'username',
            'email',
            'firstName',
            'lastName',
            'phone',
            'status',
            'lastLoginAt',
            'createdAt',
            'updatedAt',
        ],
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

    return user;
};

export const updateUser = async (uuid, data, actorUuid) => {
    const user = await getUserWithRoles(uuid);

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    await assertCanMutatePrivileged(actorUuid, user);

    const updateData = {};

    if (data.username !== undefined) {
        const normalizedUsername = data.username.toLowerCase();

        const existingUser = await User.findOne({
            where: {
                username: normalizedUsername,
            },
        });

        if (
            existingUser &&
            existingUser.id !== user.id
        ) {
            const error = new Error('Username already exists');
            error.statusCode = 409;
            throw error;
        }

        updateData.username = normalizedUsername;
    }

    if (data.email !== undefined) {
        const normalizedEmail = data.email
            ? data.email.toLowerCase()
            : null;

        if (normalizedEmail) {
            const existingUser = await User.findOne({
                where: {
                    email: normalizedEmail,
                },
            });

            if (
                existingUser &&
                existingUser.id !== user.id
            ) {
                const error = new Error('Email already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        updateData.email = normalizedEmail;
    }

    if (data.firstName !== undefined) {
        updateData.firstName = data.firstName;
    }

    if (data.lastName !== undefined) {
        updateData.lastName = data.lastName;
    }

    if (data.phone !== undefined) {
        updateData.phone = data.phone;
    }

    await user.update(updateData);

    return user;
};

export const updateUserStatus = async (uuid, status, actorUuid) => {
    const user = await getUserWithRoles(uuid);

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    await assertCanMutatePrivileged(actorUuid, user);

    if (status !== USER_STATUS.ACTIVE) {
        await assertNotLastActiveAdmin(uuid);
    }

    if (user.status === status) {
        const error = new Error(`User is already ${status}`);
        error.statusCode = 409;
        throw error;
    }

    await user.update({
        status,
    });

    return user;
};

export const deleteUser = async (uuid, actorUuid) => {
    const user = await getUserWithRoles(uuid);

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    await assertCanMutatePrivileged(actorUuid, user);

    if (user.status !== USER_STATUS.DELETED) {
        await assertNotLastActiveAdmin(uuid);
    }

    if (user.status === USER_STATUS.DELETED) {
        const error = new Error('User is already deleted');
        error.statusCode = 409;
        throw error;
    }

    await user.update({
        status: USER_STATUS.DELETED,
    });

    return user;
};