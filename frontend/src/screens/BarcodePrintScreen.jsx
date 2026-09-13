import React, { useState } from 'react';
import { Button, Input, Card, CardHeader, CardContent, CardTitle, useToast } from '../components/ui';
import { createRequestKey } from '../platform/requestKey.js';
import { wakingRequest } from '../platform/wakingRequest.js';
import apiClient from '../platform/apiClient.js';
import { BARCODE_ROUTES } from '../platform/routes.js';
import LabelLayoutScreen from './LabelLayoutScreen.jsx';

/**
 * Barcode Print Screen (Story 1.17)
 *
 * Allows inventory managers to request N-page barcode sheets through the app.
 * Features:
 * - Mints one requestKey on mount; reuses across retries of the SAME attempt;
 *   a fresh key is minted after every completed request (SEC-M-3 mint-on-intent),
 *   so the operator can request the next sheet without refreshing (R-49)
 * - Calls GET /api/barcodes/generate?pages={n}&requestUuid={key} via platform/apiClient
 * - First attempt: receives PDF binary → downloads as barcodes.pdf + success toast
 * - Replay: receives JSON → info toast, no download
 * - Form stays visible and usable after success/replay
 * - Shows waking banner at 1200ms; failure state at 90s with Try again button
 * - Displays server error messages inline
 * - "Configure barcode sheet" expands the R-50 label layout configurator below the card
 */
export function BarcodePrintScreen() {
  const [pages, setPages] = useState('');
  // Minted once when the screen is entered (lazy initialiser), re-minted per completed request
  const [requestKey, setRequestKey] = useState(() => createRequestKey());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle, waking, failed
  const toast = useToast();
  const [showConfig, setShowConfig] = useState(false);

  // A completed request (PDF or replay) consumes its key: the next sheet is a
  // new intent and must carry a new requestUuid, otherwise the server replays.
  const finishAttempt = () => {
    setRequestKey(createRequestKey());
    setPages('');
    setStatus('idle');
  };

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

        toast.success({
          title: 'Sheet generated',
          description: `${parseInt(pages, 10)} page(s) downloaded as barcodes.pdf.`,
        });
        finishAttempt();
      } else {
        // Replay: JSON response - the server already produced this sheet
        toast.info({
          title: 'Sheet already generated',
          description: 'Nothing new was printed - use the copy you already have.',
        });
        finishAttempt();
      }
    } catch (err) {
      // Handle validation errors, permission errors, and other server errors
      let message = err.isServerUnavailable
        ? err.message
        : err.response?.data?.message || err.message || 'An error occurred. Please try again.';
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
    <div className={`flex min-h-full flex-col items-center gap-6 p-4 ${showConfig ? 'justify-start md:p-6' : 'justify-center'}`}>
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

          {/* Error message  -  shown inline on validation or server errors */}
          {error && (
            <div className="mb-6 rounded-md border-l-4 border-[var(--danger)] bg-[var(--danger)]/10 p-4 text-sm leading-relaxed text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Form  -  always visible and interactive (waking state included, and after a download) */}
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

          {/* Sheet configurator toggle (R-50) */}
          <Button
            type="button"
            variant="link"
            className="mt-4 w-full"
            aria-expanded={showConfig}
            aria-controls="label-layout-section"
            onClick={() => setShowConfig((v) => !v)}
          >
            {showConfig ? 'Hide sheet configuration' : 'Configure barcode sheet'}
          </Button>

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

      {showConfig && (
        <div id="label-layout-section" className="w-full max-w-[1200px]">
          <LabelLayoutScreen />
        </div>
      )}
    </div>
  );
}

export default BarcodePrintScreen;
