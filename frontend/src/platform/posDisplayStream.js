import { getApiBaseUrl } from './apiClient.js';

/**
 * Builds the public SSE stream URL for a POS-display code. No auth is
 * required (or sent) — the customer-facing display page connects directly.
 */
export function getPosDisplayStreamUrl(code) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}/pos-display/${encodeURIComponent(code)}/stream`;
}
