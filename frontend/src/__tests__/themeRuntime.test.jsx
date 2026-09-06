import React, { act } from 'react';
import { render, cleanup } from '@testing-library/react';
import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

let api;

function Harness() {
  api = useTheme();
  return <div />;
}

describe('ThemeProvider runtime attribute sync', () => {
  beforeEach(() => {
    api = null;
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-primary');
    document.documentElement.removeAttribute('data-font');
  });

  afterEach(() => {
    cleanup();
  });

  it('applies dark default + primary/font attributes on mount', () => {
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>
    );
    const root = document.documentElement;
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-primary')).toBe('default');
    expect(root.getAttribute('data-font')).toBe('minimals');
  });

  it('re-applies data-primary/data-font when changed via the settings API and persists them', () => {
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>
    );
    act(() => api.setPrimaryColor('green'));
    act(() => api.setFontFamily('classic'));
    const root = document.documentElement;
    expect(root.getAttribute('data-primary')).toBe('green');
    expect(root.getAttribute('data-font')).toBe('classic');
    const saved = JSON.parse(localStorage.getItem('impoc-theme-settings') || '{}');
    expect(saved.primaryColor).toBe('green');
    expect(saved.fontFamily).toBe('classic');
  });

  it('reflects an explicit light color scheme on documentElement', () => {
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>
    );
    act(() => api.setColorScheme('light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});