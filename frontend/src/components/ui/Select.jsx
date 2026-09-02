import React, { forwardRef } from 'react';
import './Select.css';

/**
 * Select — base dropdown primitive (light mode).
 * Children should be <option> elements.
 */
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
    <div className={`ui-field ui-field--${size}`}>
      {label && (
        <label className="ui-field__label" htmlFor={selectId}>{label}</label>
      )}
      <div className="ui-select-wrap">
        <select
          ref={ref}
          id={selectId}
          className={[
            'ui-select',
            error ? 'ui-select--error' : '',
            className,
          ].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {children}
        </select>
      </div>
      {error && (
        <div id={`${selectId}-error`} className="ui-field__error" role="alert">{error}</div>
      )}
      {hint && !error && (
        <div id={`${selectId}-hint`} className="ui-field__hint">{hint}</div>
      )}
    </div>
  );
});

export default Select;
