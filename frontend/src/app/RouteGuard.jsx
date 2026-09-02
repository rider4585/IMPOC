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
        <div style={{ padding: '40px', textAlign: 'center' }}>
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
 * - restoring: render SignIn with loading state
 * - signed-in: render children (the routed page)
 * - session-expired: render SignIn with expiry message
 */
export function RouteGuard({ children }) {
  const authContext = useAuth();

  // Null check for useAuth() return value (patch 1)
  if (!authContext) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
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

  // For signed-out, restoring, or session-expired: show the SignIn screen
  // SignIn.jsx already handles the restoring loading state internally
  return (
    <ErrorBoundary>
      <div>
        {status === 'session-expired' && (
          <div
            className="session-expired-banner"
            style={{
              padding: '16px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              marginBottom: '16px',
            }}
          >
            {sessionExpiredMessage || 'Your session expired. Sign in again to continue.'}
          </div>
        )}
        <SignIn />
      </div>
    </ErrorBoundary>
  );
}

export default RouteGuard;
