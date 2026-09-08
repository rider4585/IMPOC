import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_TOKEN_TYPE = 'access';

/*
 * The ONLY algorithm accepted for signing AND verifying access JWTs.
 *
 * Pin it on both jwt.sign and jwt.verify (the middleware imports this same
 * constant) so the library's default of allowing any symmetric/asymmetric
 * algorithm is never relied upon. Allowing the algorithm to float is what
 * enables "algorithm confusion" attacks (e.g. presenting an HS256 token to a
 * verifier configured for RS256, or vice-versa).
 */
export const JWT_ALGORITHM = 'HS256';

const MIN_JWT_SECRET_LENGTH = 32;

/*
 * Values that are committed to the repo (gitignored .env files do NOT exist
 * for the example) and therefore must never be usable as a live signing
 * secret. A deploy that copies .env.example verbatim used to get a guessable
 * 'your-long-random-access-secret' — those exact strings are rejected here so
 * such a deploy fails fast instead of serving forgeable tokens.
 */
const KNOWN_PLACEHOLDER_SECRETS = new Set([
    'your-long-random-access-secret',
    'your-long-random-refresh-secret',
    'your-secret',
    'your-secret-key',
    'secret',
    'change-me',
    'change_me',
    'changeme',
    'placeholder',
    'jwt-secret',
    'jwtsecret',
    'supersecret',
]);

const getRequiredEnv = (key) => {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
};

/**
 * Validate one JWT secret at boot. Throws when the secret is missing, is still
 * a known placeholder, or is shorter than MIN_JWT_SECRET_LENGTH.
 */
export const validateJwtSecret = (secret, name) => {
    if (!secret || typeof secret !== 'string') {
        throw new Error(
            `${name} is not set. Set it to a random string of at least ${MIN_JWT_SECRET_LENGTH} characters.`
        );
    }

    const trimmed = secret.trim();

    if (
        trimmed.length < MIN_JWT_SECRET_LENGTH ||
        KNOWN_PLACEHOLDER_SECRETS.has(trimmed.toLowerCase())
    ) {
        throw new Error(
            `${name} is too weak: use a random string of at least ${MIN_JWT_SECRET_LENGTH} characters (and not a placeholder).`
        );
    }
};

/*
 * Boot-time gate: fail fast when the app is started with a missing, placeholder
 * or weak JWT access secret. Called from app.js so a bad configuration throws
 * before the HTTP server accepts connections.
 */
export const assertJwtSecrets = () => {
    validateJwtSecret(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');

    // JWT_REFRESH_SECRET is not currently consumed by the signing code, but if
    // it is configured it must meet the same bar so a weak tombstone value
    // cannot rot in a deployment's env.
    if (process.env.JWT_REFRESH_SECRET !== undefined) {
        validateJwtSecret(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
    }
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
            algorithm: JWT_ALGORITHM,
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