/**
 * Logo for the branded HTML receipt (R-45).
 *
 * `RECEIPT_LOGO_SRC` is the SINGLE swappable source the receipt template
 * (`brandedReceiptHtml.js`) uses for the header monogram — for now an inline
 * lotus-line-art + "श्री" SVG placeholder, so dropping in the real uploaded
 * logo later is a one-line change: point this at the uploaded file (e.g.
 * `/branding/logo.png`) instead of the data URI. Mirrors the
 * `frontend/src/platform/qrLogo.js` `LOGO_SRC` pattern from R-42.
 *
 * Uses the `data:image/svg+xml;utf8,` scheme (not base64) because the mark
 * contains the Devanagari glyph "श्री", which `btoa` cannot encode directly.
 */

function lotusPetals(cx, cy, rx, ry, count, color, strokeWidth, opacity) {
  const petals = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (360 / count) * i;
    petals.push(
      `<ellipse cx="${cx}" cy="${cy - ry * 0.55}" rx="${rx}" ry="${ry}" ` +
      `transform="rotate(${angle} ${cx} ${cy})" fill="none" stroke="${color}" ` +
      `stroke-width="${strokeWidth}" opacity="${opacity}"/>`
    );
  }
  return petals.join('');
}

const MONOGRAM_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="96" fill="none" stroke="#C9AE8E" stroke-width="1" opacity="0.5"/>
  ${lotusPetals(100, 100, 22, 58, 10, '#C9AE8E', 1.4, 0.85)}
  <text x="100" y="132" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="80" font-weight="700" fill="#6E4B2F">श्री</text>
</svg>
`.trim();

export const RECEIPT_LOGO_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(MONOGRAM_SVG)}`;
