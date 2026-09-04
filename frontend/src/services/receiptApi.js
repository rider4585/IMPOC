/**
 * Receipts API service
 * Thin wrappers over apiClient for /receipts endpoints.
 * T-20 Schema V2 receipts (printer plain text + digital structured payload).
 */

import apiClient from '../platform/apiClient.js';
import { RECEIPT_ROUTES } from '../platform/routes.js';

function buildError(error, fallback) {
  if (error.response?.data?.message) {
    const err = new Error(error.response.data.message);
    err.statusCode = error.response.status;
    err.errors = error.response.data.errors;
    return err;
  }
  const err = new Error(error?.message || fallback);
  err.statusCode = error?.statusCode;
  return err;
}

/**
 * GET /receipts/preview?entityType=...&entityUuid=...
 * @param {'SALE'|'RENTAL'} entityType
 * @param {string} entityUuid
 * @returns {Promise<{receipt: {store, transaction, customer, lines, totals}}>}
 */
export async function getReceiptPreview(entityType, entityUuid) {
  try {
    const params = new URLSearchParams({ entityType, entityUuid });
    const response = await apiClient.get(`${RECEIPT_ROUTES.PREVIEW}?${params.toString()}`);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to load receipt preview');
  } catch (error) {
    throw buildError(error, 'Failed to load receipt preview');
  }
}

/**
 * GET /receipts/print?entityType=...&entityUuid=...
 * @param {'SALE'|'RENTAL'} entityType
 * @param {string} entityUuid
 * @returns {Promise<{text: string}>} plain-text monospace receipt ready for a printer
 */
export async function getReceiptPrint(entityType, entityUuid) {
  try {
    const params = new URLSearchParams({ entityType, entityUuid });
    const response = await apiClient.get(`${RECEIPT_ROUTES.PRINT}?${params.toString()}`);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to load receipt for printing');
  } catch (error) {
    throw buildError(error, 'Failed to load receipt for printing');
  }
}