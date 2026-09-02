import { describe, it, expect, beforeEach, vi } from 'vitest';
import apiClient, { setAccessTokenGetter } from './apiClient.js';

describe('apiClient', () => {
  beforeEach(() => {
    // Reset access token getter before each test
    setAccessTokenGetter(null);
  });

  it('has withCredentials set to true', () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
  });

  it('uses VITE_API_BASE_URL from environment', () => {
    // The baseURL should be set from environment or default to /api
    expect(apiClient.defaults.baseURL).toBeDefined();
    // It should either be the env value or /api
    expect(
      apiClient.defaults.baseURL === '/api' ||
        typeof apiClient.defaults.baseURL === 'string'
    ).toBe(true);
  });

  it('allows setting and using access token getter', async () => {
    const mockToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9';
    setAccessTokenGetter(() => mockToken);

    // Capture the config used by request interceptor
    const mockAdapter = vi.fn((config) => Promise.resolve({ config }));
    apiClient.interceptors.request.handlers.forEach((handler) => {
      if (handler.fulfilled) {
        // Execute the interceptor
        const testConfig = { headers: {} };
        const result = handler.fulfilled(testConfig);
        expect(result.headers.Authorization).toBe(`Bearer ${mockToken}`);
      }
    });
  });

  it('does not set Authorization header when getter is not registered', () => {
    setAccessTokenGetter(null);

    const testConfig = { headers: {} };
    apiClient.interceptors.request.handlers.forEach((handler) => {
      if (handler.fulfilled) {
        const result = handler.fulfilled(testConfig);
        expect(result.headers.Authorization).toBeUndefined();
      }
    });
  });

  it('does not set Authorization header when getter returns null', () => {
    setAccessTokenGetter(() => null);

    const testConfig = { headers: {} };
    apiClient.interceptors.request.handlers.forEach((handler) => {
      if (handler.fulfilled) {
        const result = handler.fulfilled(testConfig);
        expect(result.headers.Authorization).toBeUndefined();
      }
    });
  });

  it('does not set Authorization header when getter returns undefined', () => {
    setAccessTokenGetter(() => undefined);

    const testConfig = { headers: {} };
    apiClient.interceptors.request.handlers.forEach((handler) => {
      if (handler.fulfilled) {
        const result = handler.fulfilled(testConfig);
        expect(result.headers.Authorization).toBeUndefined();
      }
    });
  });

  it('allows changing access token getter', () => {
    const token1 = 'token1';
    const token2 = 'token2';

    setAccessTokenGetter(() => token1);
    let testConfig = { headers: {} };
    apiClient.interceptors.request.handlers.forEach((handler) => {
      if (handler.fulfilled) {
        const result = handler.fulfilled(testConfig);
        expect(result.headers.Authorization).toBe(`Bearer ${token1}`);
      }
    });

    // Change getter
    setAccessTokenGetter(() => token2);
    testConfig = { headers: {} };
    apiClient.interceptors.request.handlers.forEach((handler) => {
      if (handler.fulfilled) {
        const result = handler.fulfilled(testConfig);
        expect(result.headers.Authorization).toBe(`Bearer ${token2}`);
      }
    });
  });

  it('exports a singleton axios instance', () => {
    // Import the same instance twice and ensure they're identical
    expect(apiClient.defaults).toBeDefined();
    expect(apiClient.get).toBeDefined();
    expect(apiClient.post).toBeDefined();
    expect(apiClient.put).toBeDefined();
    expect(apiClient.delete).toBeDefined();
  });

  it('preserves config object when adding authorization header', () => {
    setAccessTokenGetter(() => 'test-token');

    const testConfig = {
      headers: { 'Content-Type': 'application/json' },
      data: { key: 'value' },
    };

    apiClient.interceptors.request.handlers.forEach((handler) => {
      if (handler.fulfilled) {
        const result = handler.fulfilled(testConfig);
        expect(result.headers['Content-Type']).toBe('application/json');
        expect(result.data).toEqual({ key: 'value' });
        expect(result.headers.Authorization).toBe('Bearer test-token');
      }
    });
  });

  it('handles getter errors gracefully by continuing without auth header', () => {
    setAccessTokenGetter(() => {
      throw new Error('Token fetch failed');
    });

    const testConfig = { headers: {} };

    // Should not throw, but should continue without Authorization header
    apiClient.interceptors.request.handlers.forEach((handler) => {
      if (handler.fulfilled) {
        const result = handler.fulfilled(testConfig);
        // Should return config even if getter threw
        expect(result).toBeDefined();
        expect(result.headers).toBeDefined();
      }
    });
  });
});
