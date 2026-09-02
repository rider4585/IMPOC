import { createRequestKey } from './requestKey.js';

/**
 * Wraps a promise function to handle cold-start retry with exponential backoff.
 *
 * **Timing Thresholds (currently fixed constants):**
 * - **1200ms waking threshold**: If the wrapped function hasn't resolved by 1200ms,
 *   the wrapper returns { status: 'waking', requestKey } to signal to the caller
 *   that the server is warming up. Internally, retries continue with exponential backoff.
 * - **90s failure timeout**: If the wrapped function hasn't resolved by 90 seconds,
 *   the wrapper returns { status: 'failed', requestKey } and stops retrying.
 *
 * **Exponential Backoff Strategy:**
 * - First retry: 1.2 seconds after initial failure
 * - Second retry: 2.4 seconds after previous attempt (1.2 × 2)
 * - Third retry: 4.8 seconds after previous attempt (2.4 × 2)
 * - Subsequent retries: Capped at 30 seconds max between attempts
 * - Jitter: ±10% random variation added to each delay to avoid thundering herd
 *
 * @param {Function} fn - An async function to wrap (e.g., async () => fetch(...))
 * @param {Object} options - Configuration options
 * @param {string} options.requestKey - The idempotency key for this request
 * @returns {Promise} Promise that resolves with result or status object:
 *   - result (raw return value) if fn succeeds
 *   - { status: 'waking', requestKey } if unresolved at 1200ms
 *   - { status: 'failed', requestKey } if unresolved at 90s
 * @throws {TypeError} If fn is not a function
 */
export function wakingRequest(fn, options = {}) {
  // Validate that fn is a function
  if (typeof fn !== 'function') {
    throw new TypeError(`wakingRequest expects a function, got ${typeof fn}`);
  }

  const requestKey = options.requestKey || createRequestKey();
  let resolved = false;
  let attempt = 1;
  const timers = [];

  return new Promise((resolve) => {
    const startTime = Date.now();

    /**
     * Executes a single attempt with exponential backoff.
     * On error, schedules the next attempt with increasing delays.
     */
    async function executeAttempt() {
      if (resolved) return;

      try {
        const result = await fn();
        if (!resolved) {
          resolved = true;
          // Clear all pending timers
          timers.forEach(clearTimeout);
          resolve(result);
        }
      } catch (error) {
        if (resolved) return;

        const elapsedMs = Date.now() - startTime;

        // If 90 seconds have passed, surface failure
        if (elapsedMs >= 90000) {
          resolved = true;
          timers.forEach(clearTimeout);
          resolve({
            status: 'failed',
            requestKey,
          });
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

    // At 1200ms, if not resolved, resolve with waking status
    const wakingTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        timers.forEach(clearTimeout);
        resolve({
          status: 'waking',
          requestKey,
        });
      }
    }, 1200);
    timers.push(wakingTimeout);

    // At 90s, if not resolved, resolve with failed status
    const failedTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        timers.forEach(clearTimeout);
        resolve({
          status: 'failed',
          requestKey,
        });
      }
    }, 90000);
    timers.push(failedTimeout);
  });
}
