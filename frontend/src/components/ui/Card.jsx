import React from 'react';

/**
 * Card — shadcn-style base container primitive (light mode, Tailwind).
 * Composes CardHeader / CardTitle / CardContent / CardFooter.
 */
export const Card = React.forwardRef(function Card({ className = '', children, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--ink)] shadow-sm ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
});

export const CardHeader = React.forwardRef(function CardHeader(
  { className = '', children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={`flex flex-col space-y-1.5 p-6 ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
});

export const CardTitle = React.forwardRef(function CardTitle(
  { className = '', children, ...rest },
  ref
) {
  return (
    <h3
      ref={ref}
      className={`text-lg font-semibold leading-none tracking-tight ${className}`.trim()}
      {...rest}
    >
      {children}
    </h3>
  );
});

export const CardContent = React.forwardRef(function CardContent(
  { className = '', children, ...rest },
  ref
) {
  const hasCustomPadding = /(^|\s)p[a-z0-9_-]*/.test(className);
  const baseClasses = hasCustomPadding ? '' : 'p-6 pt-0';
  const finalClass = [baseClasses, className].filter(Boolean).join(' ').trim();
  return (
    <div ref={ref} className={finalClass} {...rest}>
      {children}
    </div>
  );
});

export const CardFooter = React.forwardRef(function CardFooter(
  { className = '', children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={`flex items-center p-6 pt-0 ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
});

export default Card;
