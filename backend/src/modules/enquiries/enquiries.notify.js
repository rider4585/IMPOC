import { toE164Digits } from '../../utils/phone.js';

/**
 * The "your item is available" message and the tap-to-send links for it.
 *
 * Phase 1 of the communication platform (R-62) is hand-off only: the shop
 * has no public URL and no provider accounts yet, so the backend prepares
 * the text and the counter opens WhatsApp / mail / SMS with it pre-filled.
 * When the engine (R-62c) lands, closeEnquiry() calls enqueue() instead and
 * this file becomes the enquiry template's variables — nothing on the
 * screen changes.
 */

export function buildAvailableMessage({ customerName, item, shopName }) {
    const firstName = String(customerName || '').trim().split(/\s+/)[0] || 'there';
    return {
        subject: `Good news from ${shopName} — it's available`,
        body:
            `Hello ${firstName}, good news! The ${item} you asked about at ${shopName} is now available. ` +
            `Do visit us soon — we'll be happy to show it to you. Thank you for choosing ${shopName}.`,
    };
}

/**
 * Which channels can actually reach this customer: consent AND contact.
 * `reason` explains a blocked channel so the dialog can say why.
 */
export function channelReadiness(customer) {
    const e164 = toE164Digits(customer?.phone);
    const check = (consent, has, missing) => {
        if (!consent) return { ok: false, reason: 'No consent' };
        if (!has) return { ok: false, reason: missing };
        return { ok: true, reason: null };
    };
    return {
        WHATSAPP: check(customer?.consentWhatsapp, Boolean(e164), 'No valid phone'),
        EMAIL: check(customer?.consentEmail, Boolean(customer?.email), 'No email'),
        SMS: check(customer?.consentSms, Boolean(e164), 'No valid phone'),
    };
}

export function buildHandoffLink(channel, customer, { subject, body }) {
    const e164 = toE164Digits(customer?.phone);
    const text = encodeURIComponent(body);
    switch (channel) {
        case 'WHATSAPP':
            return e164 ? `https://wa.me/${e164}?text=${text}` : null;
        case 'SMS':
            return e164 ? `sms:+${e164}?body=${text}` : null;
        case 'EMAIL':
            return customer?.email
                ? `mailto:${encodeURIComponent(customer.email)}?subject=${encodeURIComponent(subject)}&body=${text}`
                : null;
        default:
            return null;
    }
}
