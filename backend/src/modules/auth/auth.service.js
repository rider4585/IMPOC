import { User } from '../../../database/models/index.js';
import { verifyPassword } from './password.service.js';
import { createAuthTokens } from './auth-token.service.js';

export const login = async ({ username, password }) => {
    const normalizedUsername = username.toLowerCase();

    const user = await User.findOne({
        where: {
            username: normalizedUsername,
        },
    });

    if (!user) {
        const error = new Error('Invalid username or password');
        error.statusCode = 401;
        throw error;
    }

    if (user.status !== 'ACTIVE') {
        const error = new Error('Invalid username or password');
        error.statusCode = 401;
        throw error;
    }

    const passwordValid = await verifyPassword(
        user.passwordHash,
        password
    );

    if (!passwordValid) {
        const error = new Error('Invalid username or password');
        error.statusCode = 401;
        throw error;
    }

    await user.update({
        lastLoginAt: new Date(),
    });

    const tokens = await createAuthTokens(user);

    return {
        user,
        tokens,
    };
};

export const getCurrentUser = async (userUuid) => {
    const user = await User.findOne({
        where: {
            uuid: userUuid,
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
        error.statusCode = 401;
        throw error;
    }

    if (user.status !== 'ACTIVE') {
        const error = new Error('User account is inactive');
        error.statusCode = 403;
        throw error;
    }

    return user;
};