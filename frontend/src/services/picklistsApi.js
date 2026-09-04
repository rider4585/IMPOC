/**
 * Picklists API service
 * Thin wrappers over apiClient for the picklist resources:
 * product-types, colours, sizes, damage-grades.
 * T-04 admin screens.
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

const RESOURCE_BASE = {
  productTypes: '/picklists/product-types',
  colours: '/picklists/colours',
  sizes: '/picklists/sizes',
  damageGrades: '/picklists/damage-grades',
};

/**
 * GET /product-types
 * Response: list of {uuid, name, parentUuid, isActive, createdAt, updatedAt}
 */
export async function getProductTypes() {
  try {
    const response = await apiClient.get(RESOURCE_BASE.productTypes);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch product types');
  } catch (error) {
    throw buildError(error, 'Failed to fetch product types');
  }
}

/**
 * POST /product-types
 * @param {{name, parentUuid?}} payload
 */
export async function createProductType(payload) {
  try {
    const response = await apiClient.post(RESOURCE_BASE.productTypes, payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create product type');
  } catch (error) {
    throw buildError(error, 'Failed to create product type');
  }
}

/**
 * PATCH /product-types/:uuid
 * @param {string} uuid
 * @param {{name?, parentUuid?, isActive?}} payload
 */
export async function updateProductType(uuid, payload) {
  try {
    const response = await apiClient.patch(`${RESOURCE_BASE.productTypes}/${uuid}`, payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update product type');
  } catch (error) {
    throw buildError(error, 'Failed to update product type');
  }
}

/**
 * PATCH /product-types/:uuid/deactivate
 * @param {string} uuid
 */
export async function deactivateProductType(uuid) {
  try {
    const response = await apiClient.patch(`${RESOURCE_BASE.productTypes}/${uuid}/deactivate`);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to deactivate product type');
  } catch (error) {
    throw buildError(error, 'Failed to deactivate product type');
  }
}

/**
 * Generic list for flat picklists (colours, sizes, damage-grades).
 * Response: list of {uuid, name, isActive, ...}
 */
export async function getColours() {
  try {
    const response = await apiClient.get(RESOURCE_BASE.colours);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch colours');
  } catch (error) {
    throw buildError(error, 'Failed to fetch colours');
  }
}

export async function getSizes() {
  try {
    const response = await apiClient.get(RESOURCE_BASE.sizes);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch sizes');
  } catch (error) {
    throw buildError(error, 'Failed to fetch sizes');
  }
}

export async function getDamageGrades() {
  try {
    const response = await apiClient.get(RESOURCE_BASE.damageGrades);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to fetch damage grades');
  } catch (error) {
    throw buildError(error, 'Failed to fetch damage grades');
  }
}

/**
 * Generic create for flat picklists.
 * @param {'colours'|'sizes'|'damageGrades'} resource
 * @param {Object} payload
 */
export async function createPicklistItem(resource, payload) {
  try {
    const response = await apiClient.post(RESOURCE_BASE[resource], payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create item');
  } catch (error) {
    throw buildError(error, 'Failed to create item');
  }
}

/**
 * Generic update for flat picklists.
 * @param {'colours'|'sizes'|'damageGrades'} resource
 * @param {string} uuid
 * @param {Object} payload - {name?, isActive?, ...}
 */
export async function updatePicklistItem(resource, uuid, payload) {
  try {
    const response = await apiClient.patch(`${RESOURCE_BASE[resource]}/${uuid}`, payload);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update item');
  } catch (error) {
    throw buildError(error, 'Failed to update item');
  }
}
