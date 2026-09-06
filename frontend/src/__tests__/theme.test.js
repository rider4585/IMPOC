import { describe, it, expect } from 'vitest';
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

describe('Revamp Design System — Tailwind v4, DARK-PRIMARY (index.css)', () => {
  describe('Tailwind + font entry', () => {
    it('should import Tailwind v4 at the entry point', () => {
      expect(cssContent).toContain("@import 'tailwindcss'");
    });

    it('should import @fontsource fonts at the entry point', () => {
      expect(cssContent).toContain("@import '@fontsource-variable/bricolage-grotesque'");
      expect(cssContent).toContain("@import '@fontsource-variable/instrument-sans'");
      expect(cssContent).toContain("@import '@fontsource-variable/public-sans'");
      expect(cssContent).toContain("@import '@fontsource-variable/inter'");
      expect(cssContent).toContain("@import '@fontsource/barlow");
    });

    it('should define a Tailwind @theme block', () => {
      expect(cssContent).toContain('@theme {');
    });
  });

  describe('Dark-primary brand + surface tokens', () => {
    it('should define gold-brand token values on :root', () => {
      expect(cssContent).toContain(':root {');
      expect(cssContent).toContain('--primary: #FAAF00');
      expect(cssContent).toContain('--primary-foreground: #201604');
      expect(cssContent).toContain('--accent: #FAAF00');
    });

    it('should define dark surfaces and high-contrast ink tokens', () => {
      expect(cssContent).toContain('--surface-base: #141A21');
      expect(cssContent).toContain('--surface-raised: #1C252E');
      expect(cssContent).toContain('--ink: #FFFFFF');
      expect(cssContent).toContain('--ink-muted: #919EAB');
      expect(cssContent).toContain('--border: #1C252E');
      expect(cssContent).toContain('--border-strong: #28323D');
    });

    it('should map tokens into the Tailwind @theme', () => {
      const themeSection = cssContent.substring(
        cssContent.indexOf('@theme {'),
        cssContent.indexOf('}', cssContent.indexOf('@theme {'))
      );
      expect(themeSection).toContain('--color-primary: var(--primary)');
      expect(themeSection).toContain('--color-surface-base: var(--surface-base)');
      expect(themeSection).toContain('--color-ink: var(--ink)');
    });
  });

  describe('Semantic unit-status tokens', () => {
    it('should define all unit status colors', () => {
      expect(cssContent).toContain('--status-in-stock: #22C55E');
      expect(cssContent).toContain('--status-rented: #61F3F3');
      expect(cssContent).toContain('--status-overdue: #FF5630');
      expect(cssContent).toContain('--status-sold: #919EAB');
      expect(cssContent).toContain('--status-maintenance: #FAAF00');
      expect(cssContent).toContain('--status-terminal: #637381');
    });
  });

  describe('Semantic money tokens', () => {
    it('should define all money color tokens (three kinds)', () => {
      expect(cssContent).toContain('--money-in: #22C55E');
      expect(cssContent).toContain('--money-out: #FF5630');
      expect(cssContent).toContain('--money-held: #61F3F3');
      expect(cssContent).toContain('--money-reversed: #637381');
    });
  });

  describe('System feedback tokens', () => {
    it('should define feedback + focus colors', () => {
      expect(cssContent).toContain('--success: #22C55E');
      expect(cssContent).toContain('--danger: #FF5630');
      expect(cssContent).toContain('--waking: #FAAF00');
      expect(cssContent).toContain('--focus-ring: #FAAF00');
    });
  });

  describe('Theme-aware constraint (dark-primary + light override via data-theme)', () => {
    it('should NOT rely on prefers-color-scheme media queries', () => {
      expect(cssContent).not.toMatch(/prefers-color-scheme:\s*dark/);
    });

    it('should define a dark palette via html[data-theme="dark"]', () => {
      expect(cssContent).toContain("html[data-theme='dark']");
      expect(cssContent).toMatch(/data-theme/);
    });

    it('should define a light adaptation via html[data-theme="light"] keeping gold brand', () => {
      expect(cssContent).toContain("html[data-theme='light']");
      expect(cssContent).toContain('--surface-base: #F4F6F8');
      expect(cssContent).toContain('--ink: #212B36');
    });

    it('should drive tailwind colors from CSS vars for live theme switching', () => {
      const themeSection = cssContent.substring(
        cssContent.indexOf('@theme {'),
        cssContent.indexOf('}', cssContent.indexOf('@theme {'))
      );
      expect(themeSection).toContain('--color-primary: var(--primary)');
      expect(themeSection).toContain('--color-surface-raised: var(--surface-raised)');
      expect(themeSection).toContain('--color-ink: var(--ink)');
      expect(themeSection).toContain('--font-sans: var(--font-body)');
    });

    it('should define primary color presets via data-primary', () => {
      expect(cssContent).toContain("html[data-primary='default']");
      expect(cssContent).toContain("html[data-primary='green']");
      expect(cssContent).toContain("html[data-primary='violet']");
    });

    it('should define font presets via data-font', () => {
      expect(cssContent).toContain("html[data-font='minimals']");
      expect(cssContent).toContain("html[data-font='classic']");
    });
  });

  describe('Typography classes (roles preserved)', () => {
    it('should define all typography role classes', () => {
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
        '.typography-barcode',
      ];
      roles.forEach((role) => {
        expect(cssContent).toContain(role);
      });
    });

    it('should define money typography with tabular-nums', () => {
      expect(cssContent).toContain('font-variant-numeric: tabular-nums lining-nums');
    });
  });

  describe('Surface treatment classes (preserved, theme-aware)', () => {
    it('should define all three surface classes', () => {
      expect(cssContent).toContain('.surface-flat {');
      expect(cssContent).toContain('.surface-soft {');
      expect(cssContent).toContain('.surface-glass {');
    });

    it('should keep the reduced-transparency glass fallback', () => {
      expect(cssContent).toContain('@media (prefers-reduced-transparency: reduce)');
    });
  });

  describe('Body styling + runtime', () => {
    it('should apply background and text color to body', () => {
      expect(cssContent).toContain('body {');
      expect(cssContent).toContain('background-color: var(--surface-base)');
      expect(cssContent).toContain('color: var(--ink)');
    });

    it('should import the stylesheet cleanly', () => {
      expect(cssContent.length).toBeGreaterThan(0);
    });

    it('should not include Google Fonts CDN links', () => {
      const googleFontsLinks = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
      expect(googleFontsLinks.length).toBe(0);
      expect(cssContent).not.toContain('fonts.googleapis.com');
    });
  });
});
