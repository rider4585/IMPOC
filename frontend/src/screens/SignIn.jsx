import React, { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { Card, CardContent, Input, Button } from '../components/ui';
import { ShopLogo } from '../components/ShopLogo';

export function SignIn() {
  const { signIn } = useAuth();
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
    <div className="flex min-h-dvh items-center justify-center bg-[var(--surface-base)] px-4 py-8">
      <Card className="w-full max-w-sm shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-8">
            <ShopLogo size={{ logo: 44, text: 'text-xl' }} align="center" className="justify-center" />
            <p className="mt-3 text-center text-sm text-[var(--ink-muted)]">
              Sign in to continue to your account
            </p>
          </div>

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
              autoFocus
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
              <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
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
        </CardContent>
      </Card>
    </div>
  );
}

export default SignIn;
