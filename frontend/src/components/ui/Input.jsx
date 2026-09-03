import React, { forwardRef } from 'react';

/**
 * Input — shadcn-style base text field primitive (light mode, Tailwind).
 * Supports size variants and an optional `label`, `error`, and `hint`.
 */
const fieldCls =
  'flex h-9 w-full rounded-md border border-[var(--border-strong)] bg-white px-3 py-1 ' +
  'text-sm text-[var(--ink)] shadow-sm transition-colors ' +
  'placeholder:text-[var(--ink-faint)] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:border-transparent ' +
  'disabled:cursor-not-allowed disabled:opacity-55';

export const Input = forwardRef(function Input(
  { label, error, hint, size = 'md', id, className = '', ...rest },
  ref
) {
  const inputId = id || rest.name || `ui-input-${Math.random().toString(36).slice(2, 9)}`;
  const describedBy =
    [error ? `${inputId}-error` : null, hint && !error ? `${inputId}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--ink)]" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={[
          fieldCls,
          error
            ? 'border-danger focus-visible:ring-danger'
            : '',
          size === 'lg' ? 'h-11' : size === 'sm' ? 'h-8' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-[var(--ink-faint)]">
          {hint}
        </p>
      )}
    </div>
  );
});

export default Input;
