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
import { parseClientInfo } from '../../utils/deviceParser.js';

/*
 * The refresh-token cookie is only ever read by the auth endpoints
 * (/login sets it, /refresh rotates it, /logout + /logout-all clear it), so it
 * is scoped to the auth prefix rather than the whole origin. A narrower path
 * shrinks the surface over which the cookie is transmitted.
 */
const REFRESH_COOKIE_PATH = '/api/auth';

/*
 * SEC-H-10: secure-cookie policy for the refresh token.
 *
 * - secure defaults TRUE (fails safe) in every environment, not only production.
 * - COOKIE_SECURE=false is the single documented override. It drops the Secure
 *   flag AND permits issuing over plain HTTP — the escape hatch for a trusted
 *   LAN-HTTP deployment. Without that override, we refuse to set the cookie in
 *   production over plain HTTP: browsers will not send or store a Secure cookie
 *   over http, so setting one there would silently break refresh while the token
 *   also travels unencrypted.
 */
const refreshSecureEnabled = () => {
    if (process.env.COOKIE_SECURE === 'false') {
        return false;
    }
    return true;
};

const assertCookieTransportAllowed = (req) => {
    if (
        refreshSecureEnabled() &&
        !req.secure &&
        process.env.NODE_ENV === 'production'
    ) {
        const error = new Error(
            'Secure refresh-token cookie requires HTTPS. Set COOKIE_SECURE=false only for a trusted LAN-HTTP deployment.'
        );
        error.statusCode = 500;
        throw error;
    }
};

// Refresh-token cookie options. The domain is intentionally NOT hardcoded to
// 'localhost': a host-only cookie (no Domain attribute) works on localhost AND
// on a LAN IP (e.g. 192.168.x.x:5173) when the app is reached from another
// device. Set COOKIE_DOMAIN only when you need a shared/cross-host cookie.
function cookieOptions(req, refreshToken, expiresAt) {
    assertCookieTransportAllowed(req);
    const isProduction = process.env.NODE_ENV === 'production';
    const opts = {
        httpOnly: true,
        secure: refreshSecureEnabled(),
        sameSite: isProduction ? 'strict' : 'lax',
        path: REFRESH_COOKIE_PATH,
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
function cookieClearOptions(req) {
    const isProduction = process.env.NODE_ENV === 'production';
    const opts = {
        path: REFRESH_COOKIE_PATH,
        sameSite: isProduction ? 'strict' : 'lax',
        secure: refreshSecureEnabled(),
    };
    if (process.env.COOKIE_DOMAIN) {
        opts.domain = process.env.COOKIE_DOMAIN;
    }
    return opts;
}

export const login = async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);
        const telemetry = parseClientInfo(req);

        const {
            user,
            tokens,
        } = await loginUser(data, telemetry);

        const permissionsSet = await getUserPermissions(user.uuid);
        const permissions = Array.from(permissionsSet).sort();

        // Set refresh token as an httpOnly cookie
        try {
            res.cookie('refreshToken', tokens.refreshToken, cookieOptions(req, tokens.refreshToken, tokens.expiresAt));
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

        const telemetry = parseClientInfo(req);
        const tokens = await refreshAuthTokens(refreshToken, telemetry);

        // Set new refresh token as an httpOnly cookie
        try {
            res.cookie('refreshToken', tokens.refreshToken, cookieOptions(req, tokens.refreshToken, tokens.expiresAt));
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

        res.clearCookie('refreshToken', cookieClearOptions(req));

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

        res.clearCookie('refreshToken', cookieClearOptions(req));

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