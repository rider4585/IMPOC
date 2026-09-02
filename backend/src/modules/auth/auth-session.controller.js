import { sessionUuidParamSchema } from './auth-session.validation.js';
import {
    getUserSessions as getUserSessionsList,
    getSessionByUuid as getSessionByUuidAccount,
    revokeSingleSession as revokeSessionAccount,
} from './auth-session.service.js';

import { User } from '../../../database/models/index.js';

/*
 * `authenticate` exposes the caller as req.auth.userUuid; there is no req.user
 * anywhere in this codebase. The session services key off the numeric id, so
 * resolve it here the same way revokeAllAuthSessions does.
 */
const resolveUserId = async (req) => {
    const user = await User.findOne({
        where: {
            uuid: req.auth.userUuid,
        },
        attributes: ['id'],
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    return user.id;
};

export const getUserSessions = async (req, res, next) => {
    try {
        const userId = await resolveUserId(req);

        const sessions = await getUserSessionsList(userId);

        return res.status(200).json({
            success: true,
            data: sessions.map((session) => ({
                uuid: session.uuid,
                expiresAt: session.expiresAt,
                revokedAt: session.revokedAt,
                lastUsedAt: session.lastUsedAt,
                createdAt: session.createdAt,
            })),
        });
    } catch (error) {
        next(error);
    }
};

export const getSessionByUuid = async (req, res, next) => {
    try {
        const { uuid } = sessionUuidParamSchema.parse(req.params);
        const userId = await resolveUserId(req);

        const session = await getSessionByUuidAccount(uuid, userId);

        return res.status(200).json({
            success: true,
            data: {
                uuid: session.uuid,
                expiresAt: session.expiresAt,
                revokedAt: session.revokedAt,
                lastUsedAt: session.lastUsedAt,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const revokeSession = async (req, res, next) => {
    try {
        const { uuid } = sessionUuidParamSchema.parse(req.params);
        const userId = await resolveUserId(req);

        const session = await revokeSessionAccount(uuid, userId);

        return res.status(200).json({
            success: true,
            data: {
                uuid: session.uuid,
                revokedAt: session.revokedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};
