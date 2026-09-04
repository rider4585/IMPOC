/**
 * Customers API service
 * Thin wrappers over apiClient for /customers endpoints.
 * T-20 Schema V2 customers entity (contact + consent for receipt sending).
 */

import apiClient from '../platform/apiClient.js';
import { CUSTOMER_ROUTES } from '../platform/routes.js';

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
 * GET /customers?search=...
 * Empty search returns the recent customer list.
 * @param {string} [search] - partial phone or name to filter by
 * @returns {Promise<Array<{uuid, name, phone, email, dob, address, notes, consentWhatsapp, consentEmail, consentSms, consentWhatsappGroup, customerCount, createdAt, updatedAt}>>}
 */
export async function searchCustomers(search) {
  const query = search && String(search).trim().length > 0 ? `?search=${encodeURIComponent(String(search).trim())}` : '';
  try {
    const response = await apiClient.get(`${CUSTOMER_ROUTES.LIST}${query}`);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to load customers');
  } catch (error) {
    throw buildError(error, 'Failed to load customers');
  }
}

/**
 * Alias for searchCustomers with no term — the recent list.
 * @returns {Promise<Array>} recent customers
 */
export async function listCustomers() {
  return searchCustomers('');
}

/**
 * POST /customers
 * @param {{name: string, phone?, email?, dob?, address?, notes?, consentWhatsapp?, consentEmail?, consentSms?, consentWhatsappGroup?}} payload
 * @returns {Promise<Object>} customer DTO
 */
export async function createCustomer(payload) {
  try {
    const response = await apiClient.post(CUSTOMER_ROUTES.CREATE, payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create customer');
  } catch (error) {
    throw buildError(error, 'Failed to create customer');
  }
}

/**
 * GET /customers/:uuid
 * @param {string} uuid
 * @returns {Promise<Object>} customer DTO
 */
export async function getCustomer(uuid) {
  try {
    const response = await apiClient.get(CUSTOMER_ROUTES.GET(uuid));
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to load customer');
  } catch (error) {
    throw buildError(error, 'Failed to load customer');
  }
}

/**
 * PATCH /customers/:uuid
 * @param {string} uuid
 * @param {{name?, phone?, email?, dob?, address?, notes?, consentWhatsapp?, consentEmail?, consentSms?, consentWhatsappGroup?}} payload
 * @returns {Promise<Object>} customer DTO
 */
export async function updateCustomer(uuid, payload) {
  try {
    const response = await apiClient.patch(CUSTOMER_ROUTES.UPDATE(uuid), payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update customer');
  } catch (error) {
    throw buildError(error, 'Failed to update customer');
  }
}

/**
 * PATCH /customers/:uuid/consent
 * Toggles a single consent channel. Server returns the updated customer.
 *
 * @param {string} uuid
 * @param {'WHATSAPP'|'EMAIL'|'SMS'|'WHATSAPP_GROUP'} channel
 * @param {boolean} consented
 * @returns {Promise<Object>} customer DTO
 */
export async function updateCustomerConsent(uuid, channel, consented) {
  try {
    const response = await apiClient.patch(CUSTOMER_ROUTES.CONSENT(uuid), {
      channel,
      consented: Boolean(consented),
    });
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update consent');
  } catch (error) {
    throw buildError(error, 'Failed to update consent');
  }
}