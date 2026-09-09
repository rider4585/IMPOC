/*
 * SEC-H-1: Login + refresh rate limiting and per-account lockout.
 *
 * Two tiers, both backed by an in-process Map (no extra dependency, matches the
 * codebase's "no express-rate-limit/helmet" reality):
 *
 *  (a) IP-based fixed window for login + refresh attempts (per route). Blunts
 *      distributed guessing where the attacker rotates usernames but keeps the
 *      same source IP.
 *
 *  (b) Per-account failed-attempt counter with an exponential lockout. After
 *      `accountMaxFailed` consecutive failures for one username the account is
 *      locked for a backoff duration; the timeout grows with each subsequent
 *      lockout (5 fails -> 1m, then 15m, 1h, 24h). A successful login resets the
 *      counter and the lockout.
 *
 * Both the "account not found" path and the "wrong password" path feed the SAME
 * per-account counter, so username enumeration cannot be used to bypass the
 * lockout (the codebase already returns an identical 401 for both).
 *
 * Throttle thresholds are read from env (with fail-safe defaults) so operators
 * can tune them and so the test suite can drive them precisely.
 */

const intEnv = (key, fallback) => {
    const raw = process.env[key];
    if (raw === undefined || raw === null || raw === '') {
        return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const config = {
    // IP tier (login + refresh combined per source IP per window)
    ipWindowMs: () => intEnv('LOGIN_IP_WINDOW_MS', 15 * 60 * 1000),
    ipMax: () => intEnv('LOGIN_IP_MAX', 100),

    // Account tier (login only)
    accountMaxFailed: () => intEnv('LOGIN_ACCOUNT_MAX_FAILED', 5),
};

// Exponential backoff (ms) for successive lockouts: 1m, 15m, 1h, 24h, then 24h.
const LOCKOUT_SCHEDULE_MS = [
    60 * 1000,
    15 * 60 * 1000,
    60 * 60 * 1000,
    24 * 60 * 60 * 1000,
];

const lockoutDurationMs = (lockCount) => {
    const index = Math.min(lockCount - 1, LOCKOUT_SCHEDULE_MS.length - 1);
    return LOCKOUT_SCHEDULE_MS[Math.max(0, index)];
};

// key -> { count, windowStart }
const ipWindowStore = new Map();

// username -> { failCount, lockCount, lockedUntil }
const accountStore = new Map();

const resetAccount = (username) => {
    accountStore.delete(username);
};

const normalizeUsername = (username) =>
    typeof username === 'string' ? username.toLowerCase().trim() : '';

/*
 * Guaranteed-clean store reset. Exported so the test suite (and operators) can
 * flush throttling state without restarting the process.
 */
export const resetLoginThrottling = () => {
    ipWindowStore.clear();
    accountStore.clear();
};

const rateLimitError = (message) => {
    const error = new Error(message);
    error.statusCode = 429;
    return error;
};

const accountIsLocked = (username) => {
    const entry = accountStore.get(username);
    if (!entry) return null;
    if (entry.lockedUntil <= Date.now()) {
        // Lockout window expired; release it but preserve accumulated fails so the
        // next failure escalates the schedule instead of restarting from scratch.
        entry.lockedUntil = 0;
        return null;
    }
    return entry;
};

/*
 * IP fixed-window limiter for login + refresh. Apply to both routes.
 */
export const ipLoginRateLimit = (req, res, next) => {
    const key = `${req.ip}:login-refresh`;
    const now = Date.now();
    const windowMs = config.ipWindowMs();
    let entry = ipWindowStore.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
        entry = { count: 0, windowStart: now };
        ipWindowStore.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > config.ipMax()) {
        return next(
            rateLimitError('Too many attempts. Please try again later.')
        );
    }

    next();
};

/*
 * Per-account lockout + failure accounting for login.
 *
 * Before running the controller: short-circuit with 429 when the account is
 * currently locked (regardless of password correctness).
 *
 * After the response finishes: a 2xx (successful login) resets the counter; any
 * other failure of the attempt counts toward the lockout. Only the login route
 * carries a username, so this is login-only.
 */
export const accountLoginLockout = (req, res, next) => {
    const username = normalizeUsername(req.body && req.body.username);
    // A missing/empty username can never be a real account target; fall through
    // to validation and let the normal 400 happen (no throttling state keyed on
    // empty string).
    if (!username) {
        return next();
    }

    const locked = accountIsLocked(username);
    if (locked && locked.lockedUntil > 0) {
        const remainingMs = locked.lockedUntil - Date.now();
        const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
        return next(
            rateLimitError(
                `Account temporarily locked. Try again in ${remainingMin} minute(s).`
            )
        );
    }

    res.on('finish', () => {
        // Only meaningful for login responses. Refresh/logout reuse the same
        // res chain but never pass the middleware, so this is always login.
        const status = res.statusCode;

        if (status >= 200 && status < 300) {
            // Successful login clears accumulated failures.
            resetAccount(username);
            return;
        }

        // 4xx failures that represent an actual attempted credential check.
        // 401 = wrong password OR unknown account (identical by design); 400 =
        // validation failure (missing fields) is a malformed attempt, not a
        // credential guess - still count it conservatively toward the lockout so
        // the counter cannot be bypassed by sending empty bodies.
        if (status === 401 || status === 400) {
            const entry =
                accountStore.get(username) ||
                { failCount: 0, lockCount: 0, lockedUntil: 0 };
            entry.failCount += 1;

            if (entry.failCount >= config.accountMaxFailed()) {
                entry.lockCount += 1;
                entry.lockedUntil = Date.now() + lockoutDurationMs(entry.lockCount);
                entry.failCount = 0;
            }

            accountStore.set(username, entry);
        }
    });

    next();
};
