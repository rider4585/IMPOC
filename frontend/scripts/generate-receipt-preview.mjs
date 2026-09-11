#!/usr/bin/env node
/**
 * Regenerates `frontend/doc/receipt-preview.html` — a standalone, static copy
 * of the branded receipt (R-45) the human can open directly via `file://`
 * with no dev server, for fast visual iteration.
 *
 * This is GENERATED, not hand-written: it calls the same
 * `buildBrandedReceiptHtml` the app itself uses (imported straight from
 * `../src/platform/brandedReceiptHtml.js`), with a baked-in realistic sample
 * sale. Re-run this after any change to the receipt template so the preview
 * file and the real receipt never drift:
 *
 *   node frontend/scripts/generate-receipt-preview.mjs
 *   (or: npm run receipt:preview --prefix frontend)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBrandedReceiptHtml } from '../src/platform/brandedReceiptHtml.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SAMPLE_RECEIPT = {
  store: { name: 'Shree Fashion Store', address: 'Shop 12, Main Bazaar Road, Nashik', phone: '9822011223' },
  transaction: {
    type: 'SALE',
    number: 'S-1042',
    date: '2026-09-11T10:30:00.000Z',
    paymentMethod: 'UPI',
    totalPaise: '498500',
    paidPaise: '498500',
    changePaise: '0',
    status: 'COMPLETED',
  },
  customer: { name: 'Priya Sharma', phone: '9876543210', email: 'priya.sharma@example.com' },
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
    {
      productName: 'Palazzo',
      productType: 'Palazzo',
      colour: 'Black',
      size: 'L',
      quantity: 1,
      unitPricePaise: '153500',
      lineTotalPaise: '153500',
    },
  ],
  totals: {
    subtotalPaise: '498500',
    discountPaise: '0',
    totalPaise: '498500',
    amountPaidPaise: '498500',
    balancePaise: '0',
    itemsCount: 3,
  },
};

const html = buildBrandedReceiptHtml(SAMPLE_RECEIPT);
const outPath = join(__dirname, '..', 'doc', 'receipt-preview.html');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, 'utf8');

console.log(`Wrote ${outPath}`);
