import apiClient from '../platform/apiClient.js';
import buildError from '../platform/buildError.js';

const BASE = '/receipt-templates';
const SNAP_BASE = '/receipt-snapshots';

export const receiptTemplateApi = {
  async listTemplates(entityType) {
    try {
      const params = entityType ? { entityType } : {};
      const response = await apiClient.get(BASE, { params });
      if (response.data?.success && response.data?.data) return response.data.data;
      throw new Error(response.data?.message || 'Failed to load templates');
    } catch (error) {
      throw buildError(error, 'Failed to load templates');
    }
  },

  async getTemplate(uuid) {
    try {
      const response = await apiClient.get(`${BASE}/${encodeURIComponent(uuid)}`);
      if (response.data?.success && response.data?.data) return response.data.data;
      throw new Error(response.data?.message || 'Failed to load template');
    } catch (error) {
      throw buildError(error, 'Failed to load template');
    }
  },

  async createTemplate(data) {
    try {
      const response = await apiClient.post(BASE, data);
      if (response.data?.success && response.data?.data) return response.data.data;
      throw new Error(response.data?.message || 'Failed to create template');
    } catch (error) {
      throw buildError(error, 'Failed to create template');
    }
  },

  async updateTemplate(uuid, data) {
    try {
      const response = await apiClient.put(`${BASE}/${encodeURIComponent(uuid)}`, data);
      if (response.data?.success && response.data?.data) return response.data.data;
      throw new Error(response.data?.message || 'Failed to update template');
    } catch (error) {
      throw buildError(error, 'Failed to update template');
    }
  },

  async activateTemplate(uuid) {
    try {
      const response = await apiClient.post(`${BASE}/${encodeURIComponent(uuid)}/activate`);
      if (response.data?.success && response.data?.data) return response.data.data;
      throw new Error(response.data?.message || 'Failed to activate template');
    } catch (error) {
      throw buildError(error, 'Failed to activate template');
    }
  },

  async getActiveTemplate(entityType) {
    try {
      const response = await apiClient.get(`${BASE}/active`, { params: { entityType } });
      if (response.data?.success && response.data?.data) return response.data.data;
      throw new Error(response.data?.message || 'No active template');
    } catch (error) {
      throw buildError(error, 'No active template');
    }
  },

  async previewTemplate(data) {
    try {
      const response = await apiClient.post(`${BASE}/preview`, data);
      if (response.data?.success && response.data?.data) return response.data.data;
      throw new Error(response.data?.message || 'Failed to preview template');
    } catch (error) {
      throw buildError(error, 'Failed to preview template');
    }
  },

  async getSnapshot(entityType, entityUuid) {
    try {
      const response = await apiClient.get(
        `${SNAP_BASE}/${encodeURIComponent(entityType)}/${encodeURIComponent(entityUuid)}`
      );
      if (response.data?.success && response.data?.data) return response.data.data;
      return null;
    } catch {
      return null;
    }
  },

  async listSnapshots(entityType) {
    try {
      const params = entityType ? { entityType } : {};
      const response = await apiClient.get(SNAP_BASE, { params });
      if (response.data?.success && response.data?.data) return response.data.data;
      throw new Error(response.data?.message || 'Failed to load snapshots');
    } catch (error) {
      throw buildError(error, 'Failed to load snapshots');
    }
  },

  async exportSnapshots() {
    try {
      const response = await apiClient.get(`${SNAP_BASE}/export`);
      if (response.data?.success && response.data?.data) return response.data.data;
      throw new Error(response.data?.message || 'Failed to export snapshots');
    } catch (error) {
      throw buildError(error, 'Failed to export snapshots');
    }
  },
};

export default receiptTemplateApi;
