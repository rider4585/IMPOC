import {
    getAllAdminSessions,
    revokeAuthSession,
    revokeAllAuthSessions,
} from '../auth/auth-session.service.js';

export const getSessions = async (req, res, next) => {
    try {
        const activeOnly = req.query.activeOnly === 'true';
        const currentSessionUuid = req.auth?.sessionUuid || null;

        const { sessions, stats } = await getAllAdminSessions({
            activeOnly,
            currentSessionUuid,
        });

        return res.status(200).json({
            success: true,
            data: {
                sessions,
                stats,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const revokeSession = async (req, res, next) => {
    try {
        const { sessionUuid } = req.params;
        if (!sessionUuid) {
            const error = new Error('Session UUID is required');
            error.statusCode = 400;
            throw error;
        }

        await revokeAuthSession(sessionUuid);

        return res.status(200).json({
            success: true,
            message: 'Session revoked',
        });
    } catch (error) {
        next(error);
    }
};

export const revokeUserSessions = async (req, res, next) => {
    try {
        const { userUuid } = req.params;
        if (!userUuid) {
            const error = new Error('User UUID is required');
            error.statusCode = 400;
            throw error;
        }

        await revokeAllAuthSessions(userUuid);

        return res.status(200).json({
            success: true,
            message: 'All user sessions revoked',
        });
    } catch (error) {
        next(error);
    }
};

export default {
    getSessions,
    revokeSession,
    revokeUserSessions,
};
