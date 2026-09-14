import { toE164Digits } from '../../src/utils/phone.js';

describe('toE164Digits (R-63)', () => {
    it('normalises Indian mobile numbers written every which way', () => {
        expect(toE164Digits('9876543210')).toBe('919876543210');
        expect(toE164Digits('98765 43210')).toBe('919876543210');
        expect(toE164Digits('+91-98765-43210')).toBe('919876543210');
        expect(toE164Digits('09876543210')).toBe('919876543210');
        expect(toE164Digits('0091 9876543210')).toBe('919876543210');
    });

    it('returns null for nothing or junk', () => {
        expect(toE164Digits(null)).toBeNull();
        expect(toE164Digits('')).toBeNull();
        expect(toE164Digits('12345')).toBeNull();
        expect(toE164Digits('call the shop')).toBeNull();
    });
});
