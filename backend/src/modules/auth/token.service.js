import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_TOKEN_TYPE = 'access';

const getRequiredEnv = (key) => {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
};

export const generateAccessToken = ({ userUuid, sessionUuid }) => {
    const secret = getRequiredEnv('JWT_ACCESS_SECRET');
    const expiresIn = getRequiredEnv('JWT_ACCESS_EXPIRES_IN');
    const issuer = getRequiredEnv('JWT_ISSUER');
    const audience = getRequiredEnv('JWT_AUDIENCE');

    return jwt.sign(
        {
            sub: userUuid,
            sessionId: sessionUuid,
            type: ACCESS_TOKEN_TYPE,
        },
        secret,
        {
            expiresIn,
            issuer,
            audience,
        }
    );
};

export const generateRefreshToken = (sessionUuid) => {
    const randomSecret = crypto
        .randomBytes(64)
        .toString('base64url');

    return `${sessionUuid}.${randomSecret}`;
};

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getSessionUuidFromRefreshToken = (
    refreshToken
) => {
    const separatorIndex = refreshToken.indexOf('.');

    if (separatorIndex === -1) {
        return null;
    }

    const sessionUuid = refreshToken.slice(0, separatorIndex);

    /*
     * The caller feeds this straight into a uuid column, and Postgres raises a
     * cast error (surfacing as a 500) on anything that is not a well-formed
     * uuid. A malformed refresh token is an authentication failure, so reject
     * it here and let the caller return 401.
     */
    if (!UUID_PATTERN.test(sessionUuid)) {
        return null;
    }

    return sessionUuid;
};

export const hashRefreshToken = (refreshToken) => {
    return crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');
};

export const getRefreshTokenExpiry = () => {
    const expiresIn = getRequiredEnv(
        'JWT_REFRESH_EXPIRES_IN'
    );

    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
        throw new Error(
            'JWT_REFRESH_EXPIRES_IN must use format such as 15m, 7d, 12h, or 60s'
        );
    }

    const value = Number(match[1]);
    const unit = match[2];

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };

    return new Date(
        Date.now() + value * multipliers[unit]
    );
};