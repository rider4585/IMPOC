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

/* R-56: layout templates (named snapshots of a layout) */

const TEMPLATES = `${BARCODE_ROUTES.LAYOUT}/templates`;

export async function getBarcodeLayoutTemplates() {
  try {
    const response = await apiClient.get(TEMPLATES);
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to load layout templates');
  } catch (error) {
    throw buildError(error, 'Failed to load layout templates');
  }
}

export async function createBarcodeLayoutTemplate({ name, layout }) {
  try {
    const response = await apiClient.post(TEMPLATES, { name, layout });
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to save layout template');
  } catch (error) {
    throw buildError(error, 'Failed to save layout template');
  }
}

export async function deleteBarcodeLayoutTemplate(uuid) {
  try {
    const response = await apiClient.delete(`${TEMPLATES}/${uuid}`);
    if (response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Failed to delete layout template');
  } catch (error) {
    throw buildError(error, 'Failed to delete layout template');
  }
}
