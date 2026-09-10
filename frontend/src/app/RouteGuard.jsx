import React, { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import SignIn from '../screens/SignIn';

/**
 * ErrorBoundary — catches and displays route rendering errors gracefully
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('RouteGuard error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center">
          <h2>Something went wrong</h2>
          <p>Please try refreshing the page or signing in again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * RouteGuard — blocks all routes until the user is signed in.
 *
 * Status states:
 * - signed-out: render SignIn
 * - restoring: render SignIn (restore is fast, no separate loading hint)
 * - signed-in: render children (the routed page)
 * - session-expired: render SignIn with expiry message
 */
export function RouteGuard({ children }) {
  const authContext = useAuth();

  // Null check for useAuth() return value (patch 1)
  if (!authContext) {
    return (
      <div className="p-10 text-center">
        <p>Authentication context not available.</p>
      </div>
    );
  }

  const { status, sessionExpiredMessage } = authContext;

  // Default case for unexpected status values (patch 7)
  const validStatuses = ['signed-out', 'restoring', 'signed-in', 'session-expired'];
  if (!validStatuses.includes(status)) {
    console.warn(`Unexpected auth status: ${status}`);
  }

  if (status === 'signed-in') {
    return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  // For signed-out, restoring, or session-expired: show the SignIn screen.
  // Session restore is instant; SignIn renders directly during it.
  return (
    <ErrorBoundary>
      <div>
        {status === 'session-expired' && (
          <div className="mb-4 rounded-md bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]" role="alert">
            {sessionExpiredMessage || 'Your session expired. Sign in again to continue.'}
          </div>
        )}
        <SignIn />
      </div>
    </ErrorBoundary>
  );
}

export default RouteGuard;
