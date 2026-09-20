import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, RotateCw, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog.jsx';
import { qrLogoSettings } from '../platform/qrLogo.js';
import { useBranding } from '../theme/index.js';
import { getNetworkInfo } from '../services/systemApi.js';
import { useToast } from './ui/Toast.jsx';

function useSafeToast() {
  try {
    return useToast();
  } catch {
    return {
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
      push: () => {},
    };
  }
}

/**
 * NetworkAccessModal (Ticket R-67):
 * Modal providing shop staff with the dynamic Wi-Fi / LAN access URL and a
 * scannable QR code for connecting mobile phones and tablets to IMPOC.
 */
export function NetworkAccessModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [networkData, setNetworkData] = useState(null);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const branding = useBranding();
  const toast = useSafeToast();

  const loadNetworkInfo = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNetworkInfo();
      setNetworkData(data);
      const interfaces = data?.interfaces || [];
      const defaultIface = interfaces.find((i) => i.isDefault) || interfaces[0];
      const targetUrl = defaultIface?.url || data?.primaryUrl || '';
      setSelectedUrl(targetUrl);
    } catch (err) {
      console.error('Failed to load network info:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadNetworkInfo();
    }
  }, [open, loadNetworkInfo]);

  const handleCopyUrl = async () => {
    if (!selectedUrl) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selectedUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast?.success({ title: 'Link copied to clipboard!' });
    } catch (err) {
      console.error('Failed to copy URL to clipboard:', err);
    }
  };

  const interfaces = networkData?.interfaces || [];
  const currentUrl = selectedUrl || networkData?.primaryUrl || '';

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <DialogContent className="space-y-4">
        {/* Header with Wifi icon, Title, Subtitle, and Refresh button */}
        <DialogHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wifi className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-lg font-semibold text-[var(--ink)]">
                Wi-Fi &amp; LAN Access
              </DialogTitle>
              <p className="text-xs text-[var(--ink-muted)]">
                Connect mobile devices or tablets over Wi-Fi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadNetworkInfo}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
            title="Refresh network IP"
            aria-label="Refresh network IP"
          >
            <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </DialogHeader>

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready for connections</span>
          </div>
          {loading && (
            <span className="text-xs text-[var(--ink-muted)]">Updating…</span>
          )}
        </div>

        {/* Interface Selector (when multiple interfaces exist) */}
        {interfaces.length > 1 && (
          <div className="flex flex-col gap-1.5 text-left">
            <label
              htmlFor="network-interface-select"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]"
            >
              Network Interface
            </label>
            <select
              id="network-interface-select"
              data-testid="network-interface-select"
              aria-label="Select Network Interface"
              value={currentUrl}
              onChange={(e) => setSelectedUrl(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--ink)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {interfaces.map((iface) => (
                <option key={iface.address} value={iface.url}>
                  {iface.name} ({iface.address}) {iface.isDefault ? '— Recommended' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-4 shadow-inner">
          {currentUrl ? (
            <div className="rounded-md bg-white p-2.5 shadow-sm" data-testid="wifi-qr-container">
              <QRCodeSVG
                value={currentUrl}
                size={180}
                level="H"
                imageSettings={qrLogoSettings(180, branding?.logoDataUrl)}
                data-testid="wifi-qr-code"
              />
            </div>
          ) : (
            <div className="flex h-[180px] w-[180px] items-center justify-center text-sm text-[var(--ink-muted)]">
              {loading ? 'Detecting network…' : 'No network URL available'}
            </div>
          )}
        </div>

        {/* Clean Monospace URL display box + 1-click Copy button */}
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] p-1.5 pl-3">
          <code
            className="flex-1 truncate font-mono text-xs font-semibold text-[var(--ink)] select-all"
            data-testid="network-url-display"
          >
            {currentUrl || 'Detecting network address…'}
          </code>
          <button
            type="button"
            onClick={handleCopyUrl}
            disabled={!currentUrl}
            className="inline-flex h-8 items-center gap-1.5 rounded bg-[var(--surface-raised)] px-3 text-xs font-medium text-[var(--ink)] shadow-sm border border-[var(--border)] transition-colors hover:bg-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
            data-testid="copy-url-btn"
            aria-label="Copy URL"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                <span>Copy URL</span>
              </>
            )}
          </button>
        </div>

        {/* Quick 3-step Instructions */}
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-left">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            How to connect:
          </h4>
          <ol className="space-y-1.5 text-xs text-[var(--ink-muted)]">
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                1
              </span>
              <span>Connect your phone or tablet to the same Wi-Fi network.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                2
              </span>
              <span>Scan the QR code with your camera (or open the link in your mobile browser).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                3
              </span>
              <span>Sign in to IMPOC.</span>
            </li>
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NetworkAccessModal;
