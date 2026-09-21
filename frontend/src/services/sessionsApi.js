/**
 * Sessions API service
 * Wrappers over apiClient for admin session inspection and revocation.
 */

import apiClient from '../platform/apiClient.js';
import buildError from '../platform/buildError.js';

/**
 * GET /admin/sessions
 * @param {Object} [params] - { activeOnly: boolean }
 * @returns {Promise<{ sessions: Array<Object>, stats: Object }>}
 */
export async function getAdminSessions(params = {}) {
  try {
    const response = await apiClient.get('/admin/sessions', { params });
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch sessions');
  } catch (error) {
    throw buildError(error, 'Failed to fetch sessions');
  }
}

/**
 * DELETE /admin/sessions/:sessionUuid
 * @param {string} sessionUuid
 * @returns {Promise<Object>}
 */
export async function revokeSession(sessionUuid) {
  try {
    const response = await apiClient.delete(`/admin/sessions/${sessionUuid}`);
    if (response.data?.success) {
      return response.data;
    }
    throw new Error(response.data?.message || 'Failed to revoke session');
  } catch (error) {
    throw buildError(error, 'Failed to revoke session');
  }
}

/**
 * DELETE /admin/sessions/users/:userUuid
 * @param {string} userUuid
 * @returns {Promise<Object>}
 */
export async function revokeUserSessions(userUuid) {
  try {
    const response = await apiClient.delete(`/admin/sessions/users/${userUuid}`);
    if (response.data?.success) {
      return response.data;
    }
    throw new Error(response.data?.message || 'Failed to revoke all user sessions');
  } catch (error) {
    throw buildError(error, 'Failed to revoke all user sessions');
  }
}

export default {
  getAdminSessions,
  revokeSession,
  revokeUserSessions,
};
