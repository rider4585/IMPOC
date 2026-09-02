import {
    loginSchema,
    refreshTokenSchema,
} from './auth.validation.js';

import {
    login as loginUser,
    getCurrentUser as getCurrentUserAccount,
} from './auth.service.js';

import { refreshAuthTokens } from './auth-token.service.js';

import { revokeAuthSession, revokeAllAuthSessions } from './auth-session.service.js';

import { getUserPermissions } from './permission.service.js';

export const login = async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);

        const {
            user,
            tokens,
        } = await loginUser(data);

        const permissionsSet = await getUserPermissions(user.uuid);
        const permissions = Array.from(permissionsSet).sort();

        // Set refresh token as an httpOnly cookie
        const isProduction = process.env.NODE_ENV === 'production';
        try {
            res.cookie('refreshToken', tokens.refreshToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'strict' : 'lax',
                path: '/',
                domain: isProduction ? undefined : 'localhost',
                expires: tokens.expiresAt,
            });
        } catch (cookieError) {
            const error = new Error('Failed to set refresh token cookie');
            error.statusCode = 500;
            throw error;
        }

        const response = {
            success: true,
            data: {
                uuid: user.uuid,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                status: user.status,
                lastLoginAt: user.lastLoginAt,
                permissions: permissions,
                accessToken: tokens.accessToken,
                refreshTokenExpiresAt: tokens.expiresAt,
            },
        };
        return res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

export const refresh = async (req, res, next) => {
    try {
        refreshTokenSchema.parse(req.body);

        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            const error = new Error('No refresh token in cookie');
            error.statusCode = 400;
            throw error;
        }

        const tokens = await refreshAuthTokens(refreshToken);

        // Set new refresh token as an httpOnly cookie
        const isProduction = process.env.NODE_ENV === 'production';
        try {
            res.cookie('refreshToken', tokens.refreshToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'strict' : 'lax',
                path: '/',
                domain: isProduction ? undefined : 'localhost',
                expires: tokens.expiresAt,
            });
        } catch (cookieError) {
            const error = new Error('Failed to set refresh token cookie');
            error.statusCode = 500;
            throw error;
        }

        return res.status(200).json({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                refreshTokenExpiresAt: tokens.expiresAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const logout = async (req, res, next) => {
    try {
        await revokeAuthSession(req.auth.sessionUuid);

        res.clearCookie('refreshToken', { path: '/' });

        return res.status(200).json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        next(error);
    }
};

export const logoutAll = async (req, res, next) => {
    try {
        await revokeAllAuthSessions(req.auth.userUuid);

        res.clearCookie('refreshToken', { path: '/' });

        return res.status(200).json({
            success: true,
            message: 'Logged out from all devices successfully',
        });
    } catch (error) {
        next(error);
    }
};

export const getCurrentUser = async (req, res, next) => {
    try {
        const user = await getCurrentUserAccount(
            req.auth.userUuid
        );

        const permissionsSet = await getUserPermissions(req.auth.userUuid);
        const permissions = Array.from(permissionsSet).sort();

        return res.status(200).json({
            success: true,
            data: {
                uuid: user.uuid,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                status: user.status,
                lastLoginAt: user.lastLoginAt,
                permissions: permissions,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};