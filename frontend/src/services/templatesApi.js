/**
 * Buying template API service
 * Thin wrappers over apiClient for /templates (per-vendor buying templates).
 * Schema V2: templates are owned per vendor; response items carry vendor + productType.
 */

import apiClient from '../platform/apiClient.js';
import { TEMPLATE_ROUTES } from '../platform/routes.js';

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
 * GET /templates
 * @param {string} [vendorUuid] - optional vendor filter passed as ?vendorUuid=
 * @returns {Promise<Array>} list of template DTOs (each has vendor + productType)
 */
export async function getTemplates(vendorUuid = '') {
  try {
    const params = vendorUuid ? { params: { vendorUuid } } : {};
    const response = await apiClient.get(TEMPLATE_ROUTES.LIST, params);
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to fetch templates');
  } catch (error) {
    throw buildError(error, 'Failed to fetch templates');
  }
}

/**
 * GET /templates/:uuid
 * @param {string} uuid
 * @returns {Promise<Object>} template DTO
 */
export async function getTemplate(uuid) {
  try {
    const response = await apiClient.get(TEMPLATE_ROUTES.GET(uuid));
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to fetch template');
  } catch (error) {
    throw buildError(error, 'Failed to fetch template');
  }
}

/**
 * POST /templates
 * @param {Object} payload - {vendorUuid, productTypeUuid, name?, buyingPricePaise, defaultQuantity?, defaultSellingPricePaise?, defaultFloorPricePaise?}
 * @returns {Promise<Object>} created template DTO
 */
export async function createTemplate(payload) {
  try {
    const response = await apiClient.post(TEMPLATE_ROUTES.CREATE, payload);
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to create template');
  } catch (error) {
    throw buildError(error, 'Failed to create template');
  }
}

/**
 * PATCH /templates/:uuid
 * @param {string} uuid
 * @param {Object} payload
 * @returns {Promise<Object>} updated template DTO
 */
export async function updateTemplate(uuid, payload) {
  try {
    const response = await apiClient.patch(TEMPLATE_ROUTES.UPDATE(uuid), payload);
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to update template');
  } catch (error) {
    throw buildError(error, 'Failed to update template');
  }
}

/**
 * DELETE /templates/:uuid
 * @param {string} uuid
 * @returns {Promise<Object>} deleted template DTO
 */
export async function deleteTemplate(uuid) {
  try {
    const response = await apiClient.delete(TEMPLATE_ROUTES.DELETE(uuid));
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to delete template');
  } catch (error) {
    throw buildError(error, 'Failed to delete template');
  }
}