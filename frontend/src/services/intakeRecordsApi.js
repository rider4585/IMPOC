import apiClient from '../platform/apiClient.js';
import { INTAKE_RECORD_ROUTES } from '../platform/routes.js';

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

export async function getIntakeRecords() {
  try {
    const response = await apiClient.get(INTAKE_RECORD_ROUTES.LIST);
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to fetch intake records');
  } catch (error) {
    throw buildError(error, 'Failed to fetch intake records');
  }
}

export async function createIntakeRecord(payload) {
  try {
    const response = await apiClient.post(INTAKE_RECORD_ROUTES.CREATE, payload);
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to create intake record');
  } catch (error) {
    throw buildError(error, 'Failed to create intake record');
  }
}

export async function getIntakeRecord(intakeUuid) {
  try {
    const response = await apiClient.get(INTAKE_RECORD_ROUTES.GET(intakeUuid));
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to fetch intake record');
  } catch (error) {
    throw buildError(error, 'Failed to fetch intake record');
  }
}

export async function updateIntakeRecord(intakeUuid, payload) {
  try {
    const response = await apiClient.patch(INTAKE_RECORD_ROUTES.UPDATE(intakeUuid), payload);
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to update intake record');
  } catch (error) {
    throw buildError(error, 'Failed to update intake record');
  }
}

export async function createIntakeTemplate(intakeUuid, payload) {
  try {
    const response = await apiClient.post(INTAKE_RECORD_ROUTES.CREATE_TEMPLATE(intakeUuid), payload);
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to create template');
  } catch (error) {
    throw buildError(error, 'Failed to create template');
  }
}

export async function updateIntakeTemplate(intakeUuid, uuid, payload) {
  try {
    const response = await apiClient.patch(INTAKE_RECORD_ROUTES.UPDATE_TEMPLATE(intakeUuid, uuid), payload);
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to update template');
  } catch (error) {
    throw buildError(error, 'Failed to update template');
  }
}

export async function deleteIntakeTemplate(intakeUuid, uuid) {
  try {
    const response = await apiClient.delete(INTAKE_RECORD_ROUTES.DELETE_TEMPLATE(intakeUuid, uuid));
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || 'Failed to delete template');
  } catch (error) {
    throw buildError(error, 'Failed to delete template');
  }
}
