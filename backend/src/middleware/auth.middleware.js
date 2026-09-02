import jwt from 'jsonwebtoken';

import {
    AuthSession,
    User,
} from '../../database/models/index.js';

const getRequiredEnv = (key) => {
    const value = process.env[key];

    if (!value) {
        throw new Error(
            `Missing required environment variable: ${key}`
        );
    }

    return value;
};

export const authenticate = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization;

        if (!authorization) {
            const error = new Error(
                'Authentication required'
            );
            error.statusCode = 401;
            throw error;
        }

        const [scheme, token] =
            authorization.split(' ');

        if (scheme !== 'Bearer' || !token) {
            const error = new Error(
                'Invalid authorization header'
            );
            error.statusCode = 401;
            throw error;
        }

        const secret = getRequiredEnv(
            'JWT_ACCESS_SECRET'
        );

        const issuer = getRequiredEnv(
            'JWT_ISSUER'
        );

        const audience = getRequiredEnv(
            'JWT_AUDIENCE'
        );

        const payload = jwt.verify(
            token,
            secret,
            {
                issuer,
                audience,
            }
        );

        if (
            payload.type !== 'access' ||
            typeof payload.sub !== 'string' ||
            typeof payload.sessionId !== 'string'
        ) {
            const error = new Error(
                'Invalid access token'
            );
            error.statusCode = 401;
            throw error;
        }

        /*
         * The access token is valid cryptographically,
         * but the associated session must also still
         * be active.
         *
         * This is what makes:
         *
         * - logout
         * - logout all devices
         * - refresh-token reuse revocation
         *
         * invalidate existing access tokens.
         */
        const session = await AuthSession.findOne({
            where: {
                uuid: payload.sessionId,
                revokedAt: null,
            },
        });

        if (!session) {
            const error = new Error(
                'Session has been revoked'
            );
            error.statusCode = 401;
            throw error;
        }

        if (session.expiresAt <= new Date()) {
            const error = new Error(
                'Session has expired'
            );
            error.statusCode = 401;
            throw error;
        }

        /*
         * The session is valid, so expose the
         * authenticated user/session information
         * to downstream controllers.
         */
        req.auth = {
            userUuid: payload.sub,
            sessionUuid: payload.sessionId,
        };

        // Also fetch and attach the user object for controllers that need req.user
        try {
            const user = await User.findOne({
                where: { uuid: payload.sub },
                attributes: ['id', 'uuid', 'username', 'email', 'firstName', 'lastName', 'status'],
            });
            if (user) {
                req.user = user;
            }
        } catch (userError) {
            // Log but don't fail auth if user fetch fails
            console.error('Failed to fetch user for req.user:', userError);
        }

        next();
    } catch (error) {
        if (
            error.name === 'TokenExpiredError' ||
            error.name === 'JsonWebTokenError' ||
            error.name === 'NotBeforeError'
        ) {
            error.statusCode = 401;
            error.message =
                'Invalid or expired access token';
        }

        next(error);
    }
};