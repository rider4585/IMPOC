import React, { useRef, useState } from 'react';
import { X, Sun, Moon, Palette, Type, Check, Pipette, Store } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useBranding } from './BrandingProvider.jsx';
import { useAuth } from '../auth/useAuth.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { COLOR_SCHEMES, PRIMARY_PRESETS, FONT_PRESETS, CUSTOM_PRIMARY } from './theme-config';
import { resizeImageToDataUrl } from '../platform/imageResize.js';
import { useOptionalToast } from '../components/ui/Toast.jsx';

/** Logo upload target: small square-ish PNG, well under the server's 200 KB cap. */
const LOGO_RESIZE = { maxSide: 256, quality: 0.9, mimeType: 'image/png' };

/**
 * R-58: shop name + logo. Shared across devices (server-side); only holders of
 * branding.manage can edit, everyone else sees the current brand read-only.
 */
function ShopSection() {
  const branding = useBranding();
  const toast = useOptionalToast();
  const { permissions } = useAuth();
  const canEdit = Boolean(permissions && permissions.includes(PERMISSIONS.BRANDING.MANAGE));

  const [name, setName] = useState(branding.shopName);
  const [logo, setLogo] = useState(branding.logoDataUrl); // string | null (null = remove)
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const dirty = name.trim() !== branding.shopName || (logo || null) !== (branding.logoDataUrl || null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error({ title: 'Please choose an image file' });
      return;
    }
    try {
      setLogo(await resizeImageToDataUrl(file, LOGO_RESIZE));
    } catch (err) {
      toast.error({ title: 'Could not read the image', description: err?.message });
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error({ title: 'Shop name is required' });
      return;
    }
    setSaving(true);
    try {
      const payload = { shopName: trimmed };
      if ((logo || null) !== (branding.logoDataUrl || null)) payload.logoDataUrl = logo || null;
      await branding.update(payload);
      toast.success({ title: 'Shop details saved', description: 'Shown on every device and on receipts.' });
    } catch (err) {
      toast.error({ title: 'Could not save shop details', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const initial = (name.trim()[0] || 'S').toUpperCase();

  return (
    <section data-testid="shop-section">
      <SectionTitle icon={Store}>Shop</SectionTitle>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="Shop logo" className="h-12 w-12 rounded-md border border-[var(--border)] object-contain" data-testid="shop-logo-preview" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground" aria-hidden="true">
              {initial}
            </span>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-md border border-[var(--border-strong)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-sunken)]"
                data-testid="shop-logo-upload"
              >
                {logo ? 'Change logo' : 'Upload logo'}
              </button>
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]"
                  data-testid="shop-logo-remove"
                >
                  Remove
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="shop-logo-input" />
            </div>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Shop name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            disabled={!canEdit}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--ink)] disabled:opacity-70"
            data-testid="shop-name-input"
          />
        </label>
        {canEdit ? (
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            data-testid="shop-save"
          >
            {saving ? 'Saving…' : 'Save shop details'}
          </button>
        ) : (
          <p className="text-xs text-[var(--ink-faint)]">Only an admin can change the shop name and logo.</p>
        )}
        <p className="text-xs text-[var(--ink-faint)]">Used in the header, on the customer display, in UPI payment names and on receipts. Logo: square PNG works best (resized to 256 px).</p>
      </div>
    </section>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="typography-label mb-3 flex items-center gap-2 text-[var(--ink-muted)]">
      <Icon className="h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}

export function SettingsDrawer({ open, onClose }) {
  const { settings, resolvedColorScheme, setColorScheme, setPrimaryColor, setCustomPrimary, setFontFamily } = useTheme();
  const branding = useBranding();

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
              {/* R-58: custom accent via the native colour picker */}
              <label
                title="Custom colour"
                className={`relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[var(--border-strong)] transition-transform ${
                  settings.primaryColor === CUSTOM_PRIMARY
                    ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface-raised)]'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: settings.primaryColor === CUSTOM_PRIMARY ? settings.customPrimary : 'transparent' }}
                data-testid="custom-accent"
              >
                {settings.primaryColor === CUSTOM_PRIMARY ? (
                  <Check className="h-5 w-5 text-[var(--primary-foreground)]" />
                ) : (
                  <Pipette className="h-4 w-4 text-[var(--ink-muted)]" />
                )}
                <input
                  type="color"
                  aria-label="Custom accent colour"
                  value={settings.customPrimary}
                  onChange={(e) => setCustomPrimary(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  data-testid="custom-accent-input"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-[var(--ink-faint)]">
              {settings.primaryColor === CUSTOM_PRIMARY
                ? `Custom ${settings.customPrimary}`
                : (PRIMARY_PRESETS.find((p) => p.value === settings.primaryColor) || {}).label}
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

          {/* keyed on the shared brand so the form re-syncs when another device saves it */}
          <ShopSection key={`${branding.shopName}|${(branding.logoDataUrl || '').length}`} />
        </div>
      </aside>
    </>
  );
}
