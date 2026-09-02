/**
 * Barcode API service
 * Handles communication with the backend scan endpoint
 * Uses centralized apiClient for consistent auth token injection, SESSION_EXPIRED handling,
 * 401 retry logic, and withCredentials support for httpOnly cookies.
 */

import apiClient from '../platform/apiClient.js';
import { createRequestKey } from '../platform/requestKey.js';
import { STOCK_INTAKE_LINE_ROUTES } from '../platform/routes.js';

/**
 * Scan a barcode into a stock intake line (lot)
 * POST /api/stock-intakes/:tripUuid/lines/:uuid/scan
 *
 * @param {Object} params - Scan parameters
 * @param {string} params.barcode - The barcode value
 * @param {string} params.tripUuid - UUID of the trip (stock intake)
 * @param {string} params.stockIntakeLineUuid - UUID of the stock intake line (lot)
 * @param {string} params.colourUuid - UUID of the colour
 * @param {string} params.sizeUuid - UUID of the size
 * @returns {Promise<Object>} - The created unit DTO
 * @throws {Error} - On 4xx/5xx responses or SESSION_EXPIRED
 */
export const scan = async ({
    barcode,
    tripUuid,
    stockIntakeLineUuid,
    colourUuid,
    sizeUuid,
}) => {
    // Validate required parameters
    if (!barcode || typeof barcode !== 'string' || barcode.trim().length === 0) {
        const error = new Error('Barcode must be a non-empty string');
        error.statusCode = 400;
        throw error;
    }

    if (!tripUuid || typeof tripUuid !== 'string') {
        const error = new Error('Trip UUID is required');
        error.statusCode = 400;
        throw error;
    }

    if (!stockIntakeLineUuid || typeof stockIntakeLineUuid !== 'string') {
        const error = new Error('Stock intake line UUID is required');
        error.statusCode = 400;
        throw error;
    }

    if (!colourUuid || typeof colourUuid !== 'string') {
        const error = new Error('Colour UUID is required');
        error.statusCode = 400;
        throw error;
    }

    if (!sizeUuid || typeof sizeUuid !== 'string') {
        const error = new Error('Size UUID is required');
        error.statusCode = 400;
        throw error;
    }

    const url = STOCK_INTAKE_LINE_ROUTES.SCAN(tripUuid, stockIntakeLineUuid);
    const requestKey = createRequestKey();

    try {
        const response = await apiClient.post(url, {
            barcode,
            colourUuid,
            sizeUuid,
        }, {
            headers: {
                'X-Idempotency-Key': requestKey,
            },
        });

        if (response.data?.success && response.data?.data) {
            return response.data.data;
        }

        throw new Error(response.data?.message || 'Scan failed');
    } catch (error) {
        if (error.response?.data?.message) {
            const err = new Error(error.response.data.message);
            err.statusCode = error.response.status;
            throw err;
        }
        throw error;
    }
};
