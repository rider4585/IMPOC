import React from 'react';
import './Card.css';

/**
 * Card — base container primitive (light mode).
 * Composes CardHeader / CardTitle / CardContent / CardFooter.
 */
export const Card = React.forwardRef(function Card({ className = '', children, ...rest }, ref) {
  return (
    <div ref={ref} className={`ui-card ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
});

export const CardHeader = React.forwardRef(function CardHeader(
  { className = '', children, ...rest },
  ref
) {
  return (
    <div ref={ref} className={`ui-card__header ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
});

export const CardTitle = React.forwardRef(function CardTitle(
  { className = '', children, ...rest },
  ref
) {
  return (
    <h3 ref={ref} className={`ui-card__title ${className}`.trim()} {...rest}>
      {children}
    </h3>
  );
});

export const CardContent = React.forwardRef(function CardContent(
  { className = '', children, ...rest },
  ref
) {
  return (
    <div ref={ref} className={`ui-card__content ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
});

export const CardFooter = React.forwardRef(function CardFooter(
  { className = '', children, ...rest },
  ref
) {
  return (
    <div ref={ref} className={`ui-card__footer ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
});

export default Card;
