import React from 'react';
import './Badge.css';

/**
 * Badge — base status/tag primitive (light mode).
 * Variants: neutral | success | danger | warning | info | brand
 */
export const Badge = React.forwardRef(function Badge(
  { variant = 'neutral', className = '', children, ...rest },
  ref
) {
  return (
    <span
      ref={ref}
      className={`ui-badge ui-badge--${variant} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
});

export default Badge;
