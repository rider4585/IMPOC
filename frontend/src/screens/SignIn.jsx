import React, { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { Card, CardContent, Input, Button } from '../components/ui';

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
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)] p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-8">
          <h1 className="typography-heading mb-6 text-center">Sign In</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="username"
              label="Username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
              required
            />

            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !username || !password}
              loading={isLoading}
              className="mt-2"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {status === 'restoring' && (
            <p className="mt-4 text-center text-sm text-[var(--ink-muted)]">
              Restoring your session...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SignIn;
