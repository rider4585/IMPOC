import {
    User,
    AuthSession,
} from '../../../database/models/index.js';

import {
    generateAccessToken,
    hashRefreshToken,
    getSessionUuidFromRefreshToken
} from './token.service.js';

import {
    createAuthSession,
    rotateAuthSession,
} from './auth-session.service.js';

export const createAuthTokens = async (user, telemetry = {}) => {
    const {
        session,
        refreshToken,
    } = await createAuthSession(user, telemetry);

    const accessToken = generateAccessToken({
        userUuid: user.uuid,
        sessionUuid: session.uuid,
    });

    return {
        accessToken,
        refreshToken,
        expiresAt: session.expiresAt,
    };
};

export const refreshAuthTokens = async (
    refreshToken,
    telemetry = {}
) => {
    const sessionUuid =
        getSessionUuidFromRefreshToken(refreshToken);

    if (!sessionUuid) {
        const error = new Error(
            'Invalid refresh token'
        );
        error.statusCode = 401;
        throw error;
    }

    /*
     * We can identify the session even when the supplied
     * refresh token is an old rotated token.
     */
    const session = await AuthSession.findOne({
        where: {
            uuid: sessionUuid,
        },
    });

    if (!session) {
        const error = new Error(
            'Invalid refresh token'
        );
        error.statusCode = 401;
        throw error;
    }

    const user = await User.findByPk(session.userId);

    if (!user || user.status !== 'ACTIVE') {
        const error = new Error(
            'Invalid refresh token'
        );
        error.statusCode = 401;
        throw error;
    }

    const {
        session: rotatedSession,
        refreshToken: newRefreshToken,
    } = await rotateAuthSession(
        session.uuid,
        refreshToken,
        telemetry,
    );

    const accessToken = generateAccessToken({
        userUuid: user.uuid,
        sessionUuid: rotatedSession.uuid,
    });

    return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: rotatedSession.expiresAt,
    };
};