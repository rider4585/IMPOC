/**
 * Vendors API service
 * Thin wrappers over apiClient for /vendors endpoints.
 * T-05 admin screens.
 */

import apiClient from '../platform/apiClient.js';
import buildError from '../platform/buildError.js';

/**
 * GET /vendors
 * @returns {Promise<Array<{uuid, name, phone, address, notes, isActive, createdAt, updatedAt}>>}
 */
export async function getVendors() {
  try {
    const response = await apiClient.get('/vendors');
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch vendors');
  } catch (error) {
    throw buildError(error, 'Failed to fetch vendors');
  }
}

/**
 * POST /vendors
 * @param {{name, phone?, address?, notes?}} payload
 */
export async function createVendor(payload) {
  try {
    const response = await apiClient.post('/vendors', payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create vendor');
  } catch (error) {
    throw buildError(error, 'Failed to create vendor');
  }
}

/**
 * PATCH /vendors/:uuid
 * @param {string} uuid
 * @param {{name?, phone?, address?, notes?, isActive?}} payload
 */
export async function updateVendor(uuid, payload) {
  try {
    const response = await apiClient.patch(`/vendors/${uuid}`, payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update vendor');
  } catch (error) {
    throw buildError(error, 'Failed to update vendor');
  }
}

/**
 * GET /vendors/:uuid/history
 * @param {string} uuid
 * @returns {Promise<{vendor: Object, trips: Array}>}
 */
export async function getVendorHistory(uuid) {
  try {
    const response = await apiClient.get(`/vendors/${uuid}/history`);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch vendor history');
  } catch (error) {
    throw buildError(error, 'Failed to fetch vendor history');
  }
}
