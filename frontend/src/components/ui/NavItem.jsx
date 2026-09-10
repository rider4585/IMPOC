import React from 'react';

/**
 * NavItem — accessible navigation button primitive (UX-H6).
 *
 * Carries the standard focus-visible ring, `aria-current="page"` for the
 * active destination and a ≥44px hit area. AppShell rail + bottom tab bar
 * render their buttons through here so keyboard and focus affordances stay
 * consistent with the shared primitives.
 */
const base =
  'inline-flex rounded-md font-medium transition-colors cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ' +
  'focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55';

export const NavItem = React.forwardRef(function NavItem(
  { active = false, className = '', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`${base} ${className}`.trim()}
      aria-current={active ? 'page' : undefined}
      {...rest}
    >
      {children}
    </button>
  );
});

export default NavItem;