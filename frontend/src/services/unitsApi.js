/**
 * Units API service
 * Thin wrappers over apiClient for /units endpoints.
 * Used by POS for barcode lookup of sellable units.
 */

import apiClient from '../platform/apiClient.js';
import { UNIT_ROUTES } from '../platform/routes.js';
import buildError from '../platform/buildError.js';

/**
 * GET /units (bare list-all)
 * @param {Object} [query] - {search?, status?, stockUuid?}
 * @returns {Promise<Array>} list of unit DTOs
 */
export async function listAllUnits({ search = '', status = '', stockUuid = '' } = {}) {
  try {
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;
    if (stockUuid) params.stockUuid = stockUuid;
    const response = await apiClient.get(UNIT_ROUTES.LIST, { params });
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch units');
  } catch (error) {
    throw buildError(error, 'Failed to fetch units');
  }
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
