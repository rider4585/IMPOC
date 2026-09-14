import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  DEFAULT_SETTINGS,
  THEME_STORAGE_KEY,
  CUSTOM_PRIMARY,
} from './theme-config';
import { isHexColor, primaryVarsFor } from './color-utils.js';

const ThemeContext = createContext(null);

function loadSettings() {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// 'system' resolves to the OS preference; light/dark are explicit overrides.
function resolveScheme(colorScheme, systemDark) {
  if (colorScheme !== 'system') return colorScheme;
  return systemDark ? 'dark' : 'light';
}

function applyToDocument(settings, effectiveScheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', effectiveScheme);
  root.setAttribute('data-primary', settings.primaryColor);
  root.setAttribute('data-font', settings.fontFamily);
  // R-58: a custom accent overrides the preset variables inline; presets clear them
  const custom = settings.primaryColor === CUSTOM_PRIMARY && isHexColor(settings.customPrimary)
    ? primaryVarsFor(settings.customPrimary)
    : null;
  for (const name of ['--primary', '--primary-hover', '--primary-foreground', '--focus-ring']) {
    if (custom) root.style.setProperty(name, custom[name]);
    else root.style.removeProperty(name);
  }
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', effectiveScheme);
}

export function ThemeProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);
  const [systemDark, setSystemDark] = useState(() => {
    try {
      return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mql = null;
    try {
      if (typeof window.matchMedia === 'function') {
        mql = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e) => setSystemDark(e.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
      }
    } catch {
      /* matchMedia unavailable */
    }
    return undefined;
  }, []);

  const resolvedColorScheme = useMemo(
    () => resolveScheme(settings.colorScheme, systemDark),
    [settings.colorScheme, systemDark],
  );

  useEffect(() => {
    applyToDocument(settings, resolvedColorScheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable */
    }
  }, [resolvedColorScheme, settings]);

  const setColorScheme = useCallback((colorScheme) => {
    setSettings((s) => ({ ...s, colorScheme }));
  }, []);

  const setPrimaryColor = useCallback((primaryColor) => {
    setSettings((s) => ({ ...s, primaryColor }));
  }, []);

  /** R-58: pick a custom accent (#RRGGBB) — also switches the preset to 'custom'. */
  const setCustomPrimary = useCallback((hex) => {
    if (!isHexColor(hex)) return;
    setSettings((s) => ({ ...s, primaryColor: CUSTOM_PRIMARY, customPrimary: hex.toUpperCase() }));
  }, []);

  const setFontFamily = useCallback((fontFamily) => {
    setSettings((s) => ({ ...s, fontFamily }));
  }, []);

  const reset = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const value = useMemo(
    () => ({ settings, resolvedColorScheme, setColorScheme, setPrimaryColor, setCustomPrimary, setFontFamily, reset }),
    [settings, resolvedColorScheme, setColorScheme, setPrimaryColor, setCustomPrimary, setFontFamily, reset],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}