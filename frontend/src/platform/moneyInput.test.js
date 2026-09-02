import { describe, it, expect } from 'vitest';
import { parseRupeesToPaise, formatPaiseForInput } from './moneyInput.js';

describe('parseRupeesToPaise', () => {
  it('parses a whole rupee amount', () => {
    expect(parseRupeesToPaise('1299')).toBe(129900);
  });

  it('parses rupees with two decimals', () => {
    expect(parseRupeesToPaise('1299.50')).toBe(129950);
  });

  it('parses a single decimal by padding', () => {
    expect(parseRupeesToPaise('5.5')).toBe(550);
  });

  it('strips currency symbol, commas, and whitespace', () => {
    expect(parseRupeesToPaise('₹1,299.50')).toBe(129950);
    expect(parseRupeesToPaise(' 1299.50 ')).toBe(129950);
  });

  it('parses zero', () => {
    expect(parseRupeesToPaise('0')).toBe(0);
    expect(parseRupeesToPaise('0.00')).toBe(0);
  });

  it('rejects empty and blank input with NaN', () => {
    expect(Number.isNaN(parseRupeesToPaise(''))).toBe(true);
    expect(Number.isNaN(parseRupeesToPaise('   '))).toBe(true);
    expect(Number.isNaN(parseRupeesToPaise(null))).toBe(true);
  });

  it('rejects more than two decimals', () => {
    expect(Number.isNaN(parseRupeesToPaise('1.999'))).toBe(true);
  });

  it('rejects negative amounts', () => {
    expect(Number.isNaN(parseRupeesToPaise('-5'))).toBe(true);
  });

  it('rejects non-numeric input', () => {
    expect(Number.isNaN(parseRupeesToPaise('abc'))).toBe(true);
    expect(Number.isNaN(parseRupeesToPaise('12.3.4'))).toBe(true);
  });
});

describe('formatPaiseForInput', () => {
  it('formats paise as rupees with two decimals', () => {
    expect(formatPaiseForInput(129950)).toBe('1299.50');
    expect(formatPaiseForInput(500)).toBe('5.00');
  });

  it('formats zero', () => {
    expect(formatPaiseForInput(0)).toBe('0.00');
  });

  it('handles sub-rupee amounts', () => {
    expect(formatPaiseForInput(1)).toBe('0.01');
    expect(formatPaiseForInput(99)).toBe('0.99');
  });

  it('throws on non-integer or negative input', () => {
    expect(() => formatPaiseForInput(1.5)).toThrow(TypeError);
    expect(() => formatPaiseForInput(-1)).toThrow(TypeError);
    expect(() => formatPaiseForInput('100')).toThrow(TypeError);
  });
});
