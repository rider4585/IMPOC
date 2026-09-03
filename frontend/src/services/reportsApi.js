import apiClient from '../platform/apiClient.js';

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

export async function getDashboard({ from, to } = {}) {
  try {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await apiClient.get('/reports/dashboard', { params });
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to load dashboard');
  } catch (error) {
    throw buildError(error, 'Failed to load dashboard');
  }
}

export async function getSalesReport({ from, to } = {}) {
  try {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await apiClient.get('/reports/sales', { params });
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to load sales report');
  } catch (error) {
    throw buildError(error, 'Failed to load sales report');
  }
}

export async function getRentalsReport({ from, to } = {}) {
  try {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await apiClient.get('/reports/rentals', { params });
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to load rentals report');
  } catch (error) {
    throw buildError(error, 'Failed to load rentals report');
  }
}

export async function getExpensesReport({ from, to } = {}) {
  try {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await apiClient.get('/reports/expenses', { params });
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to load expenses report');
  } catch (error) {
    throw buildError(error, 'Failed to load expenses report');
  }
}

export async function getInventoryReport() {
  try {
    const response = await apiClient.get('/reports/inventory');
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to load inventory report');
  } catch (error) {
    throw buildError(error, 'Failed to load inventory report');
  }
}
