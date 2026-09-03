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

describe('Revamp Design System — Tailwind v4, LIGHT MODE ONLY (index.css)', () => {
  describe('Tailwind + font entry', () => {
    it('should import Tailwind v4 at the entry point', () => {
      expect(cssContent).toContain("@import 'tailwindcss'");
    });

    it('should import @fontsource fonts at the entry point', () => {
      expect(cssContent).toContain("@import '@fontsource-variable/bricolage-grotesque'");
      expect(cssContent).toContain("@import '@fontsource-variable/instrument-sans'");
    });

    it('should define a Tailwind @theme block', () => {
      expect(cssContent).toContain('@theme {');
    });
  });

  describe('Light-mode brand + surface tokens', () => {
    it('should define brand token values on :root', () => {
      expect(cssContent).toContain(':root {');
      expect(cssContent).toContain('--primary: #7B2D4E');
      expect(cssContent).toContain('--primary-foreground: #FFF7F9');
      expect(cssContent).toContain('--accent: #B8791F');
    });

    it('should define light surface and ink tokens', () => {
      expect(cssContent).toContain('--surface-base: #FBF7F3');
      expect(cssContent).toContain('--surface-raised: #FFFFFF');
      expect(cssContent).toContain('--ink: #2A211C');
      expect(cssContent).toContain('--ink-muted: #6B5D54');
      expect(cssContent).toContain('--border: #E4D9CD');
      expect(cssContent).toContain('--border-strong: #CBBBAA');
    });

    it('should map tokens into the Tailwind @theme', () => {
      const themeSection = cssContent.substring(
        cssContent.indexOf('@theme {'),
        cssContent.indexOf('}', cssContent.indexOf('@theme {'))
      );
      expect(themeSection).toContain('--color-primary: #7B2D4E');
      expect(themeSection).toContain('--color-surface-base: #FBF7F3');
      expect(themeSection).toContain('--color-ink: #2A211C');
    });
  });

  describe('Semantic unit-status tokens (preserved from bmad)', () => {
    it('should define all unit status colors', () => {
      expect(cssContent).toContain('--status-in-stock: #2F6E4F');
      expect(cssContent).toContain('--status-rented: #2B5C8A');
      expect(cssContent).toContain('--status-overdue: #B3261E');
      expect(cssContent).toContain('--status-sold: #6B5D54');
      expect(cssContent).toContain('--status-maintenance: #8A5A1F');
      expect(cssContent).toContain('--status-terminal: #5E4A46');
    });
  });

  describe('Semantic money tokens (preserved from bmad)', () => {
    it('should define all money color tokens (three kinds)', () => {
      expect(cssContent).toContain('--money-in: #2F6E4F');
      expect(cssContent).toContain('--money-out: #B3261E');
      expect(cssContent).toContain('--money-held: #5B4B8A');
      expect(cssContent).toContain('--money-reversed: #9C8E83');
    });
  });

  describe('System feedback tokens', () => {
    it('should define feedback + focus colors', () => {
      expect(cssContent).toContain('--success: #2F6E4F');
      expect(cssContent).toContain('--danger: #B3261E');
      expect(cssContent).toContain('--waking: #8A5A1F');
      expect(cssContent).toContain('--focus-ring: #7B2D4E');
    });
  });

  describe('LIGHT-ONLY constraint (no dark mode anywhere)', () => {
    it('should NOT contain prefers-color-scheme: dark media queries', () => {
      expect(cssContent).not.toMatch(/prefers-color-scheme:\s*dark/);
    });

    it('should NOT contain dark data-theme selectors', () => {
      expect(cssContent).not.toContain('data-theme="dark"');
      expect(cssContent).not.toContain(':root[data-theme');
    });

    it('should NOT define dark palette hex values', () => {
      expect(cssContent).not.toContain('#191411');
      expect(cssContent).not.toContain('#191411');
      expect(cssContent).not.toContain('#F4EDE5');
      expect(cssContent).not.toContain('#E48BAB');
    });

    it('should keep the app flippable only to light', () => {
      // No dark palette overrides means the theme is light-only by construction.
      expect(cssContent).not.toMatch(/prefers-color-scheme/);
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

  describe('Surface treatment classes (preserved, light-only)', () => {
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
