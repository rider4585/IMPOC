import React, { forwardRef } from 'react';
import './Input.css';

/**
 * Input — base text field primitive (light mode).
 * Supports size variants and an optional `label`, `error`, and `hint`.
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    size = 'md',
    id,
    className = '',
    ...rest
  },
  ref
) {
  const inputId = id || rest.name || `ui-input-${Math.random().toString(36).slice(2, 9)}`;
  const describedBy = [error ? `${inputId}-error` : null, hint && !error ? `${inputId}-hint` : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={`ui-field ui-field--${size}`}>
      {label && <label className="ui-field__label" htmlFor={inputId}>{label}</label>}
      <input
        ref={ref}
        id={inputId}
        className={[
          'ui-input',
          error ? 'ui-input--error' : '',
          className,
        ].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error && (
        <div id={`${inputId}-error`} className="ui-field__error" role="alert">{error}</div>
      )}
      {hint && !error && (
        <div id={`${inputId}-hint`} className="ui-field__hint">{hint}</div>
      )}
    </div>
  );
});

export default Input;
