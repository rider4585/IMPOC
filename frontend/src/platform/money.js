/**
 * Formats a paise amount as an Indian rupee string with proper grouping and rounding.
 *
 * @param {number} paise - The amount in paise (must be a non-negative integer)
 * @returns {string} Formatted string like "₹1,299.50"
 * @throws {TypeError} If paise is not an integer or is negative
 */
export function formatPaise(paise) {
  // Validate input
  if (!Number.isInteger(paise) || paise < 0) {
    throw new TypeError(
      `formatPaise expects a non-negative integer, got ${typeof paise === 'number' ? paise : JSON.stringify(paise)}`
    );
  }

  // Convert paise to rupees with half-up rounding to 2 decimals
  const rupees = paise / 100;

  // Manual formatting with Indian grouping (groups of 2, then 3)
  // Split into integer and decimal parts
  const [intPart, decimalPart] = (rupees.toFixed(2)).split('.');

  // Add Indian grouping commas: from right, first comma after 3 digits, then every 2 digits
  let formatted = '';
  const reversed = intPart.split('').reverse().join('');
  let digitCount = 0;

  for (let i = 0; i < reversed.length; i++) {
    if (i === 3 || (i > 3 && (i - 3) % 2 === 0)) {
      formatted = ',' + formatted;
    }
    formatted = reversed[i] + formatted;
  }

  return `₹${formatted}.${decimalPart}`;
}
