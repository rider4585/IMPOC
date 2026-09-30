import React, { useMemo } from 'react';

/**
 * TagFilterChips — multi-select transaction-tag filter, rendered as toggleable
 * chips (R-73). Used by the Sales list and the Dashboard "By tag" tab so both
 * read the same way.
 *
 * The chip visual language is copied from StockForm's size-run chips so the app
 * has one chip idiom, and the multi-select is deliberately a plain button group
 * (no new component library, no cmdk popover): tags are few, short and known up
 * front, so a search box would be noise.
 *
 * Props:
 * - tags:     [{ uuid, name }] — the selectable options
 * - selected: string[] — selected uuids (OR semantics: any match)
 * - onChange: (nextUuid[]) => void
 * - label:    text shown before the chips
 * - testId:   data-testid on the wrapper
 *
 * Renders nothing when there are no options, so callers can drop it in
 * unconditionally. Selection state is fully controlled by the parent.
 */
export function TagFilterChips({ tags = [], selected = [], onChange, label = 'Tags', testId = 'tag-filter' }) {
  const active = useMemo(() => new Set(selected), [selected]);

  if (!Array.isArray(tags) || tags.length === 0) return null;

  const toggle = (uuid) => {
    if (typeof onChange !== 'function') return;
    onChange(active.has(uuid) ? selected.filter((u) => u !== uuid) : [...selected, uuid]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testId}>
      <span className="typography-body-sm text-[var(--ink-muted)]">{label}:</span>
      {tags.map((tag) => (
        <button
          key={tag.uuid}
          type="button"
          aria-pressed={active.has(tag.uuid)}
          className={
            'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ' +
            (active.has(tag.uuid)
              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]'
              : 'border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--ink)] hover:bg-[var(--surface-sunken)]')
          }
          onClick={() => toggle(tag.uuid)}
        >
          {tag.name}
        </button>
      ))}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange && onChange([])}
          className="rounded-full border border-[var(--border)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export default TagFilterChips;
