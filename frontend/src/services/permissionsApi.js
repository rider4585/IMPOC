/**
 * Permissions API service
 * Thin wrappers over apiClient for /permissions endpoints.
 * Read-only display for T-03 admin screens.
 */

import apiClient from '../platform/apiClient.js';

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
 * GET /permissions
 * @returns {Promise<Array<{uuid, name, description, createdAt, updatedAt}>>}
 */
export async function getPermissions() {
  try {
    const response = await apiClient.get('/permissions');
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch permissions');
  } catch (error) {
    throw buildError(error, 'Failed to fetch permissions');
  }
}
