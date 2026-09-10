import { User } from '../../../database/models/index.js';
import { verifyPassword } from './password.service.js';
import { createAuthTokens } from './auth-token.service.js';

/*
 * SEC-L-1: a login for an unknown username must burn the same argon2 cost as
 * a wrong-password login for a known one, otherwise response time reveals
 * whether a username exists (timing oracle for enumeration).
 */
const DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=65536,p=4,t=3$IR7dilh+RZoX/jhQdR0AdQ$x/B6BqkpZ/OJaZGT35b3NyYiDQjIdKHJ5XR342kgbl0';

const runDummyVerify = async (password) => {
    await verifyPassword(DUMMY_PASSWORD_HASH, password);
};

export const login = async ({ username, password }) => {
    const normalizedUsername = username.toLowerCase();

    const user = await User.findOne({
        where: {
            username: normalizedUsername,
        },
    });

    if (!user) {
        // SEC-L-1: never reveal (by timing) that the username does not exist.
        await runDummyVerify(password);

        const error = new Error('Invalid username or password');
        error.statusCode = 401;
        throw error;
    }

    if (user.status !== 'ACTIVE') {
        // SEC-L-1: same dummy compare for the inactive path.
        await runDummyVerify(password);

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