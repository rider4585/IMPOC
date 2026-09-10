/**
 * DataGrid — a filterable, sortable table wrapper around @tanstack/react-table.
 *
 * ## How to add a grid
 *
 * 1. Define columns in a `useMemo`:
 *    ```jsx
 *    const columns = useMemo(() => [
 *      {
 *        accessorKey: 'name',      // data key
 *        header: 'Name',           // column title
 *        size: 200,                // width in px
 *        cell: (info) => <span>{info.getValue()}</span>,  // optional custom renderer
 *        filter: { type: 'text' }, // optional filter: 'text' | 'number' | 'date' | 'picklist'
 *      },
 *      // ... more columns
 *    ], []);
 *    ```
 *
 * 2. Render the grid:
 *    ```jsx
 *    <DataGrid
 *      data={rows}
 *      columns={columns}
 *      isLoading={loading}
 *      isEmpty={rows.length === 0}
 *      emptyMessage="No rows."
 *      getRowTestId={() => 'my-row'}
 *    />
 *    ```
 *
 * ## Filter types
 *
 * - `{ type: 'text' }` — substring match input
 * - `{ type: 'number' }` — numeric input (greater-than comparison)
 * - `{ type: 'date' }` — date input (ISO format)
 * - `{ type: 'picklist', options: [{value, label}, ...] }` — select dropdown
 *   - If options are omitted, DataGrid derives them from the column's distinct row values
 *
 * ## GENERIC RULE
 *
 * Any column that contains an enum, status, role, or category value MUST use:
 *   filter: { type: 'picklist' }
 *
 * NOT using a picklist filter on such a column means no filter is shown (a silent bug).
 * See UnitsScreen.jsx (status column) or TripsScreen.jsx (examples of correct usage).
 */

import React, { useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';

// Filter registry: map filterType -> { renderControl, filterFn }
// To add a new filter type, add an entry here and export it if needed by external code.
const FILTER_REGISTRY = {
  text: {
    renderControl: (value, onChange) => (
      <input
        type="text"
        placeholder="Filter…"
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-7 w-full rounded border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-xs text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
        onClick={(e) => e.stopPropagation()}
      />
    ),
  },
  number: {
    renderControl: (value, onChange) => (
      <input
        type="number"
        placeholder="Filter…"
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-7 w-full rounded border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-xs text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
        onClick={(e) => e.stopPropagation()}
      />
    ),
  },
  date: {
    renderControl: (value, onChange) => (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-7 w-full rounded border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-xs text-[var(--ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
        onClick={(e) => e.stopPropagation()}
      />
    ),
  },
  picklist: {
    renderControl: (value, onChange, options) => (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-7 w-full rounded border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-xs text-[var(--ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">All</option>
        {(options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    ),
  },
};

function derivePicklistOptions(data, accessorKey) {
  if (!Array.isArray(data) || !accessorKey) return [];
  const values = new Set();
  data.forEach((row) => {
    const value = row[accessorKey];
    if (value != null) values.add(value);
  });
  return Array.from(values)
    .sort()
    .map((v) => ({ value: String(v), label: String(v) }));
}

function renderFilterControl(header, filterType, filterOptions, data, accessorKey) {
  const value = header.column.getFilterValue() ?? '';
  const registry = FILTER_REGISTRY[filterType];

  if (!registry) {
    // Default to text if type not in registry
    return FILTER_REGISTRY.text.renderControl(value, (v) => header.column.setFilterValue(v));
  }

  // Auto-derive picklist options if not provided
  let options = filterOptions;
  if (filterType === 'picklist' && (!options || options.length === 0)) {
    options = derivePicklistOptions(data, accessorKey);
  }

  return registry.renderControl(value, (v) => header.column.setFilterValue(v), options);
}

export function DataGrid({
  data = [],
  columns = [],
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data.',
  loadingMessage = 'Loading...',
  onRowClick = null,
  className = '',
  getRowTestId = null,
}) {
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const displayedRowModel = table.getRowModel();

  return (
    <div className={`flex flex-col gap-3 ${className}`}>

      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-[var(--surface-sunken)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-[var(--border)]">
                  {headerGroup.headers.map((header) => {
                    const filterDef = header.column.columnDef.filter;
                    const hasFilter = header.column.getCanFilter() && filterDef;
                    return (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-semibold text-[var(--ink)] "
                        style={{ width: header.getSize() }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex flex-1 flex-col gap-1">
                            <div
                              onClick={header.column.getToggleSortingHandler()}
                              className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                              title={header.column.getCanSort() ? 'Click to sort' : ''}
                            >
                              <div className="flex items-center gap-1.5">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getCanSort() && (
                                  <span className="inline-block text-[var(--ink-faint)]">
                                    {header.column.getIsSorted() === 'asc' ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : header.column.getIsSorted() === 'desc' ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                            {hasFilter && (
                              renderFilterControl(
                                header,
                                filterDef.type,
                                filterDef.options,
                                data,
                                header.column.columnDef.accessorKey
                              )
                            )}
                          </div>
                          {header.column.getFilterValue() && (
                            <button
                              onClick={() => header.column.setFilterValue(undefined)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--ink-faint)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
                              title="Clear filter"
                              aria-label="Clear filter"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="bg-[var(--surface-raised)]">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-[var(--ink-faint)]">
                    {loadingMessage}
                  </td>
                </tr>
              ) : isEmpty || displayedRowModel.rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-[var(--ink-faint)]">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                displayedRowModel.rows.map((row) => (
                  <tr
                    key={row.id}
                    data-testid={getRowTestId?.(row.original)}
                    className={`border-b border-[var(--border)] ${onRowClick ? 'cursor-pointer hover:bg-[var(--surface-sunken)]' : ''}`}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3" style={{ width: cell.column.getSize() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DataGrid;
