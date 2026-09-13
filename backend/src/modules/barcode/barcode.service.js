import { v4 as uuidv4 } from 'uuid';

import {
    BARCODE_CONFIG,
    BARCODE_FORMAT,
} from './barcode.constants.js';

import { generateBarcodePdf, generateSampleSheetPdf } from './barcode.generator.js';
import { getLayout } from '../barcode-layouts/barcode-layout.service.js';
import { generateBarcodeTestPdf } from './barcode.test-generator.js';

import {
    RequestKey,
    User,
    sequelize,
} from '../../../database/models/index.js';

import { GESTURE_TYPES } from '../../constants/gesture-type.js';


/**
 * Format one barcode value: SHREE + TS6 + CNT4 (see BARCODE_FORMAT).
 *
 * @param {bigint|number|string} seqValue - value drawn from barcode_seq (>= 1)
 * @param {number} nowMs - wall-clock ms used for the timestamp part
 * @returns {string} 15-char uppercase alphanumeric barcode value
 */
export const formatBarcodeValue = (seqValue, nowMs = Date.now()) => {
    const { prefix, epochMs, timestampLength, counterLength, radix } = BARCODE_FORMAT;

    const seq = BigInt(seqValue);
    if (seq < 1n) {
        throw new Error('Invalid sequence value from database');
    }

    const seconds = Math.floor((nowMs - epochMs) / 1000);
    if (!Number.isFinite(seconds) || seconds < 0) {
        throw new Error('System clock is before the barcode epoch');
    }

    const timestamp = seconds.toString(radix).toUpperCase().padStart(timestampLength, '0');
    if (timestamp.length > timestampLength) {
        throw new Error('Barcode timestamp exceeds its fixed width');
    }

    const counterModulus = BigInt(radix) ** BigInt(counterLength);
    const counter = (seq % counterModulus)
        .toString(radix)
        .toUpperCase()
        .padStart(counterLength, '0');

    return `${prefix}${timestamp}${counter}`;
};

/**
 * Generate barcode values (IDs).
 *
 * Draws N distinct values from the barcode_seq sequence in a single round-trip.
 * Loads grid dimensions from the saved label layout to calculate total barcodes.
 * Each value is formatted via formatBarcodeValue (SHREE + timestamp + counter),
 * so labels stay unique even if barcode_seq is ever reset (R-48).
 * No in-process caching — fresh read on every call.
 *
 * @param {number} pages - Number of pages
 * @param {Transaction} transaction - Sequelize transaction to ensure atomicity with request_keys row
 * @returns {Promise<string[]>} Array of barcode values
 * @throws {Error} If the grid dimensions are invalid
 */
const generateBarcodeValues = async (pages, transaction) => {
    // Grid size comes from the saved label layout (R-50), read inside the transaction
    const { columns, rows } = await getLayout(transaction);

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

    // One timestamp per batch: the counter part keeps values distinct within it
    const nowMs = Date.now();

    return result.map(row => {
        if (row.nextval == null) {
            throw new Error('Invalid sequence value from database');
        }
        return formatBarcodeValue(row.nextval, nowMs);
    });
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


/**
 * Sample sheet for the Label layout page (R-50): one page of dummy values
 * rendered with the SAVED layout. No sequence draw, no request_keys row.
 */
export const generateBarcodePreview = async () => {
    const pdfBuffer = await generateSampleSheetPdf();
    return { pdfBuffer };
};
