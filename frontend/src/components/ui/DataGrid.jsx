import React, { useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';

export function DataGrid({
  data = [],
  columns = [],
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data.',
  loadingMessage = 'Loading...',
  onRowClick = null,
  className = '',
}) {
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const displayedRowModel = table.getRowModel();

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search all columns…"
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="flex h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-1 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-[var(--surface-sunken)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-[var(--border)]">
                  {headerGroup.headers.map((header) => (
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
                          {header.column.getCanFilter() && (
                            <input
                              type="text"
                              placeholder={`Filter…`}
                              value={header.column.getFilterValue() ?? ''}
                              onChange={(e) => header.column.setFilterValue(e.target.value)}
                              className="h-7 w-full rounded border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-xs text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                              onClick={(e) => e.stopPropagation()}
                            />
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
                  ))}
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
