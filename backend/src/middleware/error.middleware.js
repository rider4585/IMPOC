import { ZodError } from 'zod';

/*
 * SEC-M-7: 4xx responses must never echo internal row/query details verbatim.
 *
 * - Zod validation issues are developer-authored, static strings - safe to surface.
 * - Custom <500 errors pass through ONLY when the message is on the allow-list
 *   below (intentional, app-authored, free of row internals). Everything else
 *   is masked to a generic message, with the real detail logged server-side only.
 * - Even allow-listed messages are suppressed when they carry a UUID or a
 *   `(status: ...)` fragment (the pattern the flagged producers used to leak
 *   unit/agreement/expense internals).
 */
const GENERIC_4XX_MESSAGE = 'Request could not be processed';

const UUID_RE = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;

const STATUS_FRAGMENT_RE = /\(status:\s[^)]*\)/;

/*
 * Allow-listed phrases (substring match) that are intentionally client-facing.
 * Messages the product wants the client to see, with no internal identifiers.
 */
const SAFE_4XX_MESSAGES = Object.freeze([
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
    // Barcode geometry / generation params
    'Pages must be a positive integer',
    'Pages cannot exceed',
    'required geometry setting',
    'Invalid page count',
    // Validation safety nets
    'Request UUID must be a valid UUID',
    'Invalid UUID format',
    'Validation failed',
]);

const isSafeClientMessage = (message) => {
    if (!message || typeof message !== 'string') {
        return false;
    }

    if (UUID_RE.test(message)) {
        return false;
    }

    if (STATUS_FRAGMENT_RE.test(message)) {
        return false;
    }

    return SAFE_4XX_MESSAGES.some((phrase) => message.includes(phrase));
};

const errorMiddleware = (error, req, res, next) => {
    console.error(error);

    if (error instanceof ZodError) {
        const firstError = error.issues[0];
        return res.status(400).json({
            success: false,
            message: firstError ? firstError.message : 'Validation failed',
            errors: error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })),
        });
    }

    // Handle errors with statusCode (custom application errors)
    if (error.statusCode && error.statusCode < 500) {
        const message = isSafeClientMessage(error.message)
            ? error.message
            : GENERIC_4XX_MESSAGE;

        if (message === GENERIC_4XX_MESSAGE) {
            console.error('[error-masking] Suppressed internal 4xx detail:', error.message);
        }

        return res.status(error.statusCode).json({
            success: false,
            message,
        });
    }

    // Handle 5xx errors - do not expose stack traces or internal details
    return res.status(error.statusCode || 500).json({
        success: false,
        message: 'Internal server error',
    });
};

export default errorMiddleware;