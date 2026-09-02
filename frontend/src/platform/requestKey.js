/**
 * Generates a UUID v4 for use as an idempotency key (request UUID).
 * This key is used to guard against duplicate mutations on cold-start retry.
 *
 * @returns {string} A UUID v4 string (36 characters including hyphens)
 * @throws {TypeError} If crypto.randomUUID() is unavailable or fails
 */
export function createRequestKey() {
  try {
    return crypto.randomUUID();
  } catch (error) {
    throw new TypeError(`Failed to generate request key: ${error.message}`);
  }
}
