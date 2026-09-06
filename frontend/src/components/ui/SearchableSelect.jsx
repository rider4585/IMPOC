import React, { forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from 'cmdk';

/**
 * SearchableSelect — shadcn-style searchable combobox built on cmdk (light mode, Tailwind).
 *
 * Renders a trigger button styled like the base ui/Select; clicking it opens a
 * popover with a search input and a filterable list. Supports an inline
 * "+ Create <query>" row when `creatable` and the query matches nothing.
 *
 * Props:
 * - value / onChange: the selected option value (or undefined)
 * - options: [{ value, label, description?, keywords? }]
 * - creatable / createLabel(query) / onCreate(query): inline create row
 * - placeholder, searchPlaceholder, emptyMessage
 */
const triggerCls =
  'flex h-9 w-full items-center justify-between gap-2 rounded-md border ' +
  'border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-1 text-sm ' +
  'text-[var(--ink)] shadow-sm transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ' +
  'focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-55';

const inputCls =
  'h-9 w-full border-0 bg-transparent px-0 text-sm text-[var(--ink)] ' +
  'placeholder:text-[var(--ink-faint)] focus-visible:outline-none focus-visible:ring-0';

const itemCls =
  'flex cursor-default select-none flex-col gap-0.5 rounded-md px-2.5 py-2 text-sm ' +
  'text-[var(--ink)] outline-none data-[selected=true]:bg-[var(--surface-sunken)] ' +
  'data-[selected=true]:text-[var(--ink)]';

export const SearchableSelect = forwardRef(function SearchableSelect(
  {
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyMessage = 'No options.',
    creatable = false,
    createLabel,
    onCreate,
    disabled = false,
    dataTestid,
    className = '',
  },
  ref
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerId = useId();

  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && rootRef.current && rootRef.current.contains(e.target)) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, close]);

  const q = query.trim();
  const showCreate = creatable && q.length > 0;

  return (
    <div ref={rootRef} className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={triggerId} className="text-sm font-medium text-[var(--ink)]">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          ref={ref}
          id={triggerId}
          type="button"
          disabled={disabled}
          data-testid={dataTestid}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={triggerCls}
          onClick={() => {
            if (disabled) return;
            if (open) close();
            else setOpen(true);
          }}
        >
          <span className={selected ? 'truncate font-medium' : 'truncate text-[var(--ink-faint)]'}>
            {selected ? selected.label : placeholder || 'Select…'}
          </span>
          <svg
            aria-hidden="true"
            className={`pointer-events-none h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1">
            <Command label={label} className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)] shadow-lg">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-2.5">
              <svg
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-[var(--ink-muted)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <CommandInput
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={searchPlaceholder}
                aria-label={label || 'Search'}
                className={inputCls}
              />
            </div>
            <CommandList className="max-h-60 overflow-y-auto p-1">
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  keywords={o.keywords || (o.description ? [o.description] : undefined)}
                  onSelect={() => {
                    onChange(o.value);
                    close();
                  }}
                  className={itemCls}
                >
                  <span className="font-medium">{o.label}</span>
                  {o.description && (
                    <span className="text-xs text-[var(--ink-muted)]">{o.description}</span>
                  )}
                </CommandItem>
              ))}
              <CommandEmpty>
                {showCreate ? (
                  <button
                    type="button"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (onCreate) onCreate(q);
                      close();
                    }}
                    className={`w-full text-left ${itemCls}`}
                  >
                    <span className="font-medium text-[var(--primary)]">
                      {createLabel ? createLabel(q) : `+ Create "${q}"`}
                    </span>
                  </button>
                ) : (
                  <div className="px-2.5 py-6 text-center text-sm text-[var(--ink-muted)]">
                    {emptyMessage}
                  </div>
                )}
              </CommandEmpty>
            </CommandList>
          </Command>
        </div>
      )}
      </div>
    </div>
  );
});

export default SearchableSelect;