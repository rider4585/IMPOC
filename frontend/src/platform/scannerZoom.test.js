import { describe, it, expect, beforeEach } from 'vitest';
import { loadScannerZoom, saveScannerZoom, SCANNER_ZOOM_PRESETS, SCANNER_ZOOM_STORAGE_KEY } from './scannerZoom.js';

describe('scannerZoom preference (R-61)', () => {
  beforeEach(() => localStorage.clear());
  it('defaults to 2x and only accepts the 1x/2x/3x presets', () => {
    expect(SCANNER_ZOOM_PRESETS).toEqual([1, 2, 3]);
    expect(loadScannerZoom()).toBe(2);
    saveScannerZoom(3);
    expect(loadScannerZoom()).toBe(3);
    saveScannerZoom(5); // ignored
    expect(localStorage.getItem(SCANNER_ZOOM_STORAGE_KEY)).toBe('3');
    localStorage.setItem(SCANNER_ZOOM_STORAGE_KEY, 'abc');
    expect(loadScannerZoom()).toBe(2);
  });
});
