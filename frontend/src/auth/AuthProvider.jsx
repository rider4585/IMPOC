import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from './AuthContext.jsx';
import { login as loginAPI, refresh as refreshAPI, logout as logoutAPI, getCurrentUser as getCurrentUserAPI } from '../services/authApi.js';
import { setAccessTokenGetter, setTokenRefreshHandler } from '../platform/apiClient.js';

/**
 * AuthProvider component - the actual provider that wraps the app
 * Holds:
 * - accessToken (in memory only, never persisted)
 * - currentUser (user data from login or GET /auth/me)
 * - permissions (string array from login or GET /auth/me)
 * - status: 'signed-out' | 'restoring' | 'signed-in' | 'session-expired'
 * - sessionExpiredMessage: "Your session expired. Sign in again to continue."
 */
export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [status, setStatus] = useState('signed-out'); // 'signed-out' | 'restoring' | 'signed-in' | 'session-expired'
  const [sessionExpiredMessage] = useState('Your session expired. Sign in again to continue.');
  const isMountedRef = useRef(true);
  // Ref mirrors accessToken so the apiClient getter can read the token
  // synchronously (before the [accessToken] effect re-runs) — fixes the
  // boot restore path where getCurrentUserAPI ran with a stale getter.
  const accessTokenRef = useRef(null);

  /**
   * Update both the in-memory state and the synchronous ref used by the getter.
   */
  const updateAccessToken = useCallback((token) => {
    accessTokenRef.current = token;
    setAccessToken(token);
  }, []);

  /**
   * Clear the in-memory access token (e.g., on session expiry or logout)
   */
  const handleSessionExpired = useCallback(() => {
    updateAccessToken(null);
    setCurrentUser(null);
    setPermissions([]);
    setStatus('session-expired');
  }, [updateAccessToken]);

  /**
   * Sign in with username and password
   * Stores token in memory and localStorage (for page reload recovery)
   * Stores user and permissions in memory; transitions status to signed-in
   */
  const signIn = useCallback(async (username, password) => {
    const data = await loginAPI(username, password);
    // data: { uuid, username, email, firstName, lastName, status, lastLoginAt, permissions, accessToken, refreshTokenExpiresAt }

    setAccessToken(data.accessToken);
    accessTokenRef.current = data.accessToken;
    localStorage.setItem('accessToken', data.accessToken);
    setCurrentUser({
      uuid: data.uuid,
      username: data.username,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      status: data.status,
      lastLoginAt: data.lastLoginAt,
    });
    setPermissions(data.permissions || []);
    setStatus('signed-in');

    return data;
  }, []);

  /**
   * Sign out: calls POST /auth/logout, clears token from memory and storage, transitions to signed-out
   */
  const signOut = useCallback(async () => {
    try {
      await logoutAPI();
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      updateAccessToken(null);
      setCurrentUser(null);
      setPermissions([]);
      setStatus('signed-out');
      localStorage.removeItem('accessToken');
    }
  }, [updateAccessToken]);

  /**
   * Boot-time session restoration:
   * 1. Tries POST /auth/refresh (cookie automatic)
   * 2. If that fails, tries to restore token from localStorage
   * 3. Then fetches user info with the token
   * Sets status to 'restoring' during the process
   */
  useEffect(() => {
    const restoreSession = async () => {
      if (!isMountedRef.current) return;
      setStatus('restoring');
      try {
        // Attempt to refresh the access token using the httpOnly cookie
        let newAccessToken;
        try {
          const refreshData = await refreshAPI();
          newAccessToken = refreshData.accessToken;
        } catch (refreshError) {
          // Refresh failed - try to restore token from localStorage as fallback
          const storedToken = localStorage.getItem('accessToken');
          if (storedToken) {
            newAccessToken = storedToken;
          } else {
            throw refreshError; // No cookie, no stored token - sign out
          }
        }

        if (!isMountedRef.current) return;
        // Make the new access token available to the getter synchronously so
        // the following getCurrentUserAPI call sends the Authorization header.
        updateAccessToken(newAccessToken);

        // Fetch current user info with the token
        const userData = await getCurrentUserAPI();
        // userData: { uuid, username, email, firstName, lastName, phone, status, lastLoginAt, permissions, createdAt, updatedAt }

        if (!isMountedRef.current) return;
        setCurrentUser({
          uuid: userData.uuid,
          username: userData.username,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          status: userData.status,
          lastLoginAt: userData.lastLoginAt,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,
        });
        setPermissions(userData.permissions || []);
        setStatus('signed-in');
      } catch {
        // Refresh or GET /auth/me failed (expired/revoked/absent cookie/token)
        // This is the normal signed-out state, not an interruption
        if (!isMountedRef.current) return;
        updateAccessToken(null);
        setCurrentUser(null);
        setPermissions([]);
        setStatus('signed-out');
        localStorage.removeItem('accessToken');
      }
    };

    restoreSession();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Wire the access token getter so every authenticated request reads from the
   * synchronous accessTokenRef. The getter ignores the [accessToken] effect
   * timing so a freshly-set token is immediately available to apiClient.
   */
  useEffect(() => {
    setAccessTokenGetter(() => accessTokenRef.current);
  }, []);

  /**
   * After a background refresh succeeds (via the apiClient 401 interceptor),
   * update the in-memory token so subsequent requests use the new token.
   */
  useEffect(() => {
    setTokenRefreshHandler((newToken, refreshTokenExpiresAt) => {
      if (isMountedRef.current) {
        updateAccessToken(newToken);
      }
    });
    return () => {
      setTokenRefreshHandler(null);
    };
  }, [updateAccessToken]);

  /**
   * Register a global unhandled promise rejection listener to catch SESSION_EXPIRED errors
   * that escape the interceptor (e.g., from async components that don't wrap their calls)
   */
  useEffect(() => {
    let isHandlingExpiry = false;

    const handleUnhandledRejection = (event) => {
      // Guard against null/undefined event.reason
      if (!event || !event.reason) {
        return;
      }

      // Check if the error is a SESSION_EXPIRED error (use name field for strict check)
      if (event.reason.name === 'SESSION_EXPIRED') {
        // Prevent duplicate handling of the same error
        if (isHandlingExpiry || !isMountedRef.current) {
          return;
        }
        isHandlingExpiry = true;

        try {
          // Prevent the unhandled rejection from logging to console
          event.preventDefault();

          // Transition to session-expired state
          if (isMountedRef.current) {
            handleSessionExpired();
          }
        } catch (error) {
          // If handleSessionExpired throws, log and re-throw to signal critical failure
          console.error('Error in handleSessionExpired:', error);
          throw error;
        } finally {
          // Allow handling the next SESSION_EXPIRED error
          isHandlingExpiry = false;
        }
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [handleSessionExpired]);

  const value = {
    accessToken,
    currentUser,
    permissions,
    status,
    sessionExpiredMessage,
    signIn,
    signOut,
    handleSessionExpired, // Exported for other modules to call if needed
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
