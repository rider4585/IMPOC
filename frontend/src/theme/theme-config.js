export const THEME_STORAGE_KEY = 'impoc-theme-settings';

export const COLOR_SCHEMES = [
  { value: 'light', label: 'Light', swatch: '#F4F6F8' },
  { value: 'dark', label: 'Dark', swatch: '#161C24' },
];

export const PRIMARY_PRESETS = [
  { value: 'default', label: 'Default', color: '#2065D1' },
  { value: 'green', label: 'Green', color: '#22C55E' },
  { value: 'cyan', label: 'Cyan', color: '#00B8D9' },
  { value: 'orange', label: 'Orange', color: '#FFAB00' },
  { value: 'violet', label: 'Violet', color: '#8E33FF' },
];

export const FONT_PRESETS = [
  { value: 'minimals', label: 'Minimals (Public Sans + Barlow)', font: 'Public Sans' },
  { value: 'public-sans', label: 'Public Sans', font: 'Public Sans' },
  { value: 'barlow', label: 'Barlow', font: 'Barlow' },
  { value: 'classic', label: 'Classic (Instrument Sans + Bricolage)', font: 'Instrument Sans' },
];

export const DEFAULT_SETTINGS = {
  colorScheme: 'light',
  primaryColor: 'default',
  fontFamily: 'minimals',
};
