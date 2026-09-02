import { v4 as uuidv4 } from 'uuid';

import {
    BARCODE_CONFIG,
} from './barcode.constants.js';

import { generateBarcodePdf } from './barcode.generator.js';
import { generateBarcodeTestPdf } from './barcode.test-generator.js';

import {
    RequestKey,
    User,
    sequelize,
} from '../../../database/models/index.js';

import { GESTURE_TYPES } from '../../constants/gesture-type.js';

import * as appSettings from '../app-settings/app-settings.service.js';
import { ConfigurationError, DatabaseError } from '../app-settings/app-settings.service.js';

/**
 * Generate barcode values (IDs).
 *
 * Draws N distinct values from the barcode_seq sequence in a single round-trip.
 * Loads grid dimensions from app_settings to calculate total barcodes.
 * Each value is formatted as a 12-digit zero-padded string for Code 128 subset-C encoding.
 * No in-process caching — fresh read on every call.
 *
 * @param {number} pages - Number of pages
 * @param {Transaction} transaction - Sequelize transaction to ensure atomicity with request_keys row
 * @returns {Promise<string[]>} Array of 12-digit zero-padded barcode values
 * @throws {Error} If grid dimensions are missing from app_settings or counter exceeds 12-digit max
 */
const generateBarcodeValues = async (pages, transaction) => {
    let columns, rows;
    try {
        columns = await appSettings.get('barcode_grid_columns');
        rows = await appSettings.get('barcode_grid_rows');
    } catch (error) {
        // Handle configuration errors (missing grid dimension settings)
        if (error instanceof ConfigurationError) {
            throw new Error(
                `Cannot generate barcodes: ${error.message}. ` +
                'Ensure barcode_grid_columns and barcode_grid_rows are seeded in app_settings.',
            );
        }
        // Handle database errors (connection, timeout, etc.)
        if (error instanceof DatabaseError) {
            throw error;
        }
        // Patch 2: Default error handler for unexpected errors
        throw new Error(
            `Unexpected error while loading barcode grid dimensions: ${error.message}`,
        );
    }

    if (columns <= 0 || rows <= 0) {
        throw new Error('Invalid grid dimensions: columns and rows must be positive integers');
    }

    const totalBarcodes =
        pages *
        columns *
        rows;

    // Draw N distinct values from barcode_seq in a single round-trip using generate_series() + nextval()
    // This ensures efficiency and atomicity within the surrounding transaction
    const result = await sequelize.query(
        'SELECT nextval(\'public.barcode_seq\')::bigint AS nextval FROM generate_series(1, ?)',
        {
            replacements: [totalBarcodes],
            type: sequelize.QueryTypes.SELECT,
            transaction,
        }
    );

    // Extract sequence values, validate, and format as 12-digit zero-padded strings
    const barcodeValues = result.map(row => {
        const seqValue = row.nextval;

        // Validate that the sequence value is valid (not null, must be >= 1)
        if (seqValue == null || seqValue < 1) {
            throw new Error('Invalid sequence value from database');
        }

        // Validate that the counter does not exceed 12 digits (max: 999999999999)
        if (seqValue > 999999999999) {
            throw new Error('Barcode value exceeds 12-digit maximum');
        }

        // Format as 12-digit zero-padded string for Code 128 subset-C encoding
        return String(seqValue).padStart(12, '0');
    });

    return barcodeValues;
};

export const generateBarcodes = async (pages, requestUuid, userUuid) => {
    if (!Number.isInteger(pages) || pages < 1) {
        const error = new Error(
            'Pages must be a positive integer.',
        );

        error.statusCode = 400;
        throw error;
    }

    if (pages > BARCODE_CONFIG.maxPages) {
        const error = new Error(
            `Pages cannot exceed ${BARCODE_CONFIG.maxPages}.`,
        );

        error.statusCode = 400;
        throw error;
    }

    if (!userUuid || typeof userUuid !== 'string') {
        const error = new Error('Invalid user UUID');
        error.statusCode = 400;
        throw error;
    }

    const transaction = await sequelize.transaction();

    try {
        // Get actor user ID from userUuid
        const user = await User.findOne({
            where: { uuid: userUuid },
            attributes: ['id'],
            transaction,
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Guard: user.id must be present
        if (user.id === null || user.id === undefined) {
            const error = new Error('User record is missing id');
            error.statusCode = 500;
            throw error;
        }

        // Generate barcode values (async, reads from app_settings, draws from barcode_seq)
        // IMPORTANT: Sequence counter draw happens inside transaction to ensure atomicity
        // with RequestKey logging and prevent counter value loss on rollback
        const barcodeValues = await generateBarcodeValues(pages, transaction);

        // Generate PDF (inside transaction for consistency with sequence counter)
        // Geometry must be read within same transaction scope to prevent concurrent modifications
        // from causing misalignment between generated barcodes and rendered grid dimensions
        const pdfBuffer = await generateBarcodePdf(barcodeValues, transaction);

        // Generate a unique result UUID as a marker
        const resultUuid = uuidv4();

        // Insert request_keys row last, inside transaction
        await RequestKey.create(
            {
                gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
                request_uuid: requestUuid,
                result_kind: 'PDF',
                result_uuid: resultUuid,
                actor_user_id: user.id,
            },
            { transaction }
        );

        await transaction.commit();

        return { pdfBuffer, resultUuid, resultKind: 'PDF' };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const generateBarcodeTestSheet = async (requestUuid, userUuid) => {
    if (!userUuid || typeof userUuid !== 'string') {
        const error = new Error('Invalid user UUID');
        error.statusCode = 400;
        throw error;
    }

    const transaction = await sequelize.transaction();

    try {
        // Get actor user ID from userUuid
        const user = await User.findOne({
            where: { uuid: userUuid },
            attributes: ['id'],
            transaction,
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Guard: user.id must be present
        if (user.id == null) {
            const error = new Error('User record is missing id');
            error.statusCode = 500;
            throw error;
        }

        // Generate test sheet PDF
        const pdfBuffer = await generateBarcodeTestPdf();

        // Generate a unique result UUID as a marker
        const resultUuid = uuidv4();

        // Insert request_keys row last, inside transaction
        await RequestKey.create(
            {
                gesture_type: GESTURE_TYPES.BARCODE_GENERATE_TEST,
                request_uuid: requestUuid,
                result_kind: 'PDF_TEST_SHEET',
                result_uuid: resultUuid,
                actor_user_id: user.id,
            },
            { transaction }
        );

        await transaction.commit();

        return { pdfBuffer, resultUuid, resultKind: 'PDF_TEST_SHEET' };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};
