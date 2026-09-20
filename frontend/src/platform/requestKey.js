/**
 * Generates a UUID v4 for use as an idempotency key (request UUID).
 * This key is used to guard against duplicate mutations on cold-start retry.
 *
 * Supports modern browsers (crypto.randomUUID) as well as non-secure LAN contexts
 * and mobile browsers where crypto.randomUUID is unavailable.
 *
 * @returns {string} A UUID v4 string (36 characters including hyphens)
 * @throws {TypeError} If crypto.randomUUID() exists but fails
 */
export function createRequestKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (error) {
      throw new TypeError(`Failed to generate request key: ${error.message}`);
    }
  }

  // Fallback for non-secure contexts (e.g. mobile access over LAN IP)
  // or mobile browsers where crypto.randomUUID is unavailable.
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // RFC 4122 v4: set version to 0100 (4) and variant to 10xx
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    // Continue to Math.random fallback
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
