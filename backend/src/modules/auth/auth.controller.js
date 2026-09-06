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

// Refresh-token cookie options. The domain is intentionally NOT hardcoded to
// 'localhost': a host-only cookie (no Domain attribute) works on localhost AND
// on a LAN IP (e.g. 192.168.x.x:5173) when the app is reached from another
// device. Set COOKIE_DOMAIN only when you need a shared/cross-host cookie.
function cookieOptions(refreshToken, expiresAt) {
    const isProduction = process.env.NODE_ENV === 'production';
    const opts = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/',
        expires: expiresAt,
    };
    if (process.env.COOKIE_DOMAIN) {
        opts.domain = process.env.COOKIE_DOMAIN;
    }
    return opts;
}

// Options for clearing the refresh-token cookie. Must mirror cookieOptions
// (path + optional domain + sameSite/secure) so the expiry directive matches
// the cookie as it was set — otherwise a stale cookie survives logout.
function cookieClearOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    const opts = {
        path: '/',
        sameSite: isProduction ? 'strict' : 'lax',
        secure: isProduction,
    };
    if (process.env.COOKIE_DOMAIN) {
        opts.domain = process.env.COOKIE_DOMAIN;
    }
    return opts;
}

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
        try {
            res.cookie('refreshToken', tokens.refreshToken, cookieOptions(tokens.refreshToken, tokens.expiresAt));
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
        try {
            res.cookie('refreshToken', tokens.refreshToken, cookieOptions(tokens.refreshToken, tokens.expiresAt));
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

        res.clearCookie('refreshToken', cookieClearOptions());

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

        res.clearCookie('refreshToken', cookieClearOptions());

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