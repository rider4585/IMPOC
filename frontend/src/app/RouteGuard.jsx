import React, { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import SignIn from '../screens/SignIn';

/**
 * ErrorBoundary — catches and displays route rendering errors gracefully
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('RouteGuard error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-lg p-6 text-center">
          <h2 className="mb-2 text-xl font-bold text-[var(--danger,#e11d48)]">Something went wrong</h2>
          <p className="mb-4 text-sm text-[var(--ink-muted,#6b7280)]">
            Please try refreshing the page or signing in again.
          </p>
          <div className="mb-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Refresh page
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              className="rounded-md border border-[var(--border,#d1d5db)] px-3.5 py-2 text-xs font-semibold text-[var(--ink,#111827)] hover:bg-[var(--surface-sunken,#f3f4f6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Go to sign in
            </button>
          </div>
          {this.state.error && (
            <details className="mt-4 text-left rounded-md border border-[var(--danger,#e11d48)]/20 bg-[var(--danger,#e11d48)]/5 p-3 text-xs text-[var(--danger,#e11d48)]">
              <summary className="cursor-pointer font-semibold select-none">
                Error details ({this.state.error.name || 'Error'})
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {this.state.error.message || String(this.state.error)}
                {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
                {this.state.errorInfo?.componentStack ? `\n\nComponent stack:${this.state.errorInfo.componentStack}` : ''}
              </pre>
            </details>
          )}
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
