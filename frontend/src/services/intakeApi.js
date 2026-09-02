/**
 * Stock intake (trip) + lot API service
 * Thin wrappers over apiClient for /stock-intakes and /stock-intakes/:tripUuid/lines.
 * T-07 intake workflow.
 */

import apiClient from '../platform/apiClient.js';
import {
  STOCK_INTAKE_ROUTES,
  STOCK_INTAKE_LINE_ROUTES,
} from '../platform/routes.js';

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
 * GET /stock-intakes
 * @returns {Promise<Array<{uuid, vendorUuid, purchasedOn, billReference, totalPaidPaise, variancePaise, createdAt, updatedAt}>>}
 */
export async function getStockIntakes() {
  try {
    const response = await apiClient.get(STOCK_INTAKE_ROUTES.LIST);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch trips');
  } catch (error) {
    throw buildError(error, 'Failed to fetch trips');
  }
}

/**
 * POST /stock-intakes
 * @param {{vendorUuid, purchasedOn, billReference?, totalPaidPaise}} payload
 * @returns {Promise<Object>} created trip DTO
 */
export async function createStockIntake(payload) {
  try {
    const response = await apiClient.post(STOCK_INTAKE_ROUTES.CREATE, payload);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create trip');
  } catch (error) {
    throw buildError(error, 'Failed to create trip');
  }
}

/**
 * GET /stock-intakes/:uuid
 * @param {string} uuid
 * @returns {Promise<Object>} trip DTO
 */
export async function getStockIntake(uuid) {
  try {
    const response = await apiClient.get(STOCK_INTAKE_ROUTES.GET(uuid));
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch trip');
  } catch (error) {
    throw buildError(error, 'Failed to fetch trip');
  }
}

/**
 * GET /stock-intakes/:tripUuid/lines
 * @param {string} tripUuid
 * @returns {Promise<Array>} list of lot DTOs
 */
export async function getStockIntakeLines(tripUuid) {
  try {
    const response = await apiClient.get(STOCK_INTAKE_LINE_ROUTES.LIST(tripUuid));
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch lots');
  } catch (error) {
    throw buildError(error, 'Failed to fetch lots');
  }
}

/**
 * POST /stock-intakes/:tripUuid/lines
 * @param {string} tripUuid
 * @param {Object} payload - {tripUuid, productTypeUuid, quantity, buyingPricePaise, sellingPricePaise, floorPricePaise, channel, rentPerDayPaise?, depositPaise?, overduePerDayPaise?}
 * @returns {Promise<Object>} created lot DTO
 */
export async function createStockIntakeLine(tripUuid, payload) {
  try {
    const response = await apiClient.post(
      STOCK_INTAKE_LINE_ROUTES.CREATE(tripUuid),
      payload
    );
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create lot');
  } catch (error) {
    throw buildError(error, 'Failed to create lot');
  }
}

/**
 * PATCH /stock-intakes/:tripUuid/lines/:uuid
 * @param {string} tripUuid
 * @param {string} uuid
 * @param {Object} payload
 * @returns {Promise<Object>} updated lot DTO
 */
export async function updateStockIntakeLine(tripUuid, uuid, payload) {
  try {
    const response = await apiClient.patch(
      STOCK_INTAKE_LINE_ROUTES.UPDATE(tripUuid, uuid),
      payload
    );
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update lot');
  } catch (error) {
    throw buildError(error, 'Failed to update lot');
  }
}

/**
 * GET /stock-intakes/:tripUuid/clone-last-lot
 * @param {string} tripUuid
 * @returns {Promise<Object|null>} pre-fill data for the last lot, or null if none
 */
export async function cloneLastLot(tripUuid) {
  try {
    const response = await apiClient.get(STOCK_INTAKE_ROUTES.CLONE_LAST_LOT(tripUuid));
    if (response.data?.success) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    // clone-last-lot may 404 when the trip has no lots; treat as "nothing to clone"
    if (error.response?.status === 404) return null;
    throw buildError(error, 'Failed to load last lot');
  }
}

/**
 * POST /stock-intakes/:tripUuid/lines/:uuid/scan
 * Scans a barcode into a lot, creating a unit.
 * @param {string} tripUuid
 * @param {string} stockIntakeLineUuid - the lot's uuid
 * @param {{barcode, colourUuid, sizeUuid}} payload
 * @returns {Promise<Object>} created unit DTO
 */
export async function scanBarcodeIntoLot(tripUuid, stockIntakeLineUuid, { barcode, colourUuid, sizeUuid }) {
  try {
    const response = await apiClient.post(
      STOCK_INTAKE_LINE_ROUTES.SCAN(tripUuid, stockIntakeLineUuid),
      { barcode, colourUuid, sizeUuid }
    );
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Scan failed');
  } catch (error) {
    if (error.response?.data?.message) {
      const err = new Error(error.response.data.message);
      err.statusCode = error.response.status;
      err.errors = error.response.data.errors;
      throw err;
    }
    throw error;
  }
}
