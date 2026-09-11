/**
 * Colourful, branded A5 HTML receipt (R-45) — server-side copy of
 * `frontend/src/platform/brandedReceiptHtml.js` (+ its `amountInWords.js` /
 * `receiptBrand.js` helpers), kept as a plain, dependency-free ESM module so
 * it can render the same receipt payload to a self-contained HTML string
 * without any browser/DOM API. Exists ahead of R-47 (email receipts), which
 * will call `buildReceiptHtml` below. No new HTTP route is wired yet — R-47
 * owns deciding how this gets exposed (route vs. only used internally by an
 * email job).
 *
 * Keep this in sync with the frontend copy by hand: the two run in different
 * packages (no shared workspace), so this is an intentional duplication, not
 * a drift bug.
 */

// ---- amount-in-words (Indian numbering: Crore/Lakh/Thousand/Hundred) ----

const ONES = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(n) {
    if (n < 20) return ONES[n];
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return TENS[tens] + (ones ? ` ${ONES[ones]}` : '');
}

function threeDigitWords(n) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const parts = [];
    if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
    if (rest) parts.push(twoDigitWords(rest));
    return parts.join(' ');
}

function numberToWordsIndian(value) {
    let n = Math.floor(Math.abs(Number(value) || 0));
    if (n === 0) return 'Zero';

    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thousand = Math.floor(n / 1e3); n %= 1e3;
    const hundred = n;

    const parts = [];
    if (crore) parts.push(`${threeDigitWords(crore)} Crore`);
    if (lakh) parts.push(`${threeDigitWords(lakh)} Lakh`);
    if (thousand) parts.push(`${threeDigitWords(thousand)} Thousand`);
    if (hundred) parts.push(threeDigitWords(hundred));
    return parts.join(' ');
}

function paiseToWordsINR(paise) {
    let magnitude;
    try {
        magnitude = typeof paise === 'bigint' ? paise : BigInt(Math.trunc(Number(paise) || 0));
    } catch {
        magnitude = 0n;
    }
    const negative = magnitude < 0n;
    const abs = negative ? -magnitude : magnitude;
    const rupees = abs / 100n;
    const paisePart = abs % 100n;

    let words = `Rupees ${numberToWordsIndian(Number(rupees))}`;
    if (paisePart > 0n) {
        words += ` and Paise ${numberToWordsIndian(Number(paisePart))}`;
    }
    words += ' Only';
    return negative ? `Minus ${words}` : words;
}

// ---- logo: single swappable constant, mirrors frontend/src/platform/qrLogo.js ----

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

// ---- HTML template ----

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

function formatINR(paiseValue) {
    const n = Math.round(Number(paiseValue) || 0);
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    const rupees = Math.floor(abs / 100);
    const p = abs % 100;
    const intStr = String(rupees);
    const last3 = intStr.slice(-3);
    const other = intStr.slice(0, -3);
    const grouped = other ? `${other.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
    return `${sign}₹${grouped}.${String(p).padStart(2, '0')}`;
}

function formatDateDMY(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return escapeHtml(value);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function lotusRing(cx, cy, rx, ry, count, color, strokeWidth, opacity) {
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

function cornerWatermark(size) {
    return `<svg viewBox="0 0 300 300" width="${size}" height="${size}" aria-hidden="true">
    ${lotusRing(150, 150, 34, 95, 12, '#C9AE8E', 1.1, 0.35)}
    ${lotusRing(150, 150, 20, 55, 10, '#C9AE8E', 1, 0.3)}
  </svg>`;
}

const ARROW_ORNAMENT = `<svg class="arrow-svg" width="30" height="10" viewBox="0 0 30 10" aria-hidden="true">
  <line x1="0" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1"/>
  <path d="M19 1 L27 5 L19 9 Z" fill="currentColor"/>
</svg>`;

const MINI_LOTUS = `<svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true">
  ${lotusRing(50, 50, 12, 32, 8, '#6E4B2F', 1.6, 0.9)}
</svg>`;

function fieldRow(label, value, { wide = false } = {}) {
    return `<div class="field${wide ? ' field--wide' : ''}"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
}

function lineDescription(line) {
    return [line.productName, line.colour, line.size].filter(Boolean).join(' - ');
}

function itemsRowsHtml(lines) {
    if (!lines || lines.length === 0) {
        return `<tr><td class="c-sno"></td><td class="c-desc empty" colspan="4">No items</td></tr>`;
    }
    return lines
        .map((line, idx) => `<tr>
      <td class="c-sno">${idx + 1}.</td>
      <td class="c-desc">${escapeHtml(lineDescription(line))}</td>
      <td class="c-qty">${escapeHtml(line.quantity ?? 1)}</td>
      <td class="c-rate">${formatINR(line.unitPricePaise)}</td>
      <td class="c-amt">${formatINR(line.lineTotalPaise)}</td>
    </tr>`)
        .join('\n');
}

/**
 * Build the self-contained branded receipt HTML from a receipt payload
 * (the same shape `buildReceipt` in receipts.service.js returns).
 */
export function buildBrandedReceiptHtml(receipt, { logoSrc = RECEIPT_LOGO_SRC } = {}) {
    const store = receipt?.store || {};
    const transaction = receipt?.transaction || {};
    const customer = receipt?.customer || null;
    const lines = receipt?.lines || [];
    const totals = receipt?.totals || {};

    const storeName = store.name || 'Shree Fashion Store';
    const wordmark = (storeName.replace(/^shree\s+/i, '').trim() || storeName).toUpperCase();

    const billNo = transaction.number || '';
    const dateStr = formatDateDMY(transaction.date);
    const customerName = customer?.name || 'Walk-in Customer';
    const customerPhone = customer?.phone || '';
    const totalPaise = totals.totalPaise ?? '0';
    const amountWords = paiseToWordsINR(totalPaise);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Receipt ${escapeHtml(billNo)}</title>
<style>
  :root {
    --cream: #F7F3EC;
    --ink: #6E4B2F;
    --ink-soft: rgba(110, 75, 47, 0.55);
    --tan-fill: #E7D9C4;
    --tan-border: #C9AE8E;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--cream); }
  body {
    font-family: Georgia, 'Times New Roman', Times, serif;
    color: var(--ink);
  }
  .page {
    position: relative;
    width: 148mm;
    min-height: 210mm;
    margin: 0 auto;
    padding: 10mm 10mm 8mm;
    background: var(--cream);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .corner { position: absolute; opacity: 1; pointer-events: none; }
  .corner--tr { top: -14px; right: -14px; }
  .corner--bl { bottom: -18px; left: -18px; }
  .corner--br { bottom: -6px; right: 10%; opacity: 0.6; }

  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; position: relative; z-index: 1; }
  .brand { display: flex; flex-direction: column; align-items: flex-start; }
  .monogram { width: 56px; height: 56px; margin-bottom: 4px; }
  .wordmark { font-size: 17px; font-weight: 700; letter-spacing: 4px; color: var(--ink); }
  .tagline { margin-top: 4px; font-size: 8px; letter-spacing: 1.2px; color: var(--ink); display: flex; align-items: center; gap: 5px; white-space: nowrap; }
  .arrow-svg { color: var(--ink); width: 20px; height: 7px; }
  .arrow-svg.arrow--rev { transform: scaleX(-1); }

  .meta { text-align: right; padding-top: 4px; min-width: 130px; }
  .meta .field { justify-content: flex-end; }
  .meta .field .label { white-space: nowrap; }

  .field { display: flex; align-items: baseline; gap: 6px; margin: 6px 0; font-size: 10.5px; }
  .field .label { white-space: nowrap; color: var(--ink); font-style: italic; }
  .field .value { flex: 0 1 auto; border-bottom: 1px dotted var(--ink-soft); padding-bottom: 1px; min-width: 30px; }
  .field--wide { width: 100%; }
  .field--wide .value { flex: 1; }

  .customer { position: relative; z-index: 1; margin-top: 10px; }

  table.items {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border: 1px solid var(--tan-border);
    margin-top: 12px;
    position: relative;
    z-index: 1;
  }
  table.items th, table.items td { padding: 5px 4px; font-size: 10px; }
  table.items thead th {
    background: var(--tan-fill);
    border-bottom: 1px solid var(--tan-border);
    color: var(--ink);
    font-weight: 700;
    letter-spacing: 0.3px;
    text-align: center;
  }
  /* Vertical column dividers: declared once, on the right-hand cell of each
     boundary, so border-collapse never has two conflicting declarations
     (solid vs. dotted) fighting over the same edge -- that mix was the cause
     of the "deformed" table look in the first cut. */
  table.items th + th, table.items td + td { border-left: 1px solid var(--tan-border); }
  table.items tbody td { border-bottom: 1px dotted var(--tan-border); }
  table.items tbody tr:last-child td { border-bottom: none; }
  table.items td.c-sno { text-align: center; }
  table.items td.c-desc { text-align: left; }
  table.items td.c-desc.empty { text-align: center; color: var(--ink-soft); font-style: italic; }
  table.items td.c-qty { text-align: center; }
  table.items td.c-rate { text-align: right; }
  table.items td.c-amt { text-align: right; }
  table.items .total-row td { font-weight: 700; }
  table.items .total-row .total-label { text-align: right; font-style: italic; }
  table.items .total-row .total-value { text-align: right; }

  .words { margin-top: 12px; position: relative; z-index: 1; }

  .spacer { flex: 1; min-height: 10px; }

  .foot { position: relative; z-index: 1; margin-top: 12px; }
  .thanks { text-align: center; font-size: 11px; font-style: italic; }
  .divider { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 6px 0 14px; }
  .divider .line { width: 50px; height: 1px; background: var(--tan-border); }
  .divider svg { width: 16px; height: 16px; }
  .sign { display: flex; justify-content: flex-end; }
  .sign-inner { text-align: center; }
  .sign-line { display: block; width: 110px; border-top: 1px solid var(--ink); margin-bottom: 3px; }
  .sign-label { font-size: 9px; font-style: italic; }

  @media print {
    @page { size: A5; margin: 0; }
    html, body { width: 148mm; }
    .page { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="corner corner--tr">${cornerWatermark(150)}</div>
    <div class="corner corner--bl">${cornerWatermark(130)}</div>
    <div class="corner corner--br">${cornerWatermark(80)}</div>

    <header class="head">
      <div class="brand">
        <img class="monogram" src="${logoSrc}" alt="${escapeHtml(storeName)} logo" />
        <div class="wordmark">${escapeHtml(wordmark)}</div>
        <div class="tagline">${ARROW_ORNAMENT}<span>LOOK BEAUTIFUL EVERYDAY</span>${ARROW_ORNAMENT.replace('class="arrow-svg"', 'class="arrow-svg arrow--rev"')}</div>
      </div>
      <div class="meta">
        ${fieldRow('Bill No.', billNo)}
        ${fieldRow('Date :', dateStr)}
      </div>
    </header>

    <div class="customer">
      ${fieldRow('Name :', customerName, { wide: true })}
      ${fieldRow('Mobile No. :', customerPhone, { wide: true })}
    </div>

    <table class="items">
      <colgroup>
        <col style="width:8%" />
        <col style="width:44%" />
        <col style="width:12%" />
        <col style="width:16%" />
        <col style="width:20%" />
      </colgroup>
      <thead>
        <tr>
          <th class="c-sno">S.No.</th>
          <th class="c-desc">Description</th>
          <th class="c-qty">Qty.</th>
          <th class="c-rate">Rate</th>
          <th class="c-amt">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml(lines)}
        <tr class="total-row">
          <td colspan="3"></td>
          <td class="total-label">Total :</td>
          <td class="total-value">${formatINR(totalPaise)}</td>
        </tr>
      </tbody>
    </table>

    <div class="words">
      ${fieldRow('Amount in Words :', amountWords, { wide: true })}
    </div>

    <div class="spacer"></div>

    <footer class="foot">
      <div class="thanks">Thank you for shopping with us!</div>
      <div class="divider"><span class="line"></span>${MINI_LOTUS}<span class="line"></span></div>
      <div class="sign">
        <div class="sign-inner">
          <span class="sign-line"></span>
          <span class="sign-label">Signature</span>
        </div>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

export default buildBrandedReceiptHtml;
