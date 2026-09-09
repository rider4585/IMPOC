import jwt from 'jsonwebtoken';

import {
    AuthSession,
    User,
} from '../../database/models/index.js';

import { JWT_ALGORITHM } from '../modules/auth/token.service.js';

import { USER_STATUS } from '../constants/user-status.js';

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
                algorithms: [JWT_ALGORITHM],
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
         *
         * The User is joined so the session can be bound
         * to the token's subject: an access token minted
         * for user A must never be accepted against a
         * session that belongs to user B, and vice-versa.
         */
        const session = await AuthSession.findOne({
            where: {
                uuid: payload.sessionId,
                revokedAt: null,
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'uuid', 'status'],
                },
            ],
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
         * The token subject must be the session's owner.
         *
         * Without this, a token for user A (whose sub we
         * trust) could be re-issued against a session row
         * belonging to user B — the classic "session not
         * bound to sub" impersonation hole.
         */
        if (!session.user || session.user.uuid !== payload.sub) {
            const error = new Error(
                'Invalid access token'
            );
            error.statusCode = 401;
            throw error;
        }

        /*
         * SEC-H-9: A suspended or deleted user must not keep using an access
         * token or session that was issued before the status change. The
         * refresh path already enforces this (auth-token.service.js), but the
         * access-token path only checks the session -, so a deactivated user's
         * still-live session/token would otherwise remain valid until expiry.
         * Surface the identical 401 the refresh path returns for a non-ACTIVE
         * account.
         */
        if (session.user.status !== USER_STATUS.ACTIVE) {
            const error = new Error(
                'Account is suspended'
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