/**
 * Money input helpers: convert between rupee input strings and integer paise.
 * Money is stored as INTEGER paise (never floats/decimals). These helpers keep
 * the conversion exact and rounding-free between the rupee input the user types
 * and the integer paise the API expects.
 */

/**
 * Parse a rupee string (e.g. "1299.50", "1,299.50", "1299") into integer paise.
 *
 * - Strips currency symbols, commas, and surrounding whitespace.
 * - Accepts 0 or 2 decimal places. Rejects anything else (e.g. "1.999") as invalid.
 * - Empty / blank input returns NaN.
 *
 * @param {string} str - The rupee string the user typed.
 * @returns {number} Integer paise, or NaN when the input is not a valid rupee amount.
 */
export function parseRupeesToPaise(str) {
  if (str == null) return NaN;
  const cleaned = String(str).replace(/[₹,\s]/g, '').trim();
  if (cleaned === '') return NaN;

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return NaN;
  }

  const [whole, frac = ''] = cleaned.split('.');
  const wholePaise = Number(whole) * 100;
  const fracPaise = Number(frac.padEnd(2, '0'));
  return wholePaise + fracPaise;
}

/**
 * Format integer paise as an editable rupee string (no thousands separators,
 * 0 or 2 decimal places). inverse-ish of parseRupeesToPaise.
 *
 * @param {number} paise - Integer paise (>= 0).
 * @returns {string} e.g. 129950 -> "1299.50", 500 -> "5.00", 0 -> "0"
 * @throws {TypeError} If paise is not a non-negative integer.
 */
export function formatPaiseForInput(paise) {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new TypeError(
      `formatPaiseForInput expects a non-negative integer, got ${paise}`
    );
  }
  const rupees = Math.floor(paise / 100);
  const remaining = paise % 100;
  return `${rupees}.${String(remaining).padStart(2, '0')}`;
}
