/**
 * Trip + stock API service
 * Thin wrappers over apiClient for /trips and /trips/:tripUuid/stocks (and /stocks/:uuid).
 * Schema V2: Trip (1) -> Vendors (N) -> Stocks (N per vendor) -> Units (N per stock).
 */

import apiClient from '../platform/apiClient.js';
import {
  TRIP_ROUTES,
  STOCK_ROUTES,
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
 * GET /trips
 * @returns {Promise<Array<{uuid, trip_vendors, purchasedOn, totalPaidPaise, variancePaise, createdAt, updatedAt}>>}
 */
export async function getTrips() {
  try {
    const response = await apiClient.get(TRIP_ROUTES.LIST);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch trips');
  } catch (error) {
    throw buildError(error, 'Failed to fetch trips');
  }
}

/**
 * POST /trips
 * @param {Object} payload - {vendorUuid?, purchasedOn, billReference?, totalPaidPaise?}
 * @returns {Promise<Object>} created trip DTO
 */
export async function createTrip(payload) {
  try {
    const response = await apiClient.post(TRIP_ROUTES.CREATE, payload);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create trip');
  } catch (error) {
    throw buildError(error, 'Failed to create trip');
  }
}

/**
 * GET /trips/:uuid
 * Response includes trip_vendors[] (each with vendor object + bill_reference + total_paid) and stocks[].
 * @param {string} uuid
 * @returns {Promise<Object>} trip DTO
 */
export async function getTrip(uuid) {
  try {
    const response = await apiClient.get(TRIP_ROUTES.GET(uuid));
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch trip');
  } catch (error) {
    throw buildError(error, 'Failed to fetch trip');
  }
}

/**
 * POST /trips/:uuid/vendors
 * @param {string} uuid
 * @param {{vendorUuid, billReference?, totalPaidPaise}} payload
 * @returns {Promise<Object>} created trip-vendor link DTO
 */
export async function addTripVendor(uuid, payload) {
  try {
    const response = await apiClient.post(TRIP_ROUTES.ADD_VENDOR(uuid), payload);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to add vendor to trip');
  } catch (error) {
    throw buildError(error, 'Failed to add vendor to trip');
  }
}

/**
 * GET /trips/:tripUuid/clone-last-stock
 * @param {string} tripUuid
 * @returns {Promise<Object|null>} pre-fill data for the last stock, or null if none
 */
export async function cloneLastStock(tripUuid) {
  try {
    const response = await apiClient.get(TRIP_ROUTES.CLONE_LAST_STOCK(tripUuid));
    if (response.data?.success) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    // clone-last-stock may 404 when the trip has no stocks; treat as "nothing to clone"
    if (error.response?.status === 404) return null;
    throw buildError(error, 'Failed to load last stock');
  }
}

/**
 * GET /stocks (bare list-all)
 * @param {Object} [query] - {tripUuid?, vendorUuid?, search?}
 * @returns {Promise<Array>} list of stock DTOs ordered newest-first
 */
export async function listAllStocks({ tripUuid = '', vendorUuid = '', search = '' } = {}) {
  try {
    const params = {};
    if (tripUuid) params.tripUuid = tripUuid;
    if (vendorUuid) params.vendorUuid = vendorUuid;
    if (search) params.search = search;
    const response = await apiClient.get(STOCK_ROUTES.LIST_ALL, { params });
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch stocks');
  } catch (error) {
    throw buildError(error, 'Failed to fetch stocks');
  }
}

/**
 * GET /trips/:tripUuid/stocks
 * @param {string} tripUuid
 * @returns {Promise<Array>} list of stock DTOs
 */
export async function getStocks(tripUuid) {
  try {
    const response = await apiClient.get(STOCK_ROUTES.LIST(tripUuid));
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch stocks');
  } catch (error) {
    throw buildError(error, 'Failed to fetch stocks');
  }
}

/**
 * GET /stocks/:uuid
 * @param {string} uuid
 * @returns {Promise<Object>} stock DTO
 */
export async function getStock(uuid) {
  try {
    const response = await apiClient.get(STOCK_ROUTES.GET(uuid));
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch stock');
  } catch (error) {
    throw buildError(error, 'Failed to fetch stock');
  }
}

/**
 * POST /trips/:tripUuid/stocks
 * @param {string} tripUuid
 * @param {Object} payload - {vendorUuid, productTypeUuid, quantity, buyingPricePaise, sellingPricePaise, floorPricePaise, channel, rentPerDayPaise?, depositPaise?, overduePerDayPaise?}
 * @returns {Promise<Object>} created stock DTO
 */
export async function createStock(tripUuid, payload) {
  try {
    const response = await apiClient.post(STOCK_ROUTES.CREATE(tripUuid), payload);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create stock');
  } catch (error) {
    throw buildError(error, 'Failed to create stock');
  }
}

/**
 * PATCH /trips/:tripUuid/stocks/:uuid
 * @param {string} tripUuid
 * @param {string} uuid
 * @param {Object} payload
 * @returns {Promise<Object>} updated stock DTO
 */
export async function updateStock(tripUuid, uuid, payload) {
  try {
    const response = await apiClient.patch(STOCK_ROUTES.UPDATE(tripUuid, uuid), payload);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update stock');
  } catch (error) {
    throw buildError(error, 'Failed to update stock');
  }
}

/**
 * POST /stocks/:uuid/scan
 * Scans a barcode into a stock, creating a unit.
 * @param {string} stockUuid - the stock's uuid
 * @param {{barcode, colourUuid, sizeUuid}} payload
 * @returns {Promise<Object>} created unit DTO
 */
export async function scanBarcodeIntoStock(stockUuid, { barcode, colourUuid, sizeUuid }) {
  try {
    const response = await apiClient.post(
      STOCK_ROUTES.SCAN(stockUuid),
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