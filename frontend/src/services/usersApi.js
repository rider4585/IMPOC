/**
 * Users API service
 * Thin wrappers over apiClient for /users endpoints.
 * T-03 admin screens.
 */

import apiClient from '../platform/apiClient.js';
import buildError from '../platform/buildError.js';

/**
 * GET /users
 * @returns {Promise<Array<{uuid, username, email, firstName, lastName, phone, status, lastLoginAt, createdAt, updatedAt}>>}
 */
export async function getUsers() {
  try {
    const response = await apiClient.get('/users');
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch users');
  } catch (error) {
    throw buildError(error, 'Failed to fetch users');
  }
}

/**
 * POST /users
 * @param {{username, email?, password, firstName, lastName?, phone?, roleUuid}} payload
 * @returns {Promise<Object>} created user DTO
 */
export async function createUser(payload) {
  try {
    const response = await apiClient.post('/users', payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create user');
  } catch (error) {
    throw buildError(error, 'Failed to create user');
  }
}

/**
 * PATCH /users/:uuid
 * @param {string} uuid
 * @param {Object} payload - {username?, email?, firstName?, lastName?, phone?}
 * @returns {Promise<Object>}
 */
export async function updateUser(uuid, payload) {
  try {
    const response = await apiClient.patch(`/users/${uuid}`, payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update user');
  } catch (error) {
    throw buildError(error, 'Failed to update user');
  }
}

/**
 * PATCH /users/:uuid/status
 * @param {string} uuid
 * @param {string} status - active | inactive | suspended
 * @returns {Promise<Object>}
 */
export async function updateUserStatus(uuid, status) {
  try {
    const response = await apiClient.patch(`/users/${uuid}/status`, { status });
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update user status');
  } catch (error) {
    throw buildError(error, 'Failed to update user status');
  }
}

/**
 * DELETE /users/:uuid
 * @param {string} uuid
 * @returns {Promise<Object>}
 */
export async function deleteUser(uuid) {
  try {
    const response = await apiClient.delete(`/users/${uuid}`);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to delete user');
  } catch (error) {
    throw buildError(error, 'Failed to delete user');
  }
}

/**
 * GET /users/:userUuid/roles
 * @param {string} userUuid
 * @returns {Promise<Array<{uuid, name, description}>>}
 */
export async function getUserRoles(userUuid) {
  try {
    const response = await apiClient.get(`/users/${userUuid}/roles`);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch user roles');
  } catch (error) {
    throw buildError(error, 'Failed to fetch user roles');
  }
}

/**
 * POST /users/:userUuid/roles
 * @param {string} userUuid
 * @param {string} roleUuid
 * @returns {Promise<Object>}
 */
export async function assignRoleToUser(userUuid, roleUuid) {
  try {
    const response = await apiClient.post(`/users/${userUuid}/roles`, { roleUuid });
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to assign role');
  } catch (error) {
    throw buildError(error, 'Failed to assign role');
  }
}

/**
 * DELETE /users/:userUuid/roles/:roleUuid
 * @param {string} userUuid
 * @param {string} roleUuid
 * @returns {Promise<Object>}
 */
export async function removeRoleFromUser(userUuid, roleUuid) {
  try {
    const response = await apiClient.delete(`/users/${userUuid}/roles/${roleUuid}`);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to remove role');
  } catch (error) {
    throw buildError(error, 'Failed to remove role');
  }
}
