import {Op} from 'sequelize';
import {USER_STATUS} from "../../constants/user-status.js";
import {
    User,
    Role,
    UserRole,
    sequelize,
} from '../../../database/models/index.js';

import {hashPassword} from '../auth/password.service.js';

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
        order: [['createdAt', 'DESC']],
    });

    return users;
};

export const createUser = async ({username, email, password, firstName, lastName, phone, roleUuid}) => {
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
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    return user;
};

export const updateUser = async (uuid, data) => {
    const user = await User.findOne({
        where: {
            uuid,
        },
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

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

export const updateUserStatus = async (uuid, status) => {
    const user = await User.findOne({
        where: {
            uuid,
        },
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
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

export const deleteUser = async (uuid) => {
    const user = await User.findOne({
        where: {
            uuid,
        },
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
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