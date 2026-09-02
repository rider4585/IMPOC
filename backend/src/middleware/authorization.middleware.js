import { userHasPermission } from '../modules/auth/permission.service.js';

export const authorize = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            if (!req.auth?.userUuid) {
                const error = new Error('Authentication required');
                error.statusCode = 401;
                throw error;
            }

            const hasPermission = await userHasPermission(
                req.auth.userUuid,
                requiredPermission
            );

            if (!hasPermission) {
                const error = new Error('Forbidden');
                error.statusCode = 403;
                throw error;
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};