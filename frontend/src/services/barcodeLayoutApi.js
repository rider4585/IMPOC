/**
 * Barcode label layout API (R-50): the single saved sheet layout.
 */

import apiClient from '../platform/apiClient.js';
import buildError from '../platform/buildError.js';
import { BARCODE_ROUTES } from '../platform/routes.js';

/** GET /barcode-layouts -> layout object (mm / pt fields, see labelLayout.DEFAULT_LAYOUT) */
export async function getBarcodeLayout() {
  try {
    const response = await apiClient.get(BARCODE_ROUTES.LAYOUT);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to load label layout');
  } catch (error) {
    throw buildError(error, 'Failed to load label layout');
  }
}

/** PUT /barcode-layouts -> saved layout */
export async function saveBarcodeLayout(layout) {
  try {
    const response = await apiClient.put(BARCODE_ROUTES.LAYOUT, layout);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to save label layout');
  } catch (error) {
    throw buildError(error, 'Failed to save label layout');
  }
}

/** GET /barcodes/preview -> PDF Blob (one sample page with the SAVED layout) */
export async function fetchLayoutPreviewPdf() {
  try {
    const response = await apiClient.get(BARCODE_ROUTES.PREVIEW, { responseType: 'arraybuffer' });
    return new Blob([response.data], { type: 'application/pdf' });
  } catch (error) {
    throw buildError(error, 'Failed to render the preview sheet');
  }
}
