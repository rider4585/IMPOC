/**
 * Persisted choice of the awaiting-QR border animation on a customer-facing
 * display device (R-42b): 'pulse' (gentle glow) or 'marching' (running light
 * around the perimeter). Per-device, localStorage-backed, same
 * fallback/try-catch shape as platform/posDisplayCode.js.
 */

const STORAGE_KEY = 'pos-display-border-style';

export const BORDER_STYLES = Object.freeze(['pulse', 'marching']);
export const DEFAULT_BORDER_STYLE = 'pulse';

export function getBorderStyle() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (BORDER_STYLES.includes(existing)) {
      return existing;
    }
  } catch {
    // localStorage unavailable (private browsing, blocked storage) — fall through.
  }
  return DEFAULT_BORDER_STYLE;
}

export function setBorderStyle(style) {
  if (!BORDER_STYLES.includes(style)) return;
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // Best-effort persistence only; the choice still applies for this session.
  }
}
