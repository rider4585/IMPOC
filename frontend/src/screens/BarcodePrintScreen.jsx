import React, { useState, useEffect } from 'react';
import { Button, Input, Card, CardHeader, CardContent, CardTitle } from '../components/ui';
import { createRequestKey } from '../platform/requestKey.js';
import { wakingRequest } from '../platform/wakingRequest.js';
import apiClient from '../platform/apiClient.js';
import { BARCODE_ROUTES } from '../platform/routes.js';

/**
 * Barcode Print Screen (Story 1.17)
 *
 * Allows inventory managers to request N-page barcode sheets through the app.
 * Features:
 * - Mints one requestKey on mount; reuses across retries; fresh key on re-entry
 * - Calls GET /api/barcodes/generate?pages={n}&requestUuid={key} via platform/apiClient
 * - First attempt: receives PDF binary → downloads as barcodes.pdf
 * - Replay: receives JSON → shows "already generated" message, no download
 * - Shows waking banner at 1200ms; failure state at 90s with Try again button
 * - Displays server error messages inline
 */
export function BarcodePrintScreen() {
  const [pages, setPages] = useState('');
  const [requestKey, setRequestKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle, waking, failed, success, replay
  const [successPages, setSuccessPages] = useState(null);

  // Mint a fresh requestKey when the screen is entered
  useEffect(() => {
    const key = createRequestKey();
    setRequestKey(key);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('idle');
    setIsLoading(true);

    if (!requestKey) {
      setError('Failed to initialize request key. Please refresh the page.');
      setIsLoading(false);
      return;
    }

    try {
      // Wrap the API call with wakingRequest for cold-start retry logic
      const result = await wakingRequest(
        async () => {
          const response = await apiClient.get(BARCODE_ROUTES.GENERATE, {
            params: {
              pages: parseInt(pages, 10),
              requestUuid: requestKey,
            },
            responseType: 'arraybuffer',
          });
          return response;
        },
        { requestKey }
      );

      // Check if wakingRequest returned a status (waking or failed)
      if (result.status === 'waking') {
        setStatus('waking');
        // Keep isLoading true to prevent double-submit during waking state
        return;
      }

      if (result.status === 'failed') {
        setStatus('failed');
        // Keep isLoading true to prevent re-submission; clear on retry
        return;
      }

      // result.data contains the response data
      const response = result;
      const contentType = response.headers['content-type'];

      // Determine response type by Content-Type header
      if (contentType && contentType.includes('application/pdf')) {
        // First attempt: PDF binary response
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'barcodes.pdf';
        link.click();
        window.URL.revokeObjectURL(url);

        // Show success message with page count
        setSuccessPages(parseInt(pages, 10));
        setStatus('success');
        setPages('');
      } else {
        // Replay: JSON response
        setStatus('replay');
        setPages('');
      }
    } catch (err) {
      // Handle validation errors, permission errors, and other server errors
      let message = err.response?.data?.message || err.message || 'An error occurred. Please try again.';
      // Ensure message is a plain string
      if (typeof message !== 'string') {
        message = String(message);
      }
      setError(message);
      setStatus('idle');
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError('');
    setStatus('idle');
    setIsLoading(true);
    handleSubmit({ preventDefault: () => {} });
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="items-center">
          <CardTitle>Print Labels</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="typography-body-sm mb-6 text-center text-[var(--ink-muted)]">
            Request a sheet of blank barcode labels for your inventory.
          </p>

          {/* Waking banner  -  shown when request is pending after 1200ms */}
          {status === 'waking' && (
            <div className="mb-6 rounded-md border-l-4 border-[var(--waking)] bg-[rgba(138,90,31,0.1)] p-4 text-[var(--ink)]">
              <p className="mb-2 leading-relaxed">Waking the system up.</p>
              <p className="leading-relaxed text-sm">This takes up to a minute after a quiet spell. Nothing is lost.</p>
            </div>
          )}

          {/* Success message  -  shown after PDF download */}
          {status === 'success' && successPages && (
            <div className="mb-6 rounded-md border-l-4 border-[var(--success)] bg-[rgba(47,110,79,0.1)] p-4 font-medium leading-relaxed text-[var(--success)]">
              Sheet generated  -  {successPages} page(s).
            </div>
          )}

          {/* Replay message  -  shown when the same requestUuid is submitted again */}
          {status === 'replay' && (
            <div className="mb-6 rounded-md border-l-4 border-[var(--money-held)] bg-[rgba(91,75,138,0.1)] p-4 leading-relaxed text-[var(--ink)]">
              This sheet was already generated in your last attempt. Nothing new was printed  -  use the copy you already have.
            </div>
          )}

          {/* Error message  -  shown inline on validation or server errors */}
          {error && (
            <div className="mb-6 rounded-md border-l-4 border-[var(--danger)] bg-[var(--danger)]/10 p-4 text-sm leading-relaxed text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Form  -  always visible and interactive, even during waking state */}
          {status !== 'success' && status !== 'replay' ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Number of pages"
                id="pages"
                type="number"
                min="1"
                placeholder="Enter number of pages"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                disabled={isLoading}
                required
              />

              {/* Submit button  -  disabled during initial loading, always present */}
              <Button
                type="submit"
                disabled={isLoading || !pages || parseInt(pages, 10) < 1}
                className="mt-1"
              >
                {isLoading ? 'Requesting...' : 'Request Sheet'}
              </Button>
            </form>
          ) : null}

          {/* Retry button  -  shown when request times out at 90s */}
          {status === 'failed' && (
            <Button
              onClick={handleRetry}
              disabled={isLoading}
              className="mt-6 w-full"
            >
              {isLoading ? 'Retrying...' : 'Try again'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BarcodePrintScreen;
