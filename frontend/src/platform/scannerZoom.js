/**
 * Scanner zoom preference (per device, localStorage).
 *
 * Only three presets exist — 1x, 2x, 3x — so the control stays a one-tap
 * choice on a phone. The chosen level is remembered on this device and used
 * every time a scanner opens; the default before any choice is 2x.
 */
export const SCANNER_ZOOM_PRESETS = Object.freeze([1, 2, 3]);
export const SCANNER_ZOOM_DEFAULT = 2;
export const SCANNER_ZOOM_STORAGE_KEY = 'impoc-scanner-zoom';

export function loadScannerZoom() {
  try {
    const raw = window.localStorage.getItem(SCANNER_ZOOM_STORAGE_KEY);
    const value = Number(raw);
    return SCANNER_ZOOM_PRESETS.includes(value) ? value : SCANNER_ZOOM_DEFAULT;
  } catch {
    return SCANNER_ZOOM_DEFAULT;
  }
}

export function saveScannerZoom(value) {
  if (!SCANNER_ZOOM_PRESETS.includes(value)) return;
  try {
    window.localStorage.setItem(SCANNER_ZOOM_STORAGE_KEY, String(value));
  } catch {
    /* storage unavailable: the choice simply lasts for this scanner session */
  }
}
