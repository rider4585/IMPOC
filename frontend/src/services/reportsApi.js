import apiClient from '../platform/apiClient.js';
import buildError from '../platform/buildError.js';

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

/**
 * GET /reports/sales-by-tag - takings grouped by transaction tag (R-73).
 *
 * The query string is built by hand (not axios `params`) so the multi-tag list
 * serialises as one comma-separated `tagUuids` value, which is what the API
 * contract declares - `?from=&to=` today, plus optional `tagUuids` for the same
 * OR semantics as the sales list.
 *
 * Response:
 *   { period: {from, to},
 *     rows: [{ tagUuid: string|null, tagName, count, grossPaise, refundedPaise,
 *              netPaise, unitsSold }],
 *     totals: { count, grossPaise, refundedPaise, netPaise, unitsSold,
 *               salesWithMultipleTags } }
 *
 * A sale with N tags contributes its full totals to EACH of its N rows, so
 * rows[] deliberately sums to more than totals - see `salesWithMultipleTags`.
 * The Untagged row comes back with `tagUuid: null`.
 *
 * @param {{from?: string, to?: string, tagUuids?: string[]}} [params] ISO YYYY-MM-DD
 * @returns {Promise<Object>} the report payload above
 */
export async function getSalesByTag({ from, to, tagUuids } = {}) {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const tags = Array.isArray(tagUuids) ? tagUuids.filter(Boolean) : [];
  if (tags.length > 0) query.set('tagUuids', tags.join(','));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  try {
    const response = await apiClient.get(`/reports/sales-by-tag${suffix}`);
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to load sales-by-tag report');
  } catch (error) {
    throw buildError(error, 'Failed to load sales-by-tag report');
  }
}
