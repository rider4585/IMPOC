/**
 * Receipt Template Engine (R-47)
 *
 * Lightweight Handlebars-inspired renderer for receipt templates stored in the
 * database. Supports:
 *   - Simple placeholders: {{key}}
 *   - Dot-path access: {{store.name}}
 *   - Each loops: {{#each items}} ... {{/each}}
 *   - Handlebars-style helpers: {{formatINR paiseValue}}, {{formatDate value}}, {{amountInWords paiseValue}}
 *   - Conditional sections: {{#if key}} ... {{/if}}
 *   - Nested object access inside loops: {{item.colour}}
 *   - Image-slot placeholders (<div class="receipt-image-slot">): shown as dashed
 *     boxes in previews, stripped from final receipts until the owner adds an
 *     <img> tag.
 *
 * No external dependencies. All template content lives in the DB — this
 * module only receives an HTML string and a data context.
 */

// ---- Amount in words (Indian numbering) ----

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

// ---- Formatting helpers ----

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
    return `${sign}\u20B9${grouped}.${String(p).padStart(2, '0')}`;
}

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function formatTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

// ---- Image slots ----
//
// Templates may contain image placeholders (the shop adds real <img> tags
// later). A slot looks like:
//
//     <div class="receipt-image-slot" data-label="...">...</div>
//
// During the editor PREVIEW the slot renders as a dashed box so the owner can
// see where the picture goes. On FINAL receipts (sales/rental snapshots) the
// slot is stripped so no empty box reaches the customer — the owner deletes it
// or replaces it with an <img> once they have the image.

const IMAGE_SLOT_RE = /<div class="receipt-image-slot"[^>]*>[\s\S]*?<\/div>/gi;

function stripImageSlots(html) {
    return html.replace(IMAGE_SLOT_RE, '');
}

// ---- Helpers registry ----

const HELPERS = {
    formatINR: (val) => formatINR(val),
    formatDate: (val) => formatDate(val),
    formatTime: (val) => formatTime(val),
    amountInWords: (val) => paiseToWordsINR(val),
    escapeHtml: (val) => escapeHtml(val),
};

// ---- Context resolution ----

function resolvePath(path, context) {
    if (!path) return undefined;
    const parts = path.split('.');
    let val = context;
    for (const p of parts) {
        if (val == null) return undefined;
        val = val[p];
    }
    return val;
}

// ---- Template compilation ----

/**
 * Compile and render a receipt template HTML string with the given context.
 *
 * @param {string} html - The template HTML with {{placeholders}}
 * @param {object} context - The receipt data context
 * @returns {string} Rendered HTML
 */
export function renderTemplate(html, context) {
    if (!html || typeof html !== 'string') return html || '';
    if (!context || typeof context !== 'object') return html;

    let result = html;

    // 1. Handle {{#each items}}...{{/each}} blocks
    result = result.replace(
        /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
        (_match, arrayKey, innerTemplate) => {
            const arr = resolvePath(arrayKey, context);
            if (!Array.isArray(arr) || arr.length === 0) return '';
            return arr
                .map((item, index) => {
                    // Build child context with item + loop metadata
                    const childCtx = {
                        ...context,
                        item,
                        '@index': index,
                        '@number': index + 1,
                        '@first': index === 0,
                        '@last': index === arr.length - 1,
                    };
                    return renderTemplate(innerTemplate, childCtx);
                })
                .join('');
        }
    );

    // 2. Handle {{#if key}}...{{/if}} blocks
    result = result.replace(
        /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (_match, key, innerTemplate) => {
            const val = resolvePath(key, context);
            if (val && val !== '0' && val !== '' && val !== false) {
                return renderTemplate(innerTemplate, context);
            }
            return '';
        }
    );

    // 3. Handle {{helper value}} helper calls
    result = result.replace(
        /\{\{(\w+)\s+([\w.]+)\}\}/g,
        (_match, helperName, valuePath) => {
            const helper = HELPERS[helperName];
            if (!helper) return _match;
            const val = resolvePath(valuePath, context);
            return escapeHtml(helper(val));
        }
    );

    // 4. Handle simple {{key}} placeholders (dot-path supported)
    result = result.replace(
        /\{\{([\w.]+)\}\}/g,
        (_match, key) => {
            const val = resolvePath(key, context);
            if (val === undefined || val === null) return '';
            return escapeHtml(String(val));
        }
    );

    return result;
}

/**
 * Build the data context from a receipt payload (the shape returned by
 * buildReceipt in receipts.service.js) and render the template.
 *
 * @param {string} templateHtml - The template HTML with {{placeholders}}
 * @param {object} receipt - The receipt payload (store/transaction/customer/lines/totals)
 * @param {object} [options]
 * @param {boolean} [options.preview=false] - When true, image-slot placeholders
 *   render as dashed boxes so the owner can position them; when false the slots
 *   are stripped from the final output.
 * @returns {string} Rendered HTML
 */
export function renderReceiptFromPayload(templateHtml, receipt, options = {}) {
    const store = receipt?.store || {};
    const transaction = receipt?.transaction || {};
    const customer = receipt?.customer || null;
    const lines = receipt?.lines || [];
    const totals = receipt?.totals || {};

    const rawStoreName = store.name || '';
    const context = {
        store: {
            name: rawStoreName,
            address: store.address || '',
            phone: store.phone || '',
            wordmark: (rawStoreName.replace(/^shree\s+/i, '').trim() || rawStoreName).toUpperCase(),
        },
        transaction: {
            type: transaction.type || '',
            number: transaction.number || '',
            date: transaction.date ? formatDate(transaction.date) : '',
            time: transaction.date ? formatTime(transaction.date) : '',
            paymentMethod: transaction.paymentMethod || '',
            status: transaction.status || '',
        },
        customer: customer
            ? {
                  name: customer.name || '',
                  phone: customer.phone || '',
                  email: customer.email || '',
              }
            : null,
        totals: {
            subtotal: formatINR(totals.subtotalPaise),
            discount: formatINR(totals.discountPaise),
            total: formatINR(totals.totalPaise),
            amountPaid: formatINR(totals.amountPaidPaise),
            balance: formatINR(totals.balancePaise),
            itemsCount: totals.itemsCount || 0,
        },
        amountInWords: paiseToWordsINR(totals.totalPaise),
        items: lines.map((line, idx) => ({
            sno: idx + 1,
            description: [line.productName, line.colour, line.size].filter(Boolean).join(' - '),
            productName: line.productName || '',
            productType: line.productType || '',
            colour: line.colour || '',
            size: line.size || '',
            quantity: line.quantity ?? 1,
            rate: formatINR(line.unitPricePaise),
            amount: formatINR(line.lineTotalPaise),
            unitPricePaise: line.unitPricePaise,
            lineTotalPaise: line.lineTotalPaise,
        })),
        footer: {
            text: 'Thank you for shopping with us!',
        },
    };

    const rendered = renderTemplate(templateHtml, context);
    return options.preview ? rendered : stripImageSlots(rendered);
}

export default renderTemplate;
