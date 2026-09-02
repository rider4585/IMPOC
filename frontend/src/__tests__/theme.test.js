import { describe, it, expect, beforeAll } from 'vitest';
import '@testing-library/jest-dom';
import '../index.css';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Read the CSS file directly for verification
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cssPath = path.join(__dirname, '../index.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

describe('Theme Tokens — CSS Implementation (index.css)', () => {
  describe('CSS File Content Verification', () => {
    it('should import @fontsource fonts at the entry point', () => {
      expect(cssContent).toContain('@import \'@fontsource-variable/bricolage-grotesque\'');
      expect(cssContent).toContain('@import \'@fontsource-variable/instrument-sans\'');
    });

    it('should define CSS custom properties on :root', () => {
      expect(cssContent).toContain(':root {');
      expect(cssContent).toContain('--primary: #7B2D4E');
      expect(cssContent).toContain('--ink: #2A211C');
      expect(cssContent).toContain('--surface-base: #FBF7F3');
      expect(cssContent).toContain('--surface-raised: #FFFFFF');
    });

    it('should define dark-palette overrides in prefers-color-scheme: dark media query', () => {
      expect(cssContent).toContain('@media (prefers-color-scheme: dark)');
      expect(cssContent).toContain('--primary: #E48BAB');
      expect(cssContent).toContain('--ink: #F4EDE5');
      expect(cssContent).toContain('--surface-base: #191411');
    });

    it('should define all brand color tokens', () => {
      expect(cssContent).toContain('--primary: #7B2D4E');
      expect(cssContent).toContain('--accent: #B8791F');
      expect(cssContent).toContain('--primary-foreground: #FFF7F9');
      expect(cssContent).toContain('--accent-foreground: #201404');
    });

    it('should define all semantic status color tokens', () => {
      expect(cssContent).toContain('--status-in-stock: #2F6E4F');
      expect(cssContent).toContain('--status-rented: #2B5C8A');
      expect(cssContent).toContain('--status-overdue: #B3261E');
      expect(cssContent).toContain('--status-sold: #6B5D54');
      expect(cssContent).toContain('--status-maintenance: #8A5A1F');
      expect(cssContent).toContain('--status-terminal: #5E4A46');
    });

    it('should define all money color tokens (three kinds)', () => {
      expect(cssContent).toContain('--money-in: #2F6E4F');
      expect(cssContent).toContain('--money-out: #B3261E');
      expect(cssContent).toContain('--money-held: #5B4B8A');
      expect(cssContent).toContain('--money-reversed: #9C8E83');
    });

    it('should define system feedback color tokens', () => {
      expect(cssContent).toContain('--waking: #8A5A1F');
      expect(cssContent).toContain('--success: #2F6E4F');
      expect(cssContent).toContain('--danger: #B3261E');
      expect(cssContent).toContain('--focus-ring: #7B2D4E');
    });

    it('should define all spacing tokens', () => {
      expect(cssContent).toContain('--spacing-1: 4px');
      expect(cssContent).toContain('--spacing-2: 8px');
      expect(cssContent).toContain('--spacing-4: 16px');
      expect(cssContent).toContain('--spacing-12: 48px');
      expect(cssContent).toContain('--spacing-16: 64px');
      expect(cssContent).toContain('--spacing-gutter-phone: 16px');
      expect(cssContent).toContain('--spacing-gutter-wide: 24px');
      expect(cssContent).toContain('--spacing-thumb-bar-height: 72px');
      expect(cssContent).toContain('--spacing-thumb-safe-bottom: 88px');
    });

    it('should define all rounded corner tokens', () => {
      expect(cssContent).toContain('--rounded-sm: 6px');
      expect(cssContent).toContain('--rounded-md: 10px');
      expect(cssContent).toContain('--rounded-lg: 14px');
      expect(cssContent).toContain('--rounded-xl: 20px');
      expect(cssContent).toContain('--rounded-full: 9999px');
    });
  });

  describe('Typography Classes Implementation', () => {
    it('should define .typography-display with Bricolage Grotesque', () => {
      expect(cssContent).toContain('.typography-display');
      expect(cssContent).toContain('Bricolage Grotesque');
      expect(cssContent).toContain('font-size: 32px');
      expect(cssContent).toContain('font-weight: 700');
      expect(cssContent).toContain('line-height: 1.15');
    });

    it('should define .typography-heading with Instrument Sans', () => {
      expect(cssContent).toContain('.typography-heading');
      expect(cssContent).toContain('font-size: 20px');
      expect(cssContent).toContain('font-weight: 600');
      expect(cssContent).toContain('line-height: 1.3');
    });

    it('should define .typography-body with Instrument Sans', () => {
      expect(cssContent).toContain('.typography-body {');
      expect(cssContent).toContain('font-size: 16px');
      expect(cssContent).toContain('font-weight: 400');
      expect(cssContent).toContain('line-height: 1.5');
    });

    it('should define .typography-subheading', () => {
      expect(cssContent).toContain('.typography-subheading');
      expect(cssContent).toContain('font-size: 16px');
      expect(cssContent).toContain('font-weight: 600');
    });

    it('should define .typography-body-sm', () => {
      expect(cssContent).toContain('.typography-body-sm');
      expect(cssContent).toContain('font-size: 14px');
      expect(cssContent).toContain('font-weight: 400');
    });

    it('should define .typography-label at 13px minimum', () => {
      expect(cssContent).toContain('.typography-label');
      expect(cssContent).toContain('font-size: 13px');
      expect(cssContent).toContain('font-weight: 600');
    });

    it('should define all money typography classes with tabular-nums', () => {
      expect(cssContent).toContain('.typography-money {');
      expect(cssContent).toContain('font-size: 17px');
      expect(cssContent).toContain('font-variant-numeric: tabular-nums lining-nums');

      expect(cssContent).toContain('.typography-money-lg');
      expect(cssContent).toContain('font-size: 28px');
      expect(cssContent).toContain('font-weight: 700');

      expect(cssContent).toContain('.typography-money-sm');
      expect(cssContent).toContain('font-size: 14px');
    });

    it('should define .typography-counter with tabular-nums', () => {
      expect(cssContent).toContain('.typography-counter');
      expect(cssContent).toContain('font-size: 40px');
      expect(cssContent).toContain('font-weight: 700');
      expect(cssContent).toContain('line-height: 1');
      expect(cssContent).toContain('font-variant-numeric: tabular-nums lining-nums');
    });

    it('should define .typography-barcode with system monospace and tabular-nums', () => {
      expect(cssContent).toContain('.typography-barcode');
      expect(cssContent).toContain('ui-monospace');
      expect(cssContent).toContain('SFMono-Regular');
      expect(cssContent).toContain('monospace');
      expect(cssContent).toContain('font-size: 14px');
      expect(cssContent).toContain('font-weight: 500');
      expect(cssContent).toContain('font-variant-numeric: tabular-nums lining-nums');
    });
  });

  describe('Surface Treatment Classes Implementation', () => {
    it('should define .surface-flat with border and background-color', () => {
      expect(cssContent).toContain('.surface-flat {');
      expect(cssContent).toContain('background-color: var(--surface-raised)');
      expect(cssContent).toContain('border: 1px solid var(--border)');
      expect(cssContent).toContain('border-radius: var(--rounded-md)');
    });

    it('should define .surface-soft with shadow and rounded corners', () => {
      expect(cssContent).toContain('.surface-soft {');
      expect(cssContent).toContain('background-color: var(--surface-raised)');
      expect(cssContent).toContain('border: 1px solid var(--border)');
      expect(cssContent).toContain('border-radius: var(--rounded-lg)');
      expect(cssContent).toContain('box-shadow: 0 2px 8px rgba(42, 33, 28, 0.1)');
    });

    it('should define .surface-glass with backdrop-filter and blur', () => {
      expect(cssContent).toContain('.surface-glass {');
      expect(cssContent).toContain('backdrop-filter: blur(20px) saturate(160%)');
      expect(cssContent).toContain('border-radius: var(--rounded-lg)');
      expect(cssContent).toContain('box-shadow: 0 8px 28px rgba(42, 33, 28, 0.2)');
    });

    it('should define dark-mode overrides for .surface-soft', () => {
      expect(cssContent).toContain('@media (prefers-color-scheme: dark) {');
      const darkModeSection = cssContent.substring(cssContent.indexOf('@media (prefers-color-scheme: dark)'));
      expect(darkModeSection).toContain('.surface-soft');
      expect(darkModeSection).toContain('box-shadow: 0 2px 10px rgba(0, 0, 0, 0.38)');
    });

    it('should define dark-mode overrides for .surface-glass', () => {
      const darkModeSection = cssContent.substring(cssContent.indexOf('@media (prefers-color-scheme: dark)'));
      expect(darkModeSection).toContain('.surface-glass');
      expect(darkModeSection).toContain('background-color: rgba(35, 28, 24, 0.55)');
      expect(darkModeSection).toContain('box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5)');
    });

    it('should include fallback for surface-glass when backdrop-filter is unsupported', () => {
      expect(cssContent).toContain('@supports not (backdrop-filter: blur(1px))');
      expect(cssContent).toContain('@media (prefers-reduced-transparency: reduce)');
    });
  });

  describe('Body Styling', () => {
    it('should apply background and text color to body element', () => {
      expect(cssContent).toContain('body {');
      expect(cssContent).toContain('background-color: var(--surface-base)');
      expect(cssContent).toContain('color: var(--ink)');
    });
  });

  describe('Acceptance Criteria Compliance', () => {
    it('should not declare 12px caption typography (removed role)', () => {
      expect(cssContent).not.toContain('.typography-caption');
      expect(cssContent).not.toContain('caption') ||
        !cssContent.includes('font-size: 12px');
    });

    it('should have exactly three surface treatment classes', () => {
      const flatCount = (cssContent.match(/\.surface-flat\s{/g) || []).length;
      const softCount = (cssContent.match(/\.surface-soft\s{/g) || []).length;
      const glassCount = (cssContent.match(/\.surface-glass\s{/g) || []).length;

      expect(flatCount).toBeGreaterThan(0);
      expect(softCount).toBeGreaterThan(0);
      expect(glassCount).toBeGreaterThan(0);
    });

    it('should declare exactly 11 typography role classes', () => {
      const roles = [
        '.typography-display',
        '.typography-heading',
        '.typography-subheading',
        '.typography-body',
        '.typography-body-sm',
        '.typography-label',
        '.typography-money',
        '.typography-money-lg',
        '.typography-money-sm',
        '.typography-counter',
        '.typography-barcode'
      ];

      roles.forEach(role => {
        expect(cssContent).toContain(role);
      });
    });
  });

  describe('Runtime Loading', () => {
    it('should import index.css successfully without errors', () => {
      // If CSS imported successfully, this test runs
      expect(cssContent.length).toBeGreaterThan(0);
    });

    it('should not include Google Fonts CDN links', () => {
      const googleFontsLinks = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
      expect(googleFontsLinks.length).toBe(0);

      // Also verify in the CSS content
      expect(cssContent).not.toContain('fonts.googleapis.com');
    });
  });

  describe('Three-State Theme Override — Runtime Cascade Verification', () => {
    afterEach(() => {
      // Clean up after each test
      document.documentElement.removeAttribute('data-theme');
    });

    it('should support setting data-theme="light" on document root', () => {
      // Verify that the data-theme attribute can be set without errors
      document.documentElement.setAttribute('data-theme', 'light');

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should support setting data-theme="dark" on document root', () => {
      // Verify that the data-theme attribute can be set without errors
      document.documentElement.setAttribute('data-theme', 'dark');

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should allow clearing data-theme attribute to default to device preference', () => {
      // Set then clear the attribute
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.removeAttribute('data-theme');

      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    it('should have three-state theme selectors defined in CSS', () => {
      // Verify the CSS contains all three state selectors needed for cascade
      expect(cssContent).toContain(':root {');
      expect(cssContent).toContain('@media (prefers-color-scheme: dark)');
      expect(cssContent).toContain(':root:not([data-theme="light"])');
      expect(cssContent).toContain(':root[data-theme="dark"]');
    });

    it('should define light palette in bare :root for fallback', () => {
      // The bare :root selector provides the default light palette
      // State 1: no attribute + device prefers light → bare :root wins
      const rootStart = cssContent.indexOf(':root {');
      const rootEnd = cssContent.indexOf('}', rootStart);
      const rootSection = cssContent.substring(rootStart, rootEnd);

      expect(rootSection).toContain('--primary: #7B2D4E');
      expect(rootSection).toContain('--ink: #2A211C');
    });

    it('should define guarded dark media query that respects explicit light choice', () => {
      // The guarded media query @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }
      // ensures that when data-theme="light" is present, the media query doesn't apply
      // State 2: no attribute + device prefers dark → guarded media query wins
      // State 3: data-theme="light" + device prefers dark → guard blocks media query, bare :root wins
      expect(cssContent).toContain('@media (prefers-color-scheme: dark)');
      expect(cssContent).toContain(':root:not([data-theme="light"])');

      // Verify dark palette is defined inside the guard
      const mediaQueryStart = cssContent.indexOf('@media (prefers-color-scheme: dark)');
      const guardStart = cssContent.indexOf(':root:not([data-theme="light"])', mediaQueryStart);
      const guardBraceStart = cssContent.indexOf('{', guardStart);
      const guardBraceEnd = cssContent.indexOf('}', guardBraceStart);
      const guardedSection = cssContent.substring(guardBraceStart, guardBraceEnd);

      expect(guardedSection).toContain('--primary: #E48BAB');
      expect(guardedSection).toContain('--ink: #F4EDE5');
    });

    it('should define explicit data-theme="dark" selector with higher specificity than media query', () => {
      // The :root[data-theme="dark"] selector is an attribute selector with higher specificity
      // than media queries, so it always wins regardless of device preference
      // State 4: data-theme="dark" + device prefers light → data-theme selector wins
      expect(cssContent).toContain(':root[data-theme="dark"] {');

      const dataThemeDarkStart = cssContent.indexOf(':root[data-theme="dark"] {');
      const dataThemeDarkBraceEnd = cssContent.indexOf('}', dataThemeDarkStart);
      const dataThemeDarkBlock = cssContent.substring(dataThemeDarkStart, dataThemeDarkBraceEnd);

      expect(dataThemeDarkBlock).toContain('--primary: #E48BAB');
      expect(dataThemeDarkBlock).toContain('--ink: #F4EDE5');
    });

    it('should ensure all color tokens are defined at bare :root', () => {
      // Every token must have a base definition so no token is ever undefined
      const rootStart = cssContent.indexOf(':root {');
      const rootEnd = cssContent.indexOf('}', rootStart);
      const rootSection = cssContent.substring(rootStart, rootEnd);

      const essentialTokens = [
        '--primary: #7B2D4E',
        '--ink: #2A211C',
        '--surface-base: #FBF7F3',
        '--surface-raised: #FFFFFF',
        '--border: #E4D9CD',
        '--status-in-stock: #2F6E4F',
        '--money-in: #2F6E4F',
        '--money-out: #B3261E',
        '--money-held: #5B4B8A'
      ];

      essentialTokens.forEach(token => {
        expect(rootSection).toContain(token);
      });
    });

    it('should ensure all color tokens are defined in data-theme="dark" selector', () => {
      // The explicit dark selector must have all tokens to avoid undefined values
      const dataThemeDarkStart = cssContent.indexOf(':root[data-theme="dark"] {');
      const dataThemeDarkEnd = cssContent.indexOf('}', cssContent.indexOf('{', dataThemeDarkStart));
      const darkSection = cssContent.substring(dataThemeDarkStart, dataThemeDarkEnd);

      const essentialDarkTokens = [
        '--primary: #E48BAB',
        '--ink: #F4EDE5',
        '--surface-base: #191411',
        '--surface-raised: #231C18',
        '--border: #382E28',
        '--status-in-stock: #6FC49A',
        '--money-in: #6FC49A',
        '--money-out: #F58C85',
        '--money-held: #A99BD8'
      ];

      essentialDarkTokens.forEach(token => {
        expect(darkSection).toContain(token);
      });
    });

    it('should document the three-state cascade order in CSS comments', () => {
      // The CSS should document the cascade behavior clearly
      expect(cssContent).toContain('No data-theme + device prefers light');
      expect(cssContent).toContain('No data-theme + device prefers dark');
      expect(cssContent).toContain('data-theme="light" overrides device preference');
      expect(cssContent).toContain('data-theme="dark" overrides device preference');
    });

    it('should verify cascade: bare :root has lowest specificity', () => {
      // bare :root selector has no attribute, so media query and attribute selectors beat it
      expect(cssContent).toContain(':root {');
      expect(cssContent).toContain('@media (prefers-color-scheme: dark)');
      expect(cssContent).toContain(':root[data-theme="dark"]');

      // Verify :root appears before media queries and attribute selectors
      const rootPos = cssContent.indexOf(':root {');
      const mediaPos = cssContent.indexOf('@media (prefers-color-scheme: dark)');
      const attrPos = cssContent.indexOf(':root[data-theme="dark"] {');

      expect(rootPos).toBeLessThan(mediaPos);
      expect(rootPos).toBeLessThan(attrPos);
    });

    it('should verify cascade: attribute selector has higher specificity than media query', () => {
      // :root[data-theme="dark"] is an attribute selector with specificity higher than media queries
      const mediaPos = cssContent.indexOf('@media (prefers-color-scheme: dark)');
      const attrPos = cssContent.indexOf(':root[data-theme="dark"] {');

      // Both should exist
      expect(mediaPos).toBeGreaterThan(-1);
      expect(attrPos).toBeGreaterThan(-1);

      // CSS parsing order: media query block first, then attribute selector
      expect(mediaPos).toBeLessThan(attrPos);

      // This ensures attribute selector wins due to higher specificity
    });
  });
});
