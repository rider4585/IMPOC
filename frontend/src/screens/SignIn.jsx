import React, { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import './SignIn.css';

/**
 * SignIn.jsx — Username/password login form
 *
 * Styled on .surface-flat per DESIGN.md (unnamed-default rule).
 * Submits username/password via useAuth().signIn() and displays server error inline.
 * On successful login, AuthContext transitions to signed-in state.
 */
export function SignIn() {
  const { signIn, status } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(username, password);
      // On success, AuthContext transitions to signed-in and component unmounts via RouteGuard
    } catch (err) {
      // Display server's error message inline on the form
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sign-in-container">
      <div className="sign-in-card surface-flat">
        <h1 className="typography-heading">Sign In</h1>

        <form onSubmit={handleSubmit} className="sign-in-form">
          <div className="form-group">
            <label htmlFor="username" className="typography-label">
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
              className="sign-in-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="typography-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              className="sign-in-input"
              required
            />
          </div>

          {error && <div className="sign-in-error">{error}</div>}

          <button
            type="submit"
            disabled={isLoading || !username || !password}
            className="sign-in-button"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {status === 'restoring' && (
          <div className="sign-in-loading">
            Restoring your session...
          </div>
        )}
      </div>
    </div>
  );
}

export default SignIn;
