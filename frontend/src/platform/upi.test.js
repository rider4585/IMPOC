import { describe, it, expect } from 'vitest';
import { buildUpiUri } from './upi.js';

describe('buildUpiUri', () => {
  it('builds a upi://pay deep link with all params in order', () => {
    const uri = buildUpiUri({
      vpa: 'shree@okhdfcbank',
      payee: 'Shree Fashion Store',
      amountRupees: 250,
      note: 'Shree Fashion Store sale',
      txnRef: 'abc-123',
    });

    expect(uri).toBe(
      'upi://pay?pa=shree%40okhdfcbank&pn=Shree%20Fashion%20Store&am=250.00&cu=INR&tn=Shree%20Fashion%20Store%20sale&tr=abc-123'
    );
  });

  it('formats the amount to 2 decimal places', () => {
    const uri = buildUpiUri({
      vpa: 'shop@bank',
      payee: 'Shop',
      amountRupees: 99.9,
      note: 'note',
      txnRef: 'ref-1',
    });
    expect(uri).toContain('am=99.90');
  });

  it('rounds a fractional-paise amount to 2dp', () => {
    const uri = buildUpiUri({
      vpa: 'shop@bank',
      payee: 'Shop',
      amountRupees: 100.126,
      note: 'note',
      txnRef: 'ref-1',
    });
    expect(uri).toContain('am=100.13');
  });

  it('URL-encodes special characters in each field', () => {
    const uri = buildUpiUri({
      vpa: 'a+b@bank',
      payee: 'Shop & Co.',
      amountRupees: 10,
      note: 'sale #1/refund?',
      txnRef: 'ref&1',
    });
    expect(uri).toBe(
      `upi://pay?pa=${encodeURIComponent('a+b@bank')}&pn=${encodeURIComponent('Shop & Co.')}&am=10.00&cu=INR&tn=${encodeURIComponent('sale #1/refund?')}&tr=${encodeURIComponent('ref&1')}`
    );
  });

  it('defaults the note to an empty string when omitted', () => {
    const uri = buildUpiUri({
      vpa: 'shop@bank',
      payee: 'Shop',
      amountRupees: 10,
      txnRef: 'ref-1',
    });
    expect(uri).toContain('tn=&tr=ref-1');
  });

  it('always sets cu=INR', () => {
    const uri = buildUpiUri({
      vpa: 'shop@bank',
      payee: 'Shop',
      amountRupees: 10,
      note: 'n',
      txnRef: 'r',
    });
    expect(uri).toContain('cu=INR');
  });

  it('throws a TypeError when vpa is missing', () => {
    expect(() =>
      buildUpiUri({ payee: 'Shop', amountRupees: 10, note: 'n', txnRef: 'r' })
    ).toThrow(TypeError);
  });

  it('throws a TypeError when payee is missing', () => {
    expect(() =>
      buildUpiUri({ vpa: 'shop@bank', amountRupees: 10, note: 'n', txnRef: 'r' })
    ).toThrow(TypeError);
  });

  it('throws a TypeError when amountRupees is not a valid non-negative number', () => {
    expect(() =>
      buildUpiUri({ vpa: 'shop@bank', payee: 'Shop', amountRupees: -5, note: 'n', txnRef: 'r' })
    ).toThrow(TypeError);
    expect(() =>
      buildUpiUri({ vpa: 'shop@bank', payee: 'Shop', amountRupees: NaN, note: 'n', txnRef: 'r' })
    ).toThrow(TypeError);
  });

  it('throws a TypeError when txnRef is missing', () => {
    expect(() =>
      buildUpiUri({ vpa: 'shop@bank', payee: 'Shop', amountRupees: 10, note: 'n' })
    ).toThrow(TypeError);
  });
});
