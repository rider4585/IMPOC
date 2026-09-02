import { createContext } from 'react';

/**
 * AuthContext for holding auth state
 * Used by AuthProvider and accessed via useAuth hook
 * Holds:
 * - accessToken (in memory only, never persisted)
 * - currentUser (user data from login or GET /auth/me)
 * - permissions (string array from login or GET /auth/me)
 * - status: 'signed-out' | 'restoring' | 'signed-in' | 'session-expired'
 * - sessionExpiredMessage: "Your session expired. Sign in again to continue."
 */
export const AuthContext = createContext();
