/**
 * POS-display channel API (R-35).
 * The POS publishes its current payment step; the public /display/:code page
 * subscribes to the SSE stream directly (see platform/posDisplayStream.js) —
 * never through this authenticated client.
 */

import apiClient from '../platform/apiClient.js';
import buildError from '../platform/buildError.js';

/**
 * POST /pos-display/:code
 * @param {string} code
 * @param {{status: 'idle'|'awaiting'|'received', method?: 'UPI'|'Cash', amountPaise?: number, upiUri?: string}} state
 */
export async function publishPosDisplayState(code, state) {
  try {
    const response = await apiClient.post(`/pos-display/${code}`, state);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to update customer display');
  } catch (error) {
    throw buildError(error, 'Failed to update customer display');
  }
}
