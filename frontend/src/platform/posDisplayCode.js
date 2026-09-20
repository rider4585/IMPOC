/**
 * A short, random, non-guessable code that pairs this POS terminal with a
 * customer-facing display device (R-35). Persisted in localStorage so the
 * code — and any QR/link already shown to a customer — stays stable across
 * reloads of this terminal.
 */

const STORAGE_KEY = 'pos-display-code';

// Matches backend/src/modules/pos-display/pos-display.validation.js.
const CODE_FORMAT = /^[A-Za-z0-9]{4,12}$/;

// Excludes visually ambiguous characters (0/O, 1/I/l).
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateDisplayCode(length = 6) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

/**
 * Returns this terminal's display code, minting and persisting one on first
 * use. Falls back to an in-memory code (not persisted) if localStorage is
 * unavailable.
 */
export function getOrCreateDisplayCode() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && CODE_FORMAT.test(existing)) {
      return existing;
    }
  } catch {
    // localStorage unavailable (private browsing, blocked storage) — fall through.
  }

  const code = generateDisplayCode();

  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Best-effort persistence only; the code still works for this session.
  }

  return code;
}
