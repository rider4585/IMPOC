/**
 * Sales / POS API service
 * Thin wrappers over apiClient for /sales endpoints.
 * T-09 POS / checkout.
 */

import apiClient from '../platform/apiClient.js';
import { SALES_ROUTES } from '../platform/routes.js';
import { createRequestKey } from '../platform/requestKey.js';
import buildError from '../platform/buildError.js';

/**
 * GET /sales
 *
 * Server-side filters (R-73). Only the tag filter lives on the server today; the
 * Sales list screen still does all of its other filtering client-side in the
 * DataGrid, so those never reach here.
 *
 * @param {{tagUuids?: string[]}} [params]
 *   tagUuids - comma-separated UUIDs, OR semantics: a sale comes back when it
 *   carries AT LEAST ONE of them. Empty/omitted = no tag filter at all (the
 *   query string is left untouched so the URL stays exactly `/sales`).
 * @returns {Promise<Array>} list of sale DTOs, newest first; each DTO carries
 *   `tags: [{ uuid, name }]` (may be [])
 */
export async function listSales(params = {}) {
  const query = new URLSearchParams();
  const tagUuids = Array.isArray(params?.tagUuids) ? params.tagUuids.filter(Boolean) : [];
  if (tagUuids.length > 0) query.set('tagUuids', tagUuids.join(','));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  try {
    const response = await apiClient.get(`${SALES_ROUTES.LIST}${suffix}`);
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
 * @param {{customerName?, customerUuid?, soldAt?, notes?, items: Array<{unitUuid?|barcode?}>, requestUuid?}} payload
 * customerUuid (Schema V2) links a customers entity; customerName free text stays supported.
 * requestUuid (SEC-M-3 idempotency): pass to reuse across retries of the same intent; the service mints one when absent.
 * @returns {Promise<Object>} sale DTO with lines[] and optional customer object
 */
export async function createSale(payload) {
  try {
    const response = await apiClient.post(SALES_ROUTES.CREATE, {
      ...payload,
      requestUuid: payload?.requestUuid || createRequestKey(),
    });
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
 * @param {{requestUuid?}} options - pass to reuse across retries of the same intent; the service mints one when absent.
 */
export async function cancelSale(uuid, reason, options = {}) {
  try {
    const response = await apiClient.post(SALES_ROUTES.CANCEL(uuid), {
      reason: reason || undefined,
      requestUuid: options.requestUuid || createRequestKey(),
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
 * @param {{requestUuid?}} options - pass to reuse across retries of the same intent; the service mints one when absent.
 */
export async function refundSale(uuid, reason, options = {}) {
  try {
    const response = await apiClient.post(SALES_ROUTES.REFUND(uuid), {
      reason: reason || undefined,
      requestUuid: options.requestUuid || createRequestKey(),
    });
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Refund failed');
  } catch (error) {
    throw buildError(error, 'Refund failed');
  }
}
