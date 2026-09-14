/**
 * Small colour helpers for the custom accent (R-58). Pure functions.
 */

export const HEX_RE = /^#([0-9a-f]{6})$/i;

export function isHexColor(value) {
  return typeof value === 'string' && HEX_RE.test(value);
}

export function hexToRgb(hex) {
  const m = HEX_RE.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** Darken by a fraction (0.12 = 12 % darker) — used for the hover shade. */
export function darken(hex, amount = 0.12) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex({ r: rgb.r * (1 - amount), g: rgb.g * (1 - amount), b: rgb.b * (1 - amount) });
}

/** Black or white text, whichever reads better on the accent. */
export function foregroundFor(hex) {
  return luminance(hex) > 0.45 ? '#1A1A1A' : '#FFFFFF';
}

/** The four CSS variables a primary preset defines, derived from one hex. */
export function primaryVarsFor(hex) {
  return {
    '--primary': hex.toUpperCase(),
    '--primary-hover': darken(hex),
    '--primary-foreground': foregroundFor(hex),
    '--focus-ring': hex.toUpperCase(),
  };
}
