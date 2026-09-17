import { createRequestKey } from './requestKey.js';

/**
 * Wraps a promise function to handle cold-start retry with exponential backoff.
 *
 * The returned promise NEVER resolves with a synthetic "waking" status. Waking and
 * failure are signalled through the optional `onStatus` callback; the promise itself
 * resolves with the real result once `fn` succeeds, or with { status: 'failed' }
 * after the 90s cap. This is why a slow-but-successful cold-start response (e.g. a
 * generated PDF) is delivered instead of being dropped at the waking threshold.
 *
 * **Timing Thresholds (currently fixed constants):**
 * - **1200ms waking threshold**: If the wrapped function hasn't resolved by 1200ms,
 *   `onStatus('waking', requestKey)` fires (so the UI can show a banner). The promise
 *   keeps waiting — the eventual success is still delivered.
 * - **90s failure timeout**: If the wrapped function hasn't resolved by 90 seconds,
 *   `onStatus('failed', requestKey)` fires and the promise resolves with
 *   `{ status: 'failed', requestKey }`.
 *
 * **Exponential Backoff Strategy (only on rejected attempts):**
 * - First retry: 1.2 seconds after initial failure
 * - Second retry: 2.4 seconds after previous attempt (1.2 × 2)
 * - Third retry: 4.8 seconds after previous attempt (2.4 × 2)
 * - Subsequent retries: Capped at 30 seconds max between attempts
 * - Jitter: ±10% random variation added to each delay to avoid thundering herd
 *
 * @param {Function} fn - An async function to wrap (e.g., async () => fetch(...))
 * @param {Object} options - Configuration options
 * @param {string} options.requestKey - The idempotency key for this request
 * @param {Function} [options.onStatus] - Called with 'waking'|'failed' + requestKey
 * @returns {Promise} Promise that resolves with the real result, or
 *   { status: 'failed', requestKey } after 90s.
 * @throws {TypeError} If fn is not a function
 */
export function wakingRequest(fn, options = {}) {
  // Validate that fn is a function
  if (typeof fn !== 'function') {
    throw new TypeError(`wakingRequest expects a function, got ${typeof fn}`);
  }

  const requestKey = options.requestKey || createRequestKey();
  const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
  let settled = false;
  let attempt = 1;
  const timers = [];
  let wakingSignalled = false;

  return new Promise((resolve) => {
    const startTime = Date.now();

    /**
     * Executes a single attempt with exponential backoff.
     * On error, schedules the next attempt with increasing delays.
     */
    async function executeAttempt() {
      if (settled) return;

      try {
        const result = await fn();
        if (!settled) {
          settled = true;
          // Clear all pending timers
          timers.forEach(clearTimeout);
          resolve(result);
        }
      } catch (error) {
        if (settled) return;

        const elapsedMs = Date.now() - startTime;

        // If 90 seconds have passed, surface failure
        if (elapsedMs >= 90000) {
          settled = true;
          timers.forEach(clearTimeout);
          onStatus('failed', requestKey);
          resolve({ status: 'failed', requestKey });
          return;
        }

        // Calculate next retry delay with exponential backoff
        // 1.2s → 2.4s → 4.8s → ... capped at 30s
        const baseDelayMs = Math.min(1200 * Math.pow(2, attempt - 1), 30000);
        // Add jitter: ±10% of base delay
        const jitterMs = baseDelayMs * (0.9 + Math.random() * 0.2);
        const nextDelayMs = Math.min(jitterMs, 30000);

        attempt += 1;

        // Schedule next attempt
        const retryTimer = setTimeout(executeAttempt, nextDelayMs);
        timers.push(retryTimer);
      }
    }

    // Start first attempt immediately
    executeAttempt();

    // At 1200ms, signal waking but keep waiting — the real result is still delivered.
    const wakingTimeout = setTimeout(() => {
      if (!settled && !wakingSignalled) {
        wakingSignalled = true;
        onStatus('waking', requestKey);
      }
    }, 1200);
    timers.push(wakingTimeout);

    // At 90s, if not settled, surface failure
    const failedTimeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        timers.forEach(clearTimeout);
        onStatus('failed', requestKey);
        resolve({ status: 'failed', requestKey });
      }
    }, 90000);
    timers.push(failedTimeout);
  });
}