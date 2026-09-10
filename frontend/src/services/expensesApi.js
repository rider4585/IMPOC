/**
 * Expenses API service
 * Thin wrappers over apiClient for /expenses endpoints.
 * T-13 expenses screens.
 */

import apiClient from '../platform/apiClient.js';
import { EXPENSE_ROUTES } from '../platform/routes.js';
import { createRequestKey } from '../platform/requestKey.js';
import buildError from '../platform/buildError.js';

/**
 * GET /expenses
 * @returns {Promise<Array>} list of expense DTOs, newest first
 */
export async function listExpenses() {
  try {
    const response = await apiClient.get(EXPENSE_ROUTES.LIST);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to load expenses');
  } catch (error) {
    throw buildError(error, 'Failed to load expenses');
  }
}

/**
 * POST /expenses - Create an expense
 * @param {{amountPaise, category, purpose?, expenseDate?, notes?, requestUuid?}} payload
 * requestUuid (SEC-M-3 idempotency): pass to reuse across retries of the same intent; the service mints one when absent.
 * @returns {Promise<Object>} created expense DTO
 */
export async function createExpense(payload) {
  try {
    const response = await apiClient.post(EXPENSE_ROUTES.CREATE, {
      ...payload,
      requestUuid: payload?.requestUuid || createRequestKey(),
    });
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to create expense');
  } catch (error) {
    throw buildError(error, 'Failed to create expense');
  }
}

/**
 * GET /expenses/:uuid
 * @param {string} uuid
 * @returns {Promise<Object>} expense DTO
 */
export async function getExpense(uuid) {
  try {
    const response = await apiClient.get(EXPENSE_ROUTES.GET(uuid));
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to load expense');
  } catch (error) {
    throw buildError(error, 'Failed to load expense');
  }
}

/**
 * PATCH /expenses/:uuid - Update an expense (pre-completion only)
 * @param {string} uuid
 * @param {{amountPaise?, category?, purpose?, expenseDate?, notes?}} payload
 * @returns {Promise<Object>} updated expense DTO
 */
export async function updateExpense(uuid, payload) {
  try {
    const response = await apiClient.patch(EXPENSE_ROUTES.UPDATE(uuid), payload);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update expense');
  } catch (error) {
    throw buildError(error, 'Failed to update expense');
  }
}

/**
 * POST /expenses/:uuid/cancel - Cancel a completed expense (reversal)
 * @param {string} uuid
 * @param {{reason?}} payload
 * @param {{requestUuid?}} options - pass to reuse across retries of the same intent; the service mints one when absent.
 * @returns {Promise<Object>} updated expense DTO
 */
export async function cancelExpense(uuid, reason, options = {}) {
  try {
    const response = await apiClient.post(EXPENSE_ROUTES.CANCEL(uuid), {
      reason: reason || undefined,
      requestUuid: options.requestUuid || createRequestKey(),
    });
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Cancel failed');
  } catch (error) {
    throw buildError(error, 'Cancel failed');
  }
}
