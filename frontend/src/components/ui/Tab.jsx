import React, { useRef } from 'react';

/**
 * Tabs / Tab — accessible tablist primitive (UX-H6, UX-M7).
 *
 * <Tabs aria-label="..." onKeyDown={...}> renders a `role="tablist"` with
 * arrow-key navigation (Left/Right moves focus between tabs). Each Tab renders
 * a `role="tab"` button with `aria-selected`, a ≥44px hit area and the shared
 * `focus-visible` ring so bare-tab screens stop bypassing the system focus style.
 */
const tabBase =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap ' +
  'rounded-[var(--rounded-md)] border px-4 py-2 text-[14px] font-semibold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ' +
  'focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55';

export function Tabs({ children, className = '', 'aria-label': ariaLabel, ...rest }) {
  const listRef = useRef(null);

  const handleKeyDown = (e) => {
    const buttons = Array.from(
      listRef.current?.querySelectorAll('[role="tab"]') || []
    );
    if (buttons.length === 0) return;
    const currentIndex = buttons.indexOf(document.activeElement);
    let nextIndex = -1;
    if (e.key === 'ArrowRight') {
      nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % buttons.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex =
        currentIndex === -1 ? buttons.length - 1 : (currentIndex - 1 + buttons.length) % buttons.length;
    }
    if (nextIndex === -1) return;
    e.preventDefault();
    buttons[nextIndex].focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`flex flex-wrap gap-2 ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Tab({ active, onClick, children, className = '', ...rest }) {
  const stateCls = active
    ? 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--primary)]'
    : 'border-transparent bg-transparent text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]';
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`${tabBase} ${stateCls} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Tab;