/** Shop branding API (R-58): name + logo shared across devices. GET is public. */
import apiClient from '../platform/apiClient.js';
import buildError from '../platform/buildError.js';

const BRANDING = '/branding';

export async function getBranding() {
  try {
    const response = await apiClient.get(BRANDING);
    if (response.data?.success && response.data?.data) return response.data.data;
    throw new Error(response.data?.message || 'Failed to load shop branding');
  } catch (error) {
    throw buildError(error, 'Failed to load shop branding');
  }
}

/** @param {{shopName: string, logoDataUrl?: string|null}} payload - logoDataUrl null removes, undefined keeps */
export async function saveBranding(payload) {
  try {
    const response = await apiClient.put(BRANDING, payload);
    if (response.data?.success && response.data?.data) return response.data.data;
    throw new Error(response.data?.message || 'Failed to save shop branding');
  } catch (error) {
    throw buildError(error, 'Failed to save shop branding');
  }
}
