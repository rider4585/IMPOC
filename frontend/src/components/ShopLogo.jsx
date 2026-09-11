import React, { useState } from 'react';

/**
 * SHOP_NAME — single source of truth for the brand shown alongside the logo.
 */
export const SHOP_NAME = 'Shree Fashion Store';

/**
 * ShopLogo — reusable brand lockup (logo mark + full shop name).
 *
 * The logo image is loaded from a user-supplied file. Until one is dropped in,
 * `logoUrl` falls back to a clean inline monogram mark so the layout renders
 * with a proper brand every time. Drop your file at `frontend/public/shop-logo.png`
 * (or pass a `logoUrl` prop) to swap in the real logo.
 *
 * Props:
 * - logoUrl: string (default '/shop-logo.png')
 * - size: number | {logo?: number, text?: string} — control logo px + text class
 * - align: 'start' | 'center'
 * - className: extra classes
 */
export function ShopLogo({
  logoUrl = '/shop-logo.png',
  size = 'md',
  align = 'start',
  className = '',
}) {
  const [failed, setFailed] = useState(false);

  const logoSize = typeof size === 'object' ? size.logo : { sm: 32, md: 40, lg: 56 }[size] || 40;
  const textCls =
    typeof size === 'object'
      ? size.text
      : { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }[size] || 'text-lg';

  const alignCls = align === 'center' ? 'items-center justify-center text-center' : 'items-center';

  return (
    <div className={`flex ${alignCls} gap-2.5 ${className}`.trim()}>
      {failed ? (
        <span
          className="flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
          style={{ width: logoSize, height: logoSize, fontSize: logoSize * 0.42 }}
          aria-hidden="true"
        >
          S
        </span>
      ) : (
        <img
          src={logoUrl}
          alt=""
          width={logoSize}
          height={logoSize}
          className="shrink-0 object-contain"
          style={{ width: logoSize, height: logoSize }}
          onError={() => setFailed(true)}
        />
      )}
      <span className={`font-semibold tracking-tight text-[var(--ink)] ${textCls}`.trim()}>
        {SHOP_NAME}
      </span>
    </div>
  );
}

export default ShopLogo;
