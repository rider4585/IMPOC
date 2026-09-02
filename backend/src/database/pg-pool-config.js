/**
 * PostgreSQL Pool Configuration for BIGINT Type Parsing
 *
 * Registers a custom type parser for PostgreSQL's int8 (BIGINT) type at pool
 * startup. Without this parser, Sequelize returns BIGINT columns as strings;
 * with it, they are returned as JavaScript numbers.
 *
 * This function must be called BEFORE the Sequelize instance is created and
 * before any queries are executed.
 *
 * OID 20 is the PostgreSQL object ID for int8 (BIGINT). The parser receives
 * the value as a string from the database wire protocol and converts it to a
 * JavaScript number. Application code (e.g., app-settings.service.js) must
 * still guard against overflow using Number.isSafeInteger(), as JavaScript
 * numbers cannot safely represent integers beyond 2^53 - 1.
 *
 * @param {Sequelize} sequelize - The Sequelize instance to configure
 * @returns {void}
 * @throws {Error} If sequelize is invalid, dialect not initialized, or parser setup fails
 */
export function configureBigintParser(sequelize) {
    // Guard against null/undefined sequelize parameter
    if (sequelize == null) {
        throw new Error(
            'Failed to configure BIGINT parser: sequelize parameter is null or undefined.'
        );
    }

    // Access pg types parser from Sequelize's dialect
    const dialect = sequelize.dialect;

    if (!dialect || !dialect.connectionManager) {
        throw new Error(
            'Failed to configure BIGINT parser: Sequelize dialect not fully initialized. ' +
            'Ensure Sequelize is configured with dialect: "postgres".'
        );
    }

    // Get the pg library instance from the connection manager
    const pg = dialect.connectionManager.lib;

    if (!pg || typeof pg.types === 'undefined') {
        throw new Error(
            'Failed to configure BIGINT parser: pg.types not found. ' +
            'Ensure Sequelize is configured with dialect: "postgres".'
        );
    }

    // Register type parser for int8 (OID 20) to convert BIGINT strings to JavaScript numbers
    try {
        pg.types.setTypeParser(20, (value) => {
            // Guard against null and undefined values (not just null)
            if (value == null) {
                return null;
            }
            const parsed = parseInt(value, 10);
            // Validate parseInt result — return null if NaN to prevent propagating invalid values
            if (Number.isNaN(parsed)) {
                return null;
            }
            return parsed;
        });
    } catch (error) {
        throw new Error(
            `Failed to register BIGINT type parser: ${error.message}`
        );
    }
}
