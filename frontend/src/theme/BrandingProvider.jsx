import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getBranding, saveBranding } from '../services/brandingApi.js';

/**
 * BrandingProvider (R-58) — the shop name + logo, shared across every device
 * (stored server-side; GET is public so the sign-in page and the customer
 * display can show the brand before login). The last known value is cached
 * in localStorage so the first paint already shows the right name.
 */
/** Fallback shop name (single source of truth; ShopLogo re-exports it as SHOP_NAME). */
export const DEFAULT_SHOP_NAME = 'Shree Fashion Store';
const SHOP_NAME = DEFAULT_SHOP_NAME;
const BRANDING_CACHE_KEY = 'impoc-branding';
const DEFAULT_BRANDING = Object.freeze({ shopName: SHOP_NAME, logoDataUrl: null });

const BrandingContext = createContext(null);

function loadCached() {
  try {
    const raw = window.localStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) return { ...DEFAULT_BRANDING };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BRANDING, ...parsed };
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

function cache(branding) {
  try {
    window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding));
  } catch {
    /* storage unavailable */
  }
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(loadCached);

  useEffect(() => {
    let cancelled = false;
    getBranding()
      .then((data) => {
        if (cancelled) return;
        const next = { shopName: data.shopName || SHOP_NAME, logoDataUrl: data.logoDataUrl || null };
        setBranding(next);
        cache(next);
      })
      .catch(() => {
        /* offline / backend down: keep the cached brand */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (payload) => {
    const data = await saveBranding(payload);
    const next = { shopName: data.shopName || SHOP_NAME, logoDataUrl: data.logoDataUrl || null };
    setBranding(next);
    cache(next);
    return next;
  }, []);

  const value = useMemo(() => ({ ...branding, update }), [branding, update]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

/** Safe outside the provider (tests, isolated renders): falls back to the defaults. */
export function useBranding() {
  const ctx = useContext(BrandingContext);
  return ctx || { ...DEFAULT_BRANDING, update: async () => DEFAULT_BRANDING };
}
