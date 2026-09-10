/**
 * Roles API service
 * Thin wrappers over apiClient for /roles endpoints.
 * T-03 admin screens.
 */

import apiClient from '../platform/apiClient.js';
import buildError from '../platform/buildError.js';

/**
 * GET /roles
 * @returns {Promise<Array<{uuid, name, description, createdAt, updatedAt}>>}
 */
export async function getRoles() {
  try {
    const response = await apiClient.get('/roles');
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch roles');
  } catch (error) {
    throw buildError(error, 'Failed to fetch roles');
  }
}

/**
 * POST /roles
 * @param {{name, description?}} payload
 * @returns {Promise<Object>}
 */
export async function createRole(payload) {
  try {
    const response = await apiClient.post('/roles', payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create role');
  } catch (error) {
    throw buildError(error, 'Failed to create role');
  }
}

/**
 * PATCH /roles/:uuid
 * @param {string} uuid
 * @param {{name?, description?}} payload
 * @returns {Promise<Object>}
 */
export async function updateRole(uuid, payload) {
  try {
    const response = await apiClient.patch(`/roles/${uuid}`, payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update role');
  } catch (error) {
    throw buildError(error, 'Failed to update role');
  }
}

/**
 * DELETE /roles/:uuid
 * @param {string} uuid
 * @returns {Promise<Object>}
 */
export async function deleteRole(uuid) {
  try {
    const response = await apiClient.delete(`/roles/${uuid}`);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to delete role');
  } catch (error) {
    throw buildError(error, 'Failed to delete role');
  }
}

/**
 * GET /roles/:roleUuid/permissions
 * @param {string} roleUuid
 * @returns {Promise<Array<{uuid, name, description}>>}
 */
export async function getRolePermissions(roleUuid) {
  try {
    const response = await apiClient.get(`/roles/${roleUuid}/permissions`);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch role permissions');
  } catch (error) {
    throw buildError(error, 'Failed to fetch role permissions');
  }
}

/**
 * POST /roles/:roleUuid/permissions
 * @param {string} roleUuid
 * @param {string} permissionUuid
 * @returns {Promise<Object>}
 */
export async function assignPermissionToRole(roleUuid, permissionUuid) {
  try {
    const response = await apiClient.post(`/roles/${roleUuid}/permissions`, { permissionUuid });
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to assign permission');
  } catch (error) {
    throw buildError(error, 'Failed to assign permission');
  }
}

/**
 * DELETE /roles/:roleUuid/permissions/:permissionUuid
 * @param {string} roleUuid
 * @param {string} permissionUuid
 * @returns {Promise<Object>}
 */
export async function removePermissionFromRole(roleUuid, permissionUuid) {
  try {
    const response = await apiClient.delete(`/roles/${roleUuid}/permissions/${permissionUuid}`);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to remove permission');
  } catch (error) {
    throw buildError(error, 'Failed to remove permission');
  }
}
