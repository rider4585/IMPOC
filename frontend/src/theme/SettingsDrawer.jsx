import React from 'react';
import { X, Sun, Moon, Palette, Type, Check } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { COLOR_SCHEMES, PRIMARY_PRESETS, FONT_PRESETS } from './theme-config';

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="typography-label mb-3 flex items-center gap-2 text-[var(--ink-muted)]">
      <Icon className="h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}

export function SettingsDrawer({ open, onClose }) {
  const { settings, resolvedColorScheme, setColorScheme, setPrimaryColor, setFontFamily } = useTheme();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        role="dialog"
        aria-label="Theme settings"
        className={`fixed right-0 top-0 z-50 flex h-full w-[300px] flex-col border-l border-[var(--border)] bg-[var(--surface-raised)] shadow-xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="typography-subheading text-[var(--ink)]">Theme settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-md p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <SectionTitle icon={resolvedColorScheme === 'dark' ? Moon : Sun}>Mode</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_SCHEMES.map((scheme) => {
                const active = settings.colorScheme === scheme.value;
                return (
                  <button
                    key={scheme.value}
                    type="button"
                    onClick={() => setColorScheme(scheme.value)}
                    className={`flex flex-col items-start gap-2 rounded-lg border px-2 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                        : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-[var(--border)]"
                      style={{ background: scheme.swatch }}
                    />
                    <span className="text-sm font-medium text-[var(--ink)]">{scheme.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <SectionTitle icon={Palette}>Color preset</SectionTitle>
            <div className="grid grid-cols-5 gap-2">
              {PRIMARY_PRESETS.map((preset) => {
                const active = settings.primaryColor === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setPrimaryColor(preset.value)}
                    aria-label={preset.label}
                    title={preset.label}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform ${
                      active ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface-raised)]' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.color }}
                  >
                    {active && <Check className="h-5 w-5 text-[var(--primary-foreground)]" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[var(--ink-faint)]">
              {(PRIMARY_PRESETS.find((p) => p.value === settings.primaryColor) || {}).label}
            </p>
          </section>

          <section>
            <SectionTitle icon={Type}>Font family</SectionTitle>
            <div className="space-y-2">
              {FONT_PRESETS.map((font) => {
                const active = settings.fontFamily === font.value;
                return (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => setFontFamily(font.value)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                        : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span className="text-sm text-[var(--ink)]">{font.label}</span>
                    {active && <Check className="h-4 w-4 text-[var(--primary)]" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
