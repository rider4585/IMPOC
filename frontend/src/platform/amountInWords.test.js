import { describe, it, expect } from 'vitest';
import { numberToWordsIndian, paiseToWordsINR } from './amountInWords.js';

describe('numberToWordsIndian', () => {
  it('spells zero', () => {
    expect(numberToWordsIndian(0)).toBe('Zero');
  });

  it('spells small numbers', () => {
    expect(numberToWordsIndian(7)).toBe('Seven');
    expect(numberToWordsIndian(19)).toBe('Nineteen');
    expect(numberToWordsIndian(42)).toBe('Forty Two');
    expect(numberToWordsIndian(100)).toBe('One Hundred');
    expect(numberToWordsIndian(305)).toBe('Three Hundred Five');
  });

  it('uses Indian grouping (Thousand/Lakh/Crore)', () => {
    expect(numberToWordsIndian(3450)).toBe('Three Thousand Four Hundred Fifty');
    expect(numberToWordsIndian(100000)).toBe('One Lakh');
    expect(numberToWordsIndian(1234567)).toBe('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven');
    expect(numberToWordsIndian(10000000)).toBe('One Crore');
  });
});

describe('paiseToWordsINR', () => {
  it('renders a whole-rupee amount with "Only"', () => {
    expect(paiseToWordsINR('345000')).toBe('Rupees Three Thousand Four Hundred Fifty Only');
  });

  it('includes paise when present', () => {
    expect(paiseToWordsINR(150050)).toBe('Rupees One Thousand Five Hundred and Paise Fifty Only');
  });

  it('handles zero', () => {
    expect(paiseToWordsINR(0)).toBe('Rupees Zero Only');
  });

  it('prefixes negative amounts with "Minus"', () => {
    expect(paiseToWordsINR(-500)).toBe('Minus Rupees Five Only');
  });
});
