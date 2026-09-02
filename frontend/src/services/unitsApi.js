/**
 * Units API service
 * Thin wrappers over apiClient for /units endpoints.
 * Used by POS for barcode lookup of sellable units.
 */

import apiClient from '../platform/apiClient.js';
import { UNIT_ROUTES } from '../platform/routes.js';

function buildError(error, fallback) {
  if (error.response?.data?.message) {
    const err = new Error(error.response.data.message);
    err.statusCode = error.response.status;
    return err;
  }
  const err = new Error(error?.message || fallback);
  err.statusCode = error?.statusCode;
  return err;
}

/**
 * GET /units/by-barcode/:barcode
 * @param {string} barcode
 * @returns {Promise<Object|null>} unit DTO, or null when not found (404)
 */
export async function getUnitByBarcode(barcode) {
  try {
    const response = await apiClient.get(UNIT_ROUTES.BY_BARCODE(barcode));
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Unit lookup failed');
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw buildError(error, 'Unit lookup failed');
  }
}

/**
 * GET /units/:uuid
 * @param {string} uuid
 * @returns {Promise<Object|null>} unit DTO, or null when not found (404)
 */
export async function getUnit(uuid) {
  try {
    const response = await apiClient.get(UNIT_ROUTES.GET(uuid));
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Unit lookup failed');
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw buildError(error, 'Unit lookup failed');
  }
}
