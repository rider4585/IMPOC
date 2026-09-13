import { describe, it, expect } from 'vitest';
import { landedCostPerUnit, parsePercent } from './gst.js';

describe('landedCostPerUnit (R-51)', () => {
  it('adds CGST + SGST on the per-unit buying price', () => {
    expect(landedCostPerUnit({ buyingPricePaise: 100000, cgstRatePct: 2.5, sgstRatePct: 2.5 })).toEqual({
      basePaise: 100000,
      gstPaise: 5000,
      totalPaise: 105000,
      ratePct: 5,
    });
  });

  it('falls back to whole-lot price / quantity when there is no per-unit price', () => {
    const r = landedCostPerUnit({ buyingPricePaise: 0, wholeBuyingPricePaise: 120000, quantity: 4, cgstRatePct: 6, sgstRatePct: 6 });
    expect(r.basePaise).toBe(30000);
    expect(r.gstPaise).toBe(3600);
    expect(r.totalPaise).toBe(33600);
  });

  it('rounds GST to the nearest paisa', () => {
    // 333.33 * 5% = 16.6665 -> 16.67
    expect(landedCostPerUnit({ buyingPricePaise: 33333, cgstRatePct: 2.5, sgstRatePct: 2.5 }).gstPaise).toBe(1667);
  });

  it('treats missing rates as 0 and returns null without a price', () => {
    expect(landedCostPerUnit({ buyingPricePaise: 5000 }).totalPaise).toBe(5000);
    expect(landedCostPerUnit({ buyingPricePaise: NaN, wholeBuyingPricePaise: null, quantity: 1 })).toBeNull();
    expect(landedCostPerUnit({ buyingPricePaise: 0, wholeBuyingPricePaise: 1000, quantity: 0 })).toBeNull();
  });
});

describe('parsePercent', () => {
  it('accepts up to 2 decimals within 0..100, empty means 0', () => {
    expect(parsePercent('2.5')).toBe(2.5);
    expect(parsePercent('18')).toBe(18);
    expect(parsePercent('')).toBe(0);
    expect(parsePercent(' 0 ')).toBe(0);
  });
  it('rejects junk, negatives, >100, and 3+ decimals', () => {
    for (const bad of ['abc', '-1', '101', '2.555', '1e2']) expect(Number.isNaN(parsePercent(bad))).toBe(true);
  });
});
