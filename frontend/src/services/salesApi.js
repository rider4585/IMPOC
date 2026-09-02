/**
 * Sales / POS API service
 * Thin wrappers over apiClient for /sales endpoints.
 * T-09 POS / checkout.
 */

import apiClient from '../platform/apiClient.js';
import { SALES_ROUTES } from '../platform/routes.js';

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
 * GET /sales
 * @returns {Promise<Array>} list of sale DTOs, newest first
 */
export async function listSales() {
  try {
    const response = await apiClient.get(SALES_ROUTES.LIST);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch sales');
  } catch (error) {
    throw buildError(error, 'Failed to fetch sales');
  }
}

/**
 * POST /sales - Checkout a RETAIL sale
 * @param {{customerName?, soldAt?, notes?, items: Array<{unitUuid?|barcode?}>}} payload
 * @returns {Promise<Object>} sale DTO with lines[]
 */
export async function createSale(payload) {
  try {
    const response = await apiClient.post(SALES_ROUTES.CREATE, payload);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Checkout failed');
  } catch (error) {
    throw buildError(error, 'Checkout failed');
  }
}

/**
 * GET /sales/:uuid
 * @param {string} uuid
 * @returns {Promise<Object>} sale DTO
 */
export async function getSale(uuid) {
  try {
    const response = await apiClient.get(SALES_ROUTES.GET(uuid));
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch sale');
  } catch (error) {
    throw buildError(error, 'Failed to fetch sale');
  }
}

/**
 * POST /sales/:uuid/cancel
 * @param {string} uuid
 * @param {{reason?}} payload
 */
export async function cancelSale(uuid, reason) {
  try {
    const response = await apiClient.post(SALES_ROUTES.CANCEL(uuid), {
      reason: reason || undefined,
    });
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Cancel failed');
  } catch (error) {
    throw buildError(error, 'Cancel failed');
  }
}

/**
 * POST /sales/:uuid/refund
 * @param {string} uuid
 * @param {{reason?}} payload
 */
export async function refundSale(uuid, reason) {
  try {
    const response = await apiClient.post(SALES_ROUTES.REFUND(uuid), {
      reason: reason || undefined,
    });
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Refund failed');
  } catch (error) {
    throw buildError(error, 'Refund failed');
  }
}
