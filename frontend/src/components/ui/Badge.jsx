import React from 'react';

/**
 * Badge — shadcn-style base status/tag primitive (light mode, Tailwind).
 * Variants: neutral | success | danger | warning | info | brand
 */
const base =
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors';

const variants = {
  neutral: 'border-transparent bg-[var(--surface-sunken)] text-[var(--ink-muted)]',
  success: 'border-transparent bg-[var(--status-in-stock)]/15 text-[var(--status-in-stock)]',
  danger: 'border-transparent bg-[var(--danger)]/15 text-[var(--danger)]',
  warning: 'border-transparent bg-[var(--waking)]/15 text-[var(--waking)]',
  info: 'border-transparent bg-[var(--status-rented)]/15 text-[var(--status-rented)]',
  brand: 'border-transparent bg-[var(--money-held)]/15 text-[var(--money-held)]',
};

export const Badge = React.forwardRef(function Badge(
  { variant = 'neutral', className = '', children, ...rest },
  ref
) {
  return (
    <span
      ref={ref}
      className={`${base} ${variants[variant] || variants.neutral} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
});

export default Badge;
