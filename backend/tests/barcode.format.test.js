import { describe, it, expect } from '@jest/globals';

import { formatBarcodeValue } from '../src/modules/barcode/barcode.service.js';
import { BARCODE_FORMAT, BARCODE_MAX_LENGTH } from '../src/modules/barcode/barcode.constants.js';

/**
 * R-48: barcode value = SHREE + TS6 (base-36 seconds since 2026-01-01) + CNT4 (base-36 seq mod 36^4).
 * Pure function - no DB.
 */
describe('formatBarcodeValue (R-48)', () => {
    const T0 = Date.UTC(2026, 8, 13, 5, 0, 0);

    it('starts with SHREE and is 15 uppercase alphanumeric chars', () => {
        const value = formatBarcodeValue(1, T0);
        expect(value.startsWith(BARCODE_FORMAT.prefix)).toBe(true);
        expect(value).toHaveLength(BARCODE_FORMAT.length);
        expect(value).toMatch(/^[A-Z0-9]+$/);
        expect(value.length).toBeLessThanOrEqual(BARCODE_MAX_LENGTH);
    });

    it('encodes the sequence value as a 4-char base-36 counter', () => {
        expect(formatBarcodeValue(1, T0).slice(-4)).toBe('0001');
        expect(formatBarcodeValue(36, T0).slice(-4)).toBe('0010');
        expect(formatBarcodeValue('1295', T0).slice(-4)).toBe('00ZZ');
        expect(formatBarcodeValue(1679615n, T0).slice(-4)).toBe('ZZZZ');
    });

    it('wraps the counter at 36^4 (timestamp keeps values distinct)', () => {
        expect(formatBarcodeValue(1679616, T0).slice(-4)).toBe('0000');
        expect(formatBarcodeValue(1679617, T0).slice(-4)).toBe('0001');
    });

    it('encodes seconds since the 2026-01-01 epoch as a 6-char base-36 timestamp', () => {
        expect(formatBarcodeValue(1, BARCODE_FORMAT.epochMs).slice(5, 11)).toBe('000000');
        expect(formatBarcodeValue(1, BARCODE_FORMAT.epochMs + 36_000).slice(5, 11)).toBe('000010');
        // sub-second changes do not alter the timestamp
        expect(formatBarcodeValue(1, T0)).toBe(formatBarcodeValue(1, T0 + 999));
    });

    it('produces distinct values within a batch and across a sequence reset', () => {
        const batch = Array.from({ length: 500 }, (_, i) => formatBarcodeValue(i + 1, T0));
        expect(new Set(batch).size).toBe(500);

        const afterReset = Array.from({ length: 500 }, (_, i) => formatBarcodeValue(i + 1, T0 + 1000));
        expect(new Set([...batch, ...afterReset]).size).toBe(1000);
    });

    it('rejects a sequence value below 1 and a clock before the epoch', () => {
        expect(() => formatBarcodeValue(0, T0)).toThrow('Invalid sequence value');
        expect(() => formatBarcodeValue(1, BARCODE_FORMAT.epochMs - 1000)).toThrow('before the barcode epoch');
    });

    it('rejects a timestamp that no longer fits 6 chars (~2094)', () => {
        expect(() => formatBarcodeValue(1, Date.UTC(2095, 0, 1))).toThrow('fixed width');
    });
});
