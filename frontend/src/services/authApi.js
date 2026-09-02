/**
 * Authentication API service
 * Thin wrappers over apiClient for POST /auth/login, POST /auth/refresh, POST /auth/logout, GET /auth/me
 * All calls include withCredentials: true for httpOnly cookie handling
 */

import apiClient from '../platform/apiClient.js';

/**
 * POST /auth/login
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{uuid, username, email, firstName, lastName, status, lastLoginAt, permissions, accessToken, refreshTokenExpiresAt}>}
 */
export async function login(username, password) {
  try {
    const response = await apiClient.post('/auth/login', {
      username,
      password,
    });

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error(response.data?.message || 'Login failed');
  } catch (error) {
    // Extract server message if available, otherwise use error message
    if (error.response?.data?.message) {
      const err = new Error(error.response.data.message);
      err.statusCode = error.response.status;
      throw err;
    }
    throw error;
  }
}

/**
 * POST /auth/refresh
 * Refresh token is sent via httpOnly cookie, not in body
 * @returns {Promise<{accessToken, refreshTokenExpiresAt}>}
 */
export async function refresh() {
  try {
    const response = await apiClient.post('/auth/refresh', {}, {
      headers: {
        'X-Idempotency-Key': crypto.randomUUID(),
      },
    });

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error(response.data?.message || 'Refresh failed');
  } catch (error) {
    if (error.response?.data?.message) {
      const err = new Error(error.response.data.message);
      err.statusCode = error.response.status;
      throw err;
    }
    throw error;
  }
}

/**
 * POST /auth/logout
 * Clears the httpOnly refresh token cookie server-side
 */
export async function logout() {
  try {
    const response = await apiClient.post('/auth/logout', {});

    if (response.data?.success) {
      return true;
    }

    throw new Error(response.data?.message || 'Logout failed');
  } catch (error) {
    if (error.response?.data?.message) {
      const err = new Error(error.response.data.message);
      err.statusCode = error.response.status;
      throw err;
    }
    throw error;
  }
}

/**
 * GET /auth/me
 * Get current authenticated user's info
 * @returns {Promise<{uuid, username, email, firstName, lastName, phone, status, lastLoginAt, permissions, createdAt, updatedAt}>}
 */
export async function getCurrentUser() {
  try {
    const response = await apiClient.get('/auth/me');

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error(response.data?.message || 'Failed to get current user');
  } catch (error) {
    if (error.response?.data?.message) {
      const err = new Error(error.response.data.message);
      err.statusCode = error.response.status;
      throw err;
    }
    throw error;
  }
}
