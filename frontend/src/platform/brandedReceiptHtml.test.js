import { describe, it, expect } from 'vitest';
import { buildBrandedReceiptHtml } from './brandedReceiptHtml.js';

const SAMPLE_RECEIPT = {
  store: { name: 'Shree Fashion Store', address: '', phone: '' },
  transaction: {
    type: 'SALE',
    number: 'S-1042',
    date: '2026-09-11T10:30:00.000Z',
    paymentMethod: 'CASH',
    totalPaise: '345000',
    paidPaise: '345000',
    changePaise: '0',
    status: 'COMPLETED',
  },
  customer: { name: 'Priya Sharma', phone: '9876543210', email: null },
  lines: [
    {
      productName: 'Kurti',
      productType: 'Kurti',
      colour: 'Red',
      size: 'M',
      quantity: 1,
      unitPricePaise: '150000',
      lineTotalPaise: '150000',
    },
    {
      productName: 'Dupatta',
      productType: 'Dupatta',
      colour: 'Gold',
      size: null,
      quantity: 1,
      unitPricePaise: '195000',
      lineTotalPaise: '195000',
    },
  ],
  totals: {
    subtotalPaise: '345000',
    discountPaise: '0',
    totalPaise: '345000',
    amountPaidPaise: '345000',
    balancePaise: '0',
    itemsCount: 2,
  },
};

describe('buildBrandedReceiptHtml', () => {
  it('renders a self-contained HTML document with no external references', () => {
    const html = buildBrandedReceiptHtml(SAMPLE_RECEIPT);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<link/);
  });

  it('splits "Shree Fashion Store" into the monogram (URL-encoded श्री data URI) + wordmark', () => {
    const html = buildBrandedReceiptHtml(SAMPLE_RECEIPT);
    expect(html).toContain(encodeURIComponent('श्री'));
    expect(html).toContain('FASHION STORE');
  });

  it('maps bill number, date, customer and line items from the payload', () => {
    const html = buildBrandedReceiptHtml(SAMPLE_RECEIPT);
    expect(html).toContain('S-1042');
    expect(html).toContain('11/09/2026');
    expect(html).toContain('Priya Sharma');
    expect(html).toContain('9876543210');
    expect(html).toContain('Kurti - Red - M');
    expect(html).toContain('Dupatta - Gold');
    expect(html).toContain('₹3,450.00');
  });

  it('renders exactly the real number of line items, not a padded template', () => {
    const html = buildBrandedReceiptHtml(SAMPLE_RECEIPT);
    const rowMatches = html.match(/<td class="c-sno">\d+\.<\/td>/g) || [];
    expect(rowMatches).toHaveLength(2);
  });

  it('spells out the total in Indian-English words', () => {
    const html = buildBrandedReceiptHtml(SAMPLE_RECEIPT);
    expect(html).toContain('Rupees Three Thousand Four Hundred Fifty Only');
  });

  it('falls back to "Walk-in Customer" when there is no customer on file', () => {
    const html = buildBrandedReceiptHtml({ ...SAMPLE_RECEIPT, customer: null });
    expect(html).toContain('Walk-in Customer');
  });

  it('escapes HTML-significant characters in user-supplied fields', () => {
    const html = buildBrandedReceiptHtml({
      ...SAMPLE_RECEIPT,
      customer: { name: '<script>alert(1)</script>', phone: '' },
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('accepts a swapped-in logo source', () => {
    const html = buildBrandedReceiptHtml(SAMPLE_RECEIPT, { logoSrc: '/branding/real-logo.png' });
    expect(html).toContain('src="/branding/real-logo.png"');
  });
});
