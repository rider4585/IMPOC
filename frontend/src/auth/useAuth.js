import { useContext } from 'react';
import { AuthContext } from './AuthContext.jsx';

/**
 * Hook to consume AuthContext
 * Returns: { accessToken, currentUser, permissions, status, sessionExpiredMessage, signIn, signOut }
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
