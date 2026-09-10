/**
 * Builds a UPI (Unified Payments Interface) deep link for a checkout amount.
 * Standard `upi://pay` intent, e.g.:
 *   upi://pay?pa=shop%40bank&pn=Shop&am=250.00&cu=INR&tn=note&tr=ref
 *
 * @param {Object} params
 * @param {string} params.vpa - payee VPA / UPI id (pa), e.g. "shree@okhdfcbank"
 * @param {string} params.payee - payee display name (pn)
 * @param {number} params.amountRupees - amount in rupees (am), formatted to 2dp
 * @param {string} params.note - transaction note (tn)
 * @param {string} params.txnRef - transaction reference (tr) — the checkout idempotency key
 * @returns {string} the upi://pay deep link with each value URL-encoded
 */
export function buildUpiUri({ vpa, payee, amountRupees, note, txnRef }) {
  if (!vpa || typeof vpa !== 'string') {
    throw new TypeError('buildUpiUri requires a vpa string');
  }
  if (!payee || typeof payee !== 'string') {
    throw new TypeError('buildUpiUri requires a payee string');
  }
  if (typeof amountRupees !== 'number' || !Number.isFinite(amountRupees) || amountRupees < 0) {
    throw new TypeError('buildUpiUri requires a non-negative finite amountRupees');
  }
  if (!txnRef || typeof txnRef !== 'string') {
    throw new TypeError('buildUpiUri requires a txnRef string');
  }

  const params = [
    ['pa', vpa],
    ['pn', payee],
    ['am', amountRupees.toFixed(2)],
    ['cu', 'INR'],
    ['tn', note || ''],
    ['tr', txnRef],
  ];

  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `upi://pay?${query}`;
}

export default buildUpiUri;
