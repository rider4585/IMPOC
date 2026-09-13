import { describe, it, expect } from 'vitest';
import { computeSheetGeometry, DEFAULT_LAYOUT, PAGE_SIZE_OPTIONS, mmToUnit, unitToMm, resolvePageSizePt } from './labelLayout.js';

describe('labelLayout page sizes + units (R-56)', () => {
  it('offers A3/A4/A5/Letter/Custom and knows A3 in points', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual(['A3', 'A4', 'A5', 'LETTER', 'CUSTOM']);
    expect(resolvePageSizePt({ pageSize: 'A3' })).toEqual({ width: 841.89, height: 1190.55 });
  });

  it('resolves a custom page from mm and flags out-of-range sizes', () => {
    const g = computeSheetGeometry({ ...DEFAULT_LAYOUT, pageSize: 'CUSTOM', pageCustomWidthMm: 101.6, pageCustomHeightMm: 152.4, columns: 2, rows: 3, marginTopMm: 4, marginRightMm: 4, marginBottomMm: 4, marginLeftMm: 4, gapHorizontalMm: 3, gapVerticalMm: 3 });
    expect(g.page.width).toBeCloseTo(288, 1);  // 4 in
    expect(g.page.height).toBeCloseTo(432, 1); // 6 in
    expect(g.problems).toEqual([]);
    expect(computeSheetGeometry({ ...DEFAULT_LAYOUT, pageSize: 'CUSTOM', pageCustomWidthMm: 20, pageCustomHeightMm: 100 }).problems[0]).toMatch(/50 mm and 2000 mm/);
  });

  it('converts between mm and cm / inch both ways', () => {
    expect(mmToUnit(101.6, 'in')).toBe('4');
    expect(mmToUnit(101.6, 'cm')).toBe('10.16');
    expect(mmToUnit(101.6, 'mm')).toBe('101.6');
    expect(unitToMm('4', 'in')).toBe(101.6);
    expect(unitToMm('15.24', 'cm')).toBe(152.4);
    expect(unitToMm('210', 'mm')).toBe(210);
  });
});
