/**
 * Center-logo image for the customer-facing UPI QR codes (R-42a).
 *
 * `LOGO_SRC` is the SINGLE swappable source both QR renders (PosDisplayScreen
 * and PaymentDialog) import — for now an inline monogram placeholder ("S" on
 * the brand colour), so dropping in a real logo later is a one-line change:
 * point this at an uploaded file (e.g. `/logo.png`) instead of the data URI.
 *
 * Both QRs render with `level="H"` (~30% error-correction budget) and keep
 * the logo at ~18-20% of the QR's size with `excavate` on, which is well
 * within the budget a real scanner needs to still read the payload.
 */
const MONOGRAM_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#FAAF00"/>
  <text x="32" y="44" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="#201604" text-anchor="middle">S</text>
</svg>
`.trim();

export const LOGO_SRC = `data:image/svg+xml;base64,${btoa(MONOGRAM_SVG)}`;

/**
 * Shared qrcode.react `imageSettings` for a center logo at `qrSize`.
 * Keep the logo modest (~19%) so `level="H"` error correction easily covers it.
 */
export function qrLogoSettings(qrSize) {
  const logoSize = Math.round(qrSize * 0.19);
  return {
    src: LOGO_SRC,
    height: logoSize,
    width: logoSize,
    excavate: true,
  };
}
