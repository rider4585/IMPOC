import React from 'react';
import './Button.css';

/**
 * Button — base UI primitive (light mode).
 *
 * Variants: primary | secondary | outline | ghost | danger
 * Sizes:    sm | md | lg
 * Supports a `loading` state that disables the button and renders a spinner.
 */
export const Button = React.forwardRef(function Button(
  {
    variant = 'primary',
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
  return (
    <button
      ref={ref}
      type={type}
      className={[
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        className,
      ].filter(Boolean).join(' ')}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="ui-button__spinner" aria-hidden="true" />}
      <span className="ui-button__label">{children}</span>
    </button>
  );
});

export default Button;
