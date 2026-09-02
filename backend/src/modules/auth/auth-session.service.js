import { randomUUID } from 'crypto';
import { Op } from 'sequelize';

import { User, AuthSession } from '../../../database/models/index.js';

import {
    generateRefreshToken,
    hashRefreshToken,
    getRefreshTokenExpiry,
} from './token.service.js';

export const createAuthSession = async (user) => {
    const sessionUuid = randomUUID();

    const refreshToken = generateRefreshToken(sessionUuid);

    const refreshTokenHash = hashRefreshToken(refreshToken);

    const expiresAt = getRefreshTokenExpiry();

    const session = await AuthSession.create({
        uuid: sessionUuid,
        userId: user.id,
        refreshTokenHash,
        expiresAt,
    });

    return {
        session,
        refreshToken,
    };
};

export const findSessionByRefreshToken = async (refreshToken) => {
    const refreshTokenHash = hashRefreshToken(refreshToken);

    return AuthSession.findOne({
        where: {
            refreshTokenHash,
        },
    });
};

export const rotateAuthSession = async (
    sessionUuid,
    refreshToken
) => {
    const transaction =
        await AuthSession.sequelize.transaction();

    try {
        const refreshTokenHash =
            hashRefreshToken(refreshToken);

        const session = await AuthSession.findOne({
            where: {
                uuid: sessionUuid,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!session) {
            const error = new Error(
                'Invalid refresh token'
            );
            error.statusCode = 401;
            throw error;
        }

        /*
         * A revoked session must never be usable again.
         */
        if (session.revokedAt) {
            const error = new Error(
                'Refresh token reuse detected'
            );
            error.statusCode = 401;
            throw error;
        }

        if (session.expiresAt <= new Date()) {
            const error = new Error(
                'Refresh token expired'
            );
            error.statusCode = 401;
            throw error;
        }

        /*
         * The presented token is not the current token.
         *
         * Because we identified the session from the token,
         * we know this is a previously rotated/reused token.
         *
         * Revoke the entire authentication session.
         */
        if (
            session.refreshTokenHash !==
            refreshTokenHash
        ) {
            await session.update(
                {
                    revokedAt: new Date(),
                },
                {
                    transaction,
                }
            );

            await transaction.commit();

            const error = new Error(
                'Refresh token reuse detected'
            );
            error.statusCode = 401;
            throw error;
        }

        /*
         * Valid refresh token.
         * Rotate it and invalidate the previous token.
         */
        const newRefreshToken =
            generateRefreshToken(session.uuid);

        const newRefreshTokenHash =
            hashRefreshToken(newRefreshToken);

        const newExpiresAt =
            getRefreshTokenExpiry();

        await session.update(
            {
                refreshTokenHash: newRefreshTokenHash,
                expiresAt: newExpiresAt,
                lastUsedAt: new Date(),
            },
            {
                transaction,
            }
        );

        await transaction.commit();

        return {
            session,
            refreshToken: newRefreshToken,
        };
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }

        throw error;
    }
};

export const revokeAuthSession = async (sessionUuid) => {
    const [updatedRows] = await AuthSession.update(
        {
            revokedAt: new Date(),
        },
        {
            where: {
                uuid: sessionUuid,
                revokedAt: null,
            },
        }
    );

    if (updatedRows === 0) {
        const error = new Error('Authentication session not found');
        error.statusCode = 404;
        throw error;
    }
};

export const revokeAllAuthSessions = async (userUuid) => {
    const user = await User.findOne({
        where: {
            uuid: userUuid,
        },
        attributes: ['id'],
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    await AuthSession.update(
        {
            revokedAt: new Date(),
        },
        {
            where: {
                userId: user.id,
                revokedAt: null,
            },
        }
    );
};

export const getUserSessions = async (userId) => {
    const sessions = await AuthSession.findAll({
        where: {
            userId,
        },
        attributes: ['uuid', 'expiresAt', 'revokedAt', 'lastUsedAt', 'createdAt'],
        order: [['createdAt', 'DESC']],
    });

    return sessions;
};

export const getSessionByUuid = async (uuid, userId) => {
    const session = await AuthSession.findOne({
        where: {
            uuid,
            userId,
        },
        attributes: ['uuid', 'expiresAt', 'revokedAt', 'lastUsedAt', 'createdAt', 'updatedAt'],
    });

    if (!session) {
        const error = new Error('Session not found');
        error.statusCode = 404;
        throw error;
    }

    return session;
};

export const revokeSingleSession = async (uuid, userId) => {
    const session = await AuthSession.findOne({
        where: {
            uuid,
            userId,
        },
    });

    if (!session) {
        const error = new Error('Session not found');
        error.statusCode = 404;
        throw error;
    }

    if (session.revokedAt) {
        const error = new Error('Session is already revoked');
        error.statusCode = 409;
        throw error;
    }

    await session.update({
        revokedAt: new Date(),
    });

    return session;
};