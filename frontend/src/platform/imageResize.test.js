import { describe, it, expect } from 'vitest';
import { fitWithin, dataUrlBytes, RESIZE_DEFAULTS } from './imageResize.js';

describe('imageResize (R-55)', () => {
  it('fits the longest side to maxSide and keeps the aspect ratio', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 }); // never upscales
  });

  it('defaults to 1600px JPEG at 0.82', () => {
    expect(RESIZE_DEFAULTS).toEqual({ maxSide: 1600, quality: 0.82, mimeType: 'image/jpeg' });
  });

  it('estimates bytes from a data-URL payload', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3);
    expect(dataUrlBytes('data:image/jpeg;base64,AAA=')).toBe(2);
    expect(dataUrlBytes('nope')).toBe(0);
  });
});
