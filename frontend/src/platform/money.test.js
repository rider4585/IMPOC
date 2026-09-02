import { describe, it, expect } from 'vitest';
import { formatPaise } from './money.js';

describe('money', () => {
  describe('formatPaise', () => {
    it('formats 129950 paise as ₹1,299.50', () => {
      expect(formatPaise(129950)).toBe('₹1,299.50');
    });

    it('formats 0 paise as ₹0.00', () => {
      expect(formatPaise(0)).toBe('₹0.00');
    });

    it('formats 1 paise as ₹0.01', () => {
      expect(formatPaise(1)).toBe('₹0.01');
    });

    it('formats 100 paise as ₹1.00', () => {
      expect(formatPaise(100)).toBe('₹1.00');
    });

    it('formats 50 paise as ₹0.50', () => {
      expect(formatPaise(50)).toBe('₹0.50');
    });

    it('formats 100000 paise as ₹1,000.00 with Indian grouping', () => {
      expect(formatPaise(100000)).toBe('₹1,000.00');
    });

    it('formats 1234567 paise with Indian grouping (2,3,3 pattern)', () => {
      expect(formatPaise(1234567)).toBe('₹12,345.67');
    });

    it('throws TypeError on negative paise', () => {
      expect(() => formatPaise(-100)).toThrow(TypeError);
    });

    it('throws TypeError on negative zero', () => {
      expect(() => formatPaise(-0)).not.toThrow();
      expect(formatPaise(-0)).toBe('₹0.00');
    });

    it('throws TypeError on non-integer values', () => {
      expect(() => formatPaise(100.5)).toThrow(TypeError);
      expect(() => formatPaise(100.1)).toThrow(TypeError);
    });

    it('throws TypeError on string input', () => {
      expect(() => formatPaise('100')).toThrow(TypeError);
    });

    it('throws TypeError on null input', () => {
      expect(() => formatPaise(null)).toThrow(TypeError);
    });

    it('throws TypeError on undefined input', () => {
      expect(() => formatPaise(undefined)).toThrow(TypeError);
    });

    it('throws TypeError on NaN input', () => {
      expect(() => formatPaise(NaN)).toThrow(TypeError);
    });

    it('throws TypeError on object input', () => {
      expect(() => formatPaise({})).toThrow(TypeError);
    });
  });
});
