import React from 'react';

/**
 * Button — shadcn-style base UI primitive (light mode, Tailwind).
 *
 * Variants: default | secondary | outline | ghost | danger | link
 * Sizes:    sm | md | lg | icon
 * Supports a `loading` state that disables the button and renders a spinner.
 */
const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md ' +
  'text-sm font-semibold transition-colors focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-55';

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] shadow-sm',
  secondary: 'bg-[var(--surface-sunken)] text-[var(--ink)] hover:bg-[var(--border-strong)]',
  outline:
    'border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--ink)] ' +
    'hover:bg-[var(--surface-sunken)]',
  ghost: 'text-[var(--ink)] hover:bg-[var(--surface-sunken)]',
  danger: 'bg-danger text-white hover:brightness-95',
  link: 'text-primary underline-offset-4 hover:underline',
};

const sizes = {
  sm: 'h-11 px-3 text-xs',
  md: 'h-11 px-4 py-2',
  lg: 'h-12 px-6',
  icon: 'h-11 w-11',
};

export const Button = React.forwardRef(function Button(
  {
    variant = 'default',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    className = '',
    children,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  const cls = [base, variants[variant] || variants.default, sizes[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
});

export default Button;
