/**
 * Enquiries API service (R-63)
 * Thin wrappers over apiClient for /enquiries — customer "do you have X?" requests.
 */

import apiClient from '../platform/apiClient.js';
import { ENQUIRY_ROUTES } from '../platform/routes.js';
import buildError from '../platform/buildError.js';

function unwrap(response, fallback) {
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  throw new Error(response.data?.message || fallback);
}

/**
 * GET /enquiries
 * @param {{status?: string, search?: string, customerUuid?: string}} [params]
 * @returns {Promise<{enquiries: Array, counts: {OPEN: number, MATCHED: number, NOTIFIED: number, CLOSED: number}}>}
 */
export async function listEnquiries(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value).trim());
    }
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  try {
    const data = unwrap(await apiClient.get(`${ENQUIRY_ROUTES.LIST}${suffix}`), 'Failed to load enquiries');
    return {
      enquiries: Array.isArray(data.enquiries) ? data.enquiries : [],
      counts: data.counts || { OPEN: 0, MATCHED: 0, NOTIFIED: 0, CLOSED: 0 },
    };
  } catch (error) {
    throw buildError(error, 'Failed to load enquiries');
  }
}

/**
 * POST /enquiries
 * @param {{customerUuid?: string, customer?: object, productTypeUuid?, colourUuid?, sizeUuid?, description: string, notes?, promisedDate?}} payload
 */
export async function createEnquiry(payload) {
  try {
    return unwrap(await apiClient.post(ENQUIRY_ROUTES.CREATE, payload), 'Failed to log enquiry').enquiry;
  } catch (error) {
    throw buildError(error, 'Failed to log enquiry');
  }
}

/**
 * PATCH /enquiries/:uuid
 */
export async function updateEnquiry(uuid, payload) {
  try {
    return unwrap(await apiClient.patch(ENQUIRY_ROUTES.UPDATE(uuid), payload), 'Failed to update enquiry').enquiry;
  } catch (error) {
    throw buildError(error, 'Failed to update enquiry');
  }
}

/**
 * POST /enquiries/:uuid/close
 * @param {string} uuid
 * @param {{notify: boolean, channels?: Array<'WHATSAPP'|'EMAIL'|'SMS'>, note?: string}} payload
 * @returns {Promise<{enquiry: Object, handoffs: Array<{channel: string, url: string}>}>}
 *   handoffs = tap-to-send links (wa.me / mailto: / sms:) when notify was true
 */
export async function closeEnquiry(uuid, payload) {
  try {
    const data = unwrap(await apiClient.post(ENQUIRY_ROUTES.CLOSE(uuid), payload), 'Failed to close enquiry');
    return { enquiry: data.enquiry, handoffs: Array.isArray(data.handoffs) ? data.handoffs : [] };
  } catch (error) {
    throw buildError(error, 'Failed to close enquiry');
  }
}

/**
 * POST /enquiries/:uuid/reopen
 */
export async function reopenEnquiry(uuid) {
  try {
    return unwrap(await apiClient.post(ENQUIRY_ROUTES.REOPEN(uuid), {}), 'Failed to reopen enquiry').enquiry;
  } catch (error) {
    throw buildError(error, 'Failed to reopen enquiry');
  }
}
