/**
 * Rental agreements API service
 * Thin wrappers over apiClient for /rentals endpoints.
 * T-11 rental screens.
 */

import apiClient from '../platform/apiClient.js';
import { RENTAL_ROUTES } from '../platform/routes.js';

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
 * GET /rentals
 * @returns {Promise<Array>} list of rental agreement DTOs, newest first
 */
export async function listRentals() {
  try {
    const response = await apiClient.get(RENTAL_ROUTES.LIST);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to load rentals');
  } catch (error) {
    throw buildError(error, 'Failed to load rentals');
  }
}

/**
 * POST /rentals - Create / check out a rental agreement
 * @param {{customerName?, customerUuid?, startDate?, rentalDays?, notes?, items: Array<{unitUuid?|barcode?}>}} payload
 * customerUuid (Schema V2) links a customers entity; customerName free text stays supported.
 * @returns {Promise<Object>} agreement DTO
 */
export async function createRental(payload) {
  try {
    const response = await apiClient.post(RENTAL_ROUTES.CREATE, payload);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Checkout failed');
  } catch (error) {
    throw buildError(error, 'Checkout failed');
  }
}

/**
 * GET /rentals/:uuid
 * @param {string} uuid
 * @returns {Promise<Object>} agreement DTO
 */
export async function getRental(uuid) {
  try {
    const response = await apiClient.get(RENTAL_ROUTES.GET(uuid));
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to load agreement');
  } catch (error) {
    throw buildError(error, 'Failed to load agreement');
  }
}

/**
 * POST /rentals/:uuid/return - Process a return of one or more units
 * @param {string} uuid
 * @param {{actualReturnDate?, items: Array<{unitUuid?|barcode?, gradeUuid?, damageChargePaise?, notes?}>}} payload
 * @returns {Promise<Object>} updated agreement DTO
 */
export async function processRentalReturn(uuid, payload) {
  try {
    const response = await apiClient.post(RENTAL_ROUTES.RETURN(uuid), payload);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Return failed');
  } catch (error) {
    throw buildError(error, 'Return failed');
  }
}

/**
 * POST /rentals/:uuid/cancel - Cancel an active agreement
 * @param {string} uuid
 * @param {{reason?}} payload
 * @returns {Promise<Object>} updated agreement DTO
 */
export async function cancelRental(uuid, reason) {
  try {
    const response = await apiClient.post(RENTAL_ROUTES.CANCEL(uuid), {
      reason: reason || undefined,
    });
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Cancel failed');
  } catch (error) {
    throw buildError(error, 'Cancel failed');
  }
}
