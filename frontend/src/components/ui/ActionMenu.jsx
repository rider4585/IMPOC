import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  isValidElement,
} from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import Button from './Button.jsx';

/**
 * ActionMenu — Standard action column pattern for DataGrid / tables.
 *
 * Rules (System-wide):
 * 1. Exactly 1 action: Renders as a standalone Button (no dropdown/menu).
 * 2. 2+ actions: Renders the primary action as a standalone Button, and groups
 *    all remaining actions in a small overflow popover menu (trigger button '⋯').
 *
 * Props:
 * - primary: Object or ReactNode
 *     {
 *       label: string,
 *       onClick?: (e) => void,
 *       variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'danger',
 *       size?: 'sm' | 'md' | 'lg' | 'icon',
 *       disabled?: boolean,
 *       danger?: boolean,
 *       icon?: ReactNode,
 *       className?: string,
 *       dataTestid?: string,
 *     }
 * - items: Array<{
 *     label: string,
 *     onClick?: (e) => void,
 *     disabled?: boolean,
 *     danger?: boolean,
 *     icon?: ReactNode,
 *     divider?: boolean,
 *     className?: string,
 *     dataTestid?: string,
 *   }>
 * - triggerLabel?: string (default: 'More actions')
 * - triggerVariant?: 'default' | 'secondary' | 'outline' | 'ghost' (default: 'outline')
 * - triggerClassName?: string
 * - size?: 'sm' | 'md' (default: 'sm')
 * - align?: 'start' | 'end' (default: 'end')
 * - standalone?: boolean (default: true; if false, keeps all items in menu without promoting one)
 * - className?: string
 * - dataTestid?: string
 */
export function ActionMenu({
  primary,
  items = [],
  triggerLabel = 'More actions',
  triggerVariant = 'outline',
  triggerClassName = '',
  size = 'sm',
  align = 'end',
  standalone = true,
  className = '',
  dataTestid,
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const menuId = useId();

  // Filter out any falsey items (conditional actions)
  const validItems = (items || []).filter(Boolean);

  // Normalize primary action and overflow menu items based on 1 vs 2+ actions rule
  let resolvedPrimary = primary;
  let menuItems = validItems;

  if (!resolvedPrimary && standalone && validItems.length > 0) {
    if (validItems.length === 1) {
      resolvedPrimary = validItems[0];
      menuItems = [];
    } else {
      resolvedPrimary = validItems[0];
      menuItems = validItems.slice(1);
    }
  }

  const hasPrimary = Boolean(resolvedPrimary);
  const hasMenu = menuItems.length > 0;

  // Position calculation
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuEl = popoverRef.current;
    const menuWidth = menuEl?.offsetWidth || 150;
    const menuHeight = menuEl?.offsetHeight || Math.max(40, menuItems.length * 36 + 12);

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

    // Vertical placement (prefer below; flip above if not enough space)
    let top = rect.bottom + 4;
    if (top + menuHeight > viewportHeight - 8 && rect.top - menuHeight - 4 > 8) {
      top = Math.max(8, rect.top - menuHeight - 4);
    }

    // Horizontal placement (default align='end' right-aligns with trigger)
    let left;
    if (align === 'start') {
      left = rect.left;
      if (left + menuWidth > viewportWidth - 8) {
        left = Math.max(8, viewportWidth - menuWidth - 8);
      }
    } else {
      left = rect.right - menuWidth;
      if (left < 8) {
        left = Math.max(8, rect.left);
      }
    }

    setCoords({ top: Math.round(top), left: Math.round(left) });
  }, [align, menuItems.length]);

  // Handle open/close and positioning listeners
  useEffect(() => {
    if (!open) {
      setFocusedIndex(-1);
      return undefined;
    }

    updatePosition();

    const handlePointerDown = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        popoverRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const onScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  // Re-measure when menu mounts
  useEffect(() => {
    if (open && popoverRef.current) {
      updatePosition();
    }
  }, [open, updatePosition]);

  const toggleOpen = (e) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  const handleItemClick = (item, e) => {
    e.stopPropagation();
    if (item.disabled) return;
    setOpen(false);
    item.onClick?.(e);
  };

  const handleMenuKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = prev + 1 >= menuItems.length ? 0 : prev + 1;
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = prev <= 0 ? menuItems.length - 1 : prev - 1;
        return next;
      });
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  // If there are zero actions, render nothing
  if (!hasPrimary && !hasMenu) {
    return null;
  }

  // Render primary action button
  const renderPrimaryButton = () => {
    if (!resolvedPrimary) return null;

    if (isValidElement(resolvedPrimary)) {
      return resolvedPrimary;
    }

    const {
      label,
      onClick,
      variant = 'outline',
      size: btnSize = size,
      disabled = false,
      danger = false,
      icon,
      className: btnClass = '',
      dataTestid: btnTestId,
    } = resolvedPrimary;

    const computedVariant = danger ? 'danger' : variant;

    return (
      <Button
        variant={computedVariant}
        size={btnSize}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        className={btnClass}
        data-testid={btnTestId || (dataTestid ? `${dataTestid}-primary` : undefined)}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {label}
      </Button>
    );
  };

  return (
    <div
      className={['inline-flex items-center gap-1.5 whitespace-nowrap', className]
        .filter(Boolean)
        .join(' ')}
      data-testid={dataTestid}
    >
      {renderPrimaryButton()}

      {hasMenu && (
        <>
          <Button
            ref={triggerRef}
            type="button"
            variant={triggerVariant}
            size={size}
            onClick={toggleOpen}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-label={triggerLabel}
            className={['px-2 shrink-0', triggerClassName].filter(Boolean).join(' ')}
            data-testid={dataTestid ? `${dataTestid}-trigger` : 'action-menu-trigger'}
          >
            <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Button>

          {open &&
            coords &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                ref={popoverRef}
                id={menuId}
                role="menu"
                aria-orientation="vertical"
                tabIndex={-1}
                className="fixed z-60 min-w-[140px] max-w-[220px] overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] py-1 shadow-lg focus:outline-none"
                style={{
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                }}
                onKeyDown={handleMenuKeyDown}
              >
                {menuItems.map((item, index) => {
                  const isFocused = focusedIndex === index;
                  const itemCls = [
                    'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors cursor-pointer select-none outline-none disabled:opacity-40 disabled:pointer-events-none',
                    item.danger
                      ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10'
                      : 'text-[var(--ink)] hover:bg-[var(--surface-sunken)] focus:bg-[var(--surface-sunken)]',
                    isFocused && (item.danger ? 'bg-red-500/10' : 'bg-[var(--surface-sunken)]'),
                    item.className,
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <React.Fragment key={item.label || index}>
                      {item.divider && (
                        <div
                          role="separator"
                          className="my-1 border-t border-[var(--border)]"
                        />
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        disabled={item.disabled}
                        onClick={(e) => handleItemClick(item, e)}
                        className={itemCls}
                        data-testid={
                          item.dataTestid ||
                          (dataTestid ? `${dataTestid}-item-${index}` : undefined)
                        }
                      >
                        {item.icon && <span className="shrink-0">{item.icon}</span>}
                        <span className="truncate">{item.label}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>,
              document.body
            )}
        </>
      )}
    </div>
  );
}

export default ActionMenu;
