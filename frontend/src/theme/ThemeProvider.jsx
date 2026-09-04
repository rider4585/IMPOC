import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  DEFAULT_SETTINGS,
  THEME_STORAGE_KEY,
} from './theme-config';

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

function applyToDocument(settings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', settings.colorScheme);
  root.setAttribute('data-primary', settings.primaryColor);
  root.setAttribute('data-font', settings.fontFamily);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', settings.colorScheme);
}

export function ThemeProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    applyToDocument(settings);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable */
    }
  }, [settings]);

  const setColorScheme = useCallback((colorScheme) => {
    setSettings((s) => ({ ...s, colorScheme }));
  }, []);

  const setPrimaryColor = useCallback((primaryColor) => {
    setSettings((s) => ({ ...s, primaryColor }));
  }, []);

  const setFontFamily = useCallback((fontFamily) => {
    setSettings((s) => ({ ...s, fontFamily }));
  }, []);

  const reset = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const value = useMemo(
    () => ({ settings, setColorScheme, setPrimaryColor, setFontFamily, reset }),
    [settings, setColorScheme, setPrimaryColor, setFontFamily, reset],
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
