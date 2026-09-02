import { sequelize } from '../../../database/models/index.js';

/**
 * Custom error for configuration errors (missing setting).
 * Thrown when a required geometry or configuration key is not found in app_settings.
 */
export class ConfigurationError extends Error {
    constructor(key) {
        super(`required geometry setting '${key}' not found`);
        this.name = 'ConfigurationError';
        this.statusCode = 404;
        this.key = key;
    }
}

/**
 * Custom error for database errors (connection, timeout, etc.).
 * Thrown when database operations fail for reasons other than missing data.
 */
export class DatabaseError extends Error {
    constructor(originalError) {
        super(`Database error: ${originalError.message}`);
        this.name = 'DatabaseError';
        this.statusCode = 500;
        this.originalError = originalError;
    }
}

/**
 * Retrieve an application setting by key and parse it by its declared type.
 *
 * The `value_int` column holds money-typed settings as paise (1 rupee = 100 paise).
 * Always queries the database on every call — no in-process caching.
 *
 * Errors are classified into two types:
 * 1. ConfigurationError (404): Thrown when key does not exist in app_settings.
 *    Message: "required geometry setting 'key' not found"
 * 2. DatabaseError (500): Thrown when database operations fail (connection, timeout, etc.).
 *    Message: "Database error: [original error message]"
 *
 * @param {string} key - The setting key to retrieve (e.g., 'barcode_page_width')
 * @param {Transaction} transaction - Optional Sequelize transaction for consistent reads
 * @returns {Promise<string|number>} The parsed value — string for TEXT type, number for INT type
 * @throws {ConfigurationError} If key not found (404)
 * @throws {DatabaseError} If database operation fails (500)
 */
export async function get(key, transaction = null) {
    // Input validation: reject null/undefined/non-string keys
    if (!key || typeof key !== 'string') {
        const error = new Error('Invalid key: must be a non-empty string');
        error.statusCode = 400;
        throw error;
    }

    let row;
    try {
        row = await sequelize.query(
            'SELECT key, value_text, value_int, value_type FROM app_settings WHERE key = ?',
            {
                replacements: [key],
                type: sequelize.QueryTypes.SELECT,
                raw: true,
                transaction,
            }
        );
    } catch (dbError) {
        // Wrap database errors (connection failure, timeout, etc.) as DatabaseError
        throw new DatabaseError(dbError);
    }

    if (!row || row.length === 0) {
        // Wrap missing-key errors as ConfigurationError
        throw new ConfigurationError(key);
    }

    const setting = row[0];

    // Parse by value_type: INT returns number, TEXT returns string
    if (setting.value_type === 'INT') {
        // Guard against NULL/undefined/falsy value_int (Patch 1: Null/undefined handling)
        if (!setting.value_int && setting.value_int !== 0) {
            throw new ConfigurationError(key);
        }

        const intValue = setting.value_int;

        // Guard against BIGINT overflow (JavaScript safe integer limit is 2^53-1)
        if (!Number.isSafeInteger(intValue)) {
            const error = new Error(`Setting '${key}' value exceeds safe integer limit`);
            error.statusCode = 500;
            throw error;
        }

        return intValue;
    }

    if (setting.value_type === 'TEXT') {
        // Guard against NULL/undefined/empty value_text (Patch 1: Null/undefined handling)
        if (!setting.value_text) {
            throw new ConfigurationError(key);
        }

        return setting.value_text;
    }

    // This should never happen due to CHECK constraint, but guard against invalid data
    const error = new Error(`Invalid value_type '${setting.value_type}' for setting '${key}'`);
    error.statusCode = 500;
    throw error;
}
