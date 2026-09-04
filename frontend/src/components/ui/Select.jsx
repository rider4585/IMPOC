import React, { forwardRef } from 'react';

/**
 * Select â€” shadcn-style base dropdown primitive (light mode, Tailwind).
 * Children should be <option> elements.
 */
const selectCls =
  'flex h-9 w-full appearance-none rounded-md border border-[var(--border-strong)] ' +
  'bg-[var(--surface-raised)] px-3 py-1 text-sm text-[var(--ink)] shadow-sm transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ' +
  'focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-55';

export const Select = forwardRef(function Select(
  { label, error, hint, size = 'md', id, className = '', children, ...rest },
  ref
) {
  const selectId =
    id || rest.name || `ui-select-${Math.random().toString(36).slice(2, 9)}`;
  const describedBy =
    [error ? `${selectId}-error` : null, hint && !error ? `${selectId}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--ink)]" htmlFor={selectId}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={[
            selectCls,
            error ? 'border-danger focus-visible:ring-danger' : '',
            size === 'lg' ? 'h-11' : size === 'sm' ? 'h-8' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {error && (
        <p id={`${selectId}-error`} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${selectId}-hint`} className="text-xs text-[var(--ink-faint)]">
          {hint}
        </p>
      )}
    </div>
  );
});

export default Select;
