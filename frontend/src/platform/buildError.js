/**
 * Shared 4xx error builder (SEC-L-7).
 *
 * Every frontend service used to duplicate this mapping and pass through the
 * server `message` string verbatim, so whatever the backend said was printed in
 * the UI. That was only safe while the backend SEC-M-7 allow-listing held.
 *
 * This module keeps the frontend in lockstep with the backend M-7 allow-list
 * (`backend/src/middleware/error.middleware.js`), so the UI never surfaces an
 * opaque or raw server string:
 * - Zod validation responses (a field-level `errors[]` array) are developer-
 *   authored static strings and are surfaced verbatim, mirroring the backend;
 *   field messages that embed an internal identifier are dropped.
 * - Any other 4xx message is surfaced ONLY when it matches the client-side
 *   mirror of the backend allow-list (or is one of the backend's generic
 *   client-facing fallbacks). Anything else falls back to the caller's message.
 *
 * Keep SAFE_4XX_MESSAGES in sync when the backend allow-list changes.
 */

const UUID_RE = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;

const STATUS_FRAGMENT_RE = /\(status:\s[^)]*\)/;

/*
 * Client-side mirror of `SAFE_4XX_MESSAGES` in
 * backend/src/middleware/error.middleware.js. Substring match on purpose.
 */
export const SAFE_4XX_MESSAGES = Object.freeze([
  // Authentication / authorization
  'Invalid username or password',
  'Authentication required',
  'Invalid authorization header',
  'Invalid or expired access token',
  'Invalid access token',
  'Session has been revoked',
  'Session has expired',
  'Account is suspended',
  'Account temporarily locked',
  'Too many attempts',
  'Forbidden',
  'User account is inactive',
  'User not found',
  // Picklist / reference entities
  'Colour already exists',
  'Colour not found',
  'Colour is inactive',
  'Size already exists',
  'Size not found',
  'Size is inactive',
  'Damage grade already exists',
  'Damage grade not found',
  'Vendor not found',
  'Vendor is inactive',
  'Vendor is not part of this trip',
  'Vendor already added to this trip',
  'Payment method already exists',
  'Review link already exists',
  'Review links must start with https://',
  'Customer source already exists',
  'Sub type must belong to a parent product type',
  'Sub type not found',
  'Product type not found',
  'Product type is inactive',
  'type may not be its own ancestor',
  'Trip not found',
  'Stock not found',
  'No stocks found to clone for this trip',
  'exactly one of barcode or unitUuid',
  'Barcode already bound to unit',
  'Stock has reached its declared quantity',
  'already exists',
  // Financial modules - generic business rules (no row internals)
  'Floor price cannot exceed selling price',
  'Overdue per day must be greater than rent per day',
  'At least one item is required',
  'At least one item',
  'not in the payment methods picklist',
  'not in the customer sources picklist',
  'references unknown',
  'is not in the picklist',
  // Barcode geometry / generation params
  'Pages must be a positive integer',
  'Pages cannot exceed',
  'required geometry setting',
  'Invalid page count',
  'Layout does not fit',
  // Validation safety nets
  'Request UUID must be a valid UUID',
  'Invalid UUID format',
  'Validation failed',
  // Backend generic fallbacks (always client-safe, no internal detail)
  'Request could not be processed',
  'Internal server error',
]);

/**
 * True when a message is safe to surface in the UI: it must not carry an
 * internal identifier (UUID / `(status: ...)` fragment) and must match one of
 * the allow-listed phrases.
 */
export function isSafeClientMessage(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  if (UUID_RE.test(message) || STATUS_FRAGMENT_RE.test(message)) {
    return false;
  }

  return SAFE_4XX_MESSAGES.some((phrase) => message.includes(phrase));
}

/**
 * Build a client error from an api call failure.
 * - Server 4xx body present: surface only allow-listed / Zod strings;
 *   otherwise fall back to `fallback`. Attaches statusCode and (for Zod
 *   responses) the sanitized field-level errors.
 * - No server body (network / timeout / programming error): surface the
 *   transport error message, falling back to `fallback`.
 *
 * @param {any} error - the thrown error from an apiClient call
 * @param {string} fallback - caller-provided message used when nothing safe is available
 * @returns {Error} an Error with optional `statusCode` and `errors` properties
 */
export function buildError(error, fallback) {
  // Backend down / unreachable / 5xx: apiClient already swapped in the
  // user-facing wording; never surface a 5xx body or axios's own text.
  if (error?.isServerUnavailable) {
    const err = new Error(error.message);
    err.statusCode = error.response?.status;
    err.isServerUnavailable = true;
    return err;
  }

  const responseBody = error?.response?.data;
  if (responseBody?.message) {
    const statusCode = error.response.status;

    // Zod validation responses carry a field-level errors[] array. The backend
    // surfaces these developer-authored strings verbatim (no allow-list), so we
    // mirror that here, only dropping field messages that embed an internal id.
    if (Array.isArray(responseBody.errors)) {
      const err = new Error(responseBody.message);
      err.statusCode = statusCode;
      err.errors = responseBody.errors.filter(
        (issue) => !UUID_RE.test(issue?.message) && !STATUS_FRAGMENT_RE.test(issue?.message)
      );
      return err;
    }

    // Other 4xx: keep in lockstep with the backend SEC-M-7 allow-list. Never
    // print an opaque/raw server string the allow-list doesn't cover.
    if (isSafeClientMessage(responseBody.message)) {
      const err = new Error(responseBody.message);
      err.statusCode = statusCode;
      return err;
    }
  }

  const err = new Error(error?.message || fallback);
  err.statusCode = error?.statusCode;
  return err;
}

export default buildError;