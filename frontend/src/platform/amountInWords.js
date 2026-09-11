/**
 * Paise -> Indian-English words, for the "Amount in Words" line on the
 * branded receipt (R-45). Indian numbering (Crore/Lakh/Thousand/Hundred),
 * not the Western Million/Billion grouping.
 */

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

/**
 * Convert a non-negative integer to Indian-English words
 * (Crore / Lakh / Thousand / Hundred grouping).
 * @param {number} value
 * @returns {string}
 */
export function numberToWordsIndian(value) {
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

/**
 * Paise (number, numeric string, or bigint) -> "Rupees ... and Paise ... Only".
 * @param {number|string|bigint} paise
 * @returns {string}
 */
export function paiseToWordsINR(paise) {
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
