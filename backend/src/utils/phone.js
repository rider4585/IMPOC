/**
 * Phone helpers shared by everything that messages a customer (R-63 now,
 * the R-62 communication engine later). customers.phone is free text, so
 * every sender must normalise before building a wa.me / sms: link.
 */
const DEFAULT_COUNTRY_CODE = '91';

/**
 * Turn a free-text Indian phone into E.164 digits without the "+", e.g.
 * "98765 43210" -> "919876543210", "+91-98765-43210" -> "919876543210".
 * Returns null when the number cannot be a real mobile number.
 */
export function toE164Digits(phone, countryCode = DEFAULT_COUNTRY_CODE) {
    if (!phone) {
        return null;
    }
    let digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }
    if (digits.length === 10) {
        digits = `${countryCode}${digits}`;
    } else if (digits.length === 11 && digits.startsWith('0')) {
        digits = `${countryCode}${digits.slice(1)}`;
    }
    if (digits.length < 11 || digits.length > 15) {
        return null;
    }
    return digits;
}
