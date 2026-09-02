import axios from 'axios';

/**
 * Shared axios instance for all API calls.
 * Configured with:
 * - withCredentials: true (for httpOnly cookies)
 * - Base URL from VITE_API_BASE_URL environment variable
 * - Access token injection via registered getter
 * - 401 response interceptor with request queueing and SESSION_EXPIRED error handling
 */

let accessTokenGetter = null;

// Optional handler invoked after a successful background refresh so the caller
// (e.g. AuthProvider) can update its in-memory token state with the new value.
let tokenRefreshHandler = null;

// State for managing concurrent 401 refresh attempts
// Only one refresh in flight at a time; others queue and wait
let refreshPromise = null;

/**
 * Register a function that returns the current access token.
 * Called for each authenticated request to get the token.
 *
 * @param {Function|null} getter - Function that returns access token string, or null to clear
 */
export function setAccessTokenGetter(getter) {
  accessTokenGetter = getter;
}

/**
 * Register a callback invoked after a successful background refresh.
 *
 * @param {Function|null} handler - (accessToken, refreshTokenExpiresAt) => void, or null to clear
 */
export function setTokenRefreshHandler(handler) {
  tokenRefreshHandler = handler;
}

/**
 * Determine the API base URL from environment or defaults.
 * Validates that VITE_API_BASE_URL is present and not empty.
 */
function getBaseURL() {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  // Use environment variable if it exists and is not empty
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl;
  }

  // If not in production, allow default
  if (import.meta.env.DEV) {
    return '/api';
  }

  // In production, base URL must be explicitly configured
  throw new Error(
    'VITE_API_BASE_URL environment variable is not set or is empty. ' +
    'Frontend cannot determine API base URL for production deployment.'
  );
}

/**
 * Create and export the configured axios instance.
 */
const apiClient = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
});

/**
 * Request interceptor to add Authorization header if token getter is registered,
 * and X-Requested-With header for auth endpoints (CSRF protection).
 */
apiClient.interceptors.request.use(
  (config) => {
    // Add Authorization header if token getter is registered
    if (accessTokenGetter) {
      try {
        const token = accessTokenGetter();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        // If the getter throws, log the error but continue without auth header
        console.error('Error calling access token getter:', error);
      }
    }

    // Add X-Requested-With header for auth endpoints (CSRF protection via requireSpaHeader middleware)
    if (config.url && config.url.includes('/auth/')) {
      config.headers['X-Requested-With'] = 'impoc-spa';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor to handle 401 errors with queue-based refresh attempt
 * When a 401 is received:
 * - If no refresh is in progress, attempt exactly one POST /auth/refresh (with 5-second timeout)
 * - If a refresh is already in progress, queue this request and retry after refresh completes
 * - If refresh fails (any 4xx/5xx/timeout), reject with SESSION_EXPIRED error
 * - If refresh succeeds, retry the original request with the new token
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401 errors that haven't been retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const applyRefreshedToken = (refreshData) => {
        const newToken = refreshData?.accessToken;
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          if (tokenRefreshHandler) {
            tokenRefreshHandler(newToken, refreshData.refreshTokenExpiresAt);
          }
        }
      };

      // Cache the current refreshPromise to avoid race conditions where it's cleared between check and use
      const currentRefreshPromise = refreshPromise;

      // If a refresh is already in progress, queue this request
      if (currentRefreshPromise) {
        return currentRefreshPromise
          .then((refreshData) => {
            // Apply the new access token and retry the original request
            applyRefreshedToken(refreshData);
            return apiClient(originalRequest);
          })
          .catch((refreshError) => {
            // If refresh failed, propagate the SESSION_EXPIRED error
            throw refreshError;
          });
      }

      // Otherwise, start a new refresh attempt
      refreshPromise = attemptRefresh();

      return refreshPromise
        .then((refreshData) => {
          // Apply the new access token and retry the original request
          applyRefreshedToken(refreshData);
          return apiClient(originalRequest);
        })
        .catch((refreshError) => {
          // If refresh failed, propagate the error
          throw refreshError;
        })
        .finally(() => {
          // Clear the refresh promise so the next 401 can start a fresh refresh
          refreshPromise = null;
        });
    }

    return Promise.reject(error);
  }
);

/**
 * Attempt to refresh the access token with a 30-second timeout
 * Creates a SESSION_EXPIRED error if the refresh fails
 * @returns {Promise<{accessToken, refreshTokenExpiresAt}>} the refreshed token data
 */
async function attemptRefresh() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    // Post refresh request with abort signal for timeout
    const response = await apiClient.post('/auth/refresh', {
      // Empty body; refresh token is sent via httpOnly cookie
    }, {
      signal: controller.signal,
    });

    // Success - the token has been refreshed and new cookie is set by browser
    // Return the new accessToken so callers can update their in-memory state
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    return response.data?.data || null;
  } catch (error) {
    // Create a distinct SESSION_EXPIRED error to signal auth failure
    let message = error.message || 'Session expired';
    if (error.name === 'AbortError') {
      message = 'Refresh request timeout';
    }
    const sessionExpiredError = new Error(message);
    sessionExpiredError.name = 'SESSION_EXPIRED';
    throw sessionExpiredError;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default apiClient;
