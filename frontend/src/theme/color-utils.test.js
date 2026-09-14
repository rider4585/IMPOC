import { describe, it, expect } from 'vitest';
import { isHexColor, darken, foregroundFor, primaryVarsFor, luminance } from './color-utils.js';

describe('color-utils (R-58)', () => {
  it('validates hex colours', () => {
    expect(isHexColor('#FAAF00')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('FAAF00')).toBe(false);
  });
  it('darkens for hover and picks a readable foreground', () => {
    expect(darken('#FFFFFF', 0.5)).toBe('#808080');
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 3);
    expect(foregroundFor('#FAAF00')).toBe('#1A1A1A'); // gold -> dark text
    expect(foregroundFor('#1E3A8A')).toBe('#FFFFFF'); // navy -> white text
  });
  it('derives the four preset variables from one hex', () => {
    expect(primaryVarsFor('#22c55e')).toEqual({
      '--primary': '#22C55E',
      '--primary-hover': '#1EAD53',
      '--primary-foreground': '#FFFFFF', // matches the built-in green preset
      '--focus-ring': '#22C55E',
    });
  });
});
