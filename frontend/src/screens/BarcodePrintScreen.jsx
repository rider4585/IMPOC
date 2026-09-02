import React, { useState, useEffect } from 'react';
import { createRequestKey } from '../platform/requestKey.js';
import { wakingRequest } from '../platform/wakingRequest.js';
import apiClient from '../platform/apiClient.js';
import { BARCODE_ROUTES } from '../platform/routes.js';
import './BarcodePrintScreen.css';

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
    <div className="barcode-print-container">
      <div className="barcode-print-card surface-flat">
        <h1 className="typography-heading">Print Labels</h1>
        <p className="barcode-print-subtitle typography-body-sm">
          Request a sheet of blank barcode labels for your inventory.
        </p>

        {/* Waking banner  -  shown when request is pending after 1200ms */}
        {status === 'waking' && (
          <div className="waking-banner">
            <div className="waking-content">
              <p className="typography-body">Waking the system up.</p>
              <p className="typography-body-sm">This takes up to a minute after a quiet spell. Nothing is lost.</p>
            </div>
          </div>
        )}

        {/* Success message  -  shown after PDF download */}
        {status === 'success' && successPages && (
          <div className="success-message">
            Sheet generated  -  {successPages} page(s).
          </div>
        )}

        {/* Replay message  -  shown when the same requestUuid is submitted again */}
        {status === 'replay' && (
          <div className="replay-message">
            This sheet was already generated in your last attempt. Nothing new was printed  -  use the copy you already have.
          </div>
        )}

        {/* Error message  -  shown inline on validation or server errors */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Form  -  always visible and interactive, even during waking state */}
        {status !== 'success' && status !== 'replay' ? (
          <form onSubmit={handleSubmit} className="barcode-print-form">
            <div className="form-group">
              <label htmlFor="pages" className="typography-label">
                Number of pages
              </label>
              <input
                id="pages"
                type="number"
                min="1"
                placeholder="Enter number of pages"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                disabled={isLoading}
                className="barcode-input"
                required
              />
            </div>

            {/* Submit button  -  disabled during initial loading, always present */}
            <button
              type="submit"
              disabled={isLoading || !pages || parseInt(pages, 10) < 1}
              className="barcode-button"
            >
              {isLoading ? 'Requesting...' : 'Request Sheet'}
            </button>
          </form>
        ) : null}

        {/* Retry button  -  shown when request times out at 90s */}
        {status === 'failed' && (
          <button
            onClick={handleRetry}
            className="barcode-button retry-button"
            disabled={isLoading}
          >
            {isLoading ? 'Retrying...' : 'Try again'}
          </button>
        )}
      </div>
    </div>
  );
}

export default BarcodePrintScreen;
