import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Dialog,
  Badge,
  DataGrid,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { listSales } from '../../services/salesApi.js';
import { formatPaise } from '../../platform/money.js';
import { TagFilterChips } from '../../components/TagFilterChips.jsx';
import { SaleReceipt } from './SaleReceipt.jsx';

/**
 * Union the tag badges seen across every loaded page, keyed by uuid, insertion
 * order preserved. Deliberately only ever GROWS: the first load is unfiltered,
 * so it seeds every tag the shop actually uses, and later filtered loads cannot
 * shrink the option list out from under a chosen chip.
 */
function mergeTagOptions(previous, rows) {
  const next = [...previous];
  const seen = new Set(previous.map((t) => t.uuid));
  for (const row of rows) {
    for (const tag of row?.tags || []) {
      if (!tag?.uuid || seen.has(tag.uuid)) continue;
      seen.add(tag.uuid);
      next.push({ uuid: tag.uuid, name: tag.name });
    }
  }
  return next;
}

export function SalesListScreen() {
  const { permissions } = useAuth();
  const canView = permissions && permissions.includes(PERMISSIONS.SALES.VIEW);

  const [sales, setSales] = useState([]);
  const [tagFilter, setTagFilter] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewSale, setViewSale] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // R-73: the tag filter is the one filter that runs on the server, because
      // the grid only ever holds the rows the API returned. OR semantics.
      const data = await listSales({ tagUuids: tagFilter });
      const rows = Array.isArray(data) ? data : (data?.items ?? []);
      setSales(rows);
      setTagOptions((previous) => mergeTagOptions(previous, rows));
    } catch (err) {
      setError(err.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [tagFilter]);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  const columns = useMemo(() => [
    {
      accessorKey: 'saleNumber',
      header: 'Sale #',
      size: 140,
      filter: { type: 'text' },
      cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
    },
    {
      accessorKey: 'soldAt',
      header: 'Date',
      size: 130,
      filter: { type: 'date' },
      cell: (info) => {
        const s = info.row.original;
        return new Date(s.soldAt || s.createdAt).toLocaleDateString();
      },
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      size: 180,
      filter: { type: 'text' },
      cell: (info) => info.getValue() || 'Walk-in',
    },
    {
      id: 'tags',
      header: 'Tags',
      size: 200,
      enableSorting: false,
      cell: (info) => {
        const tags = info.row.original.tags || [];
        if (tags.length === 0) {
          return <span className="text-[var(--ink-muted)]">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag.uuid} variant="brand">{tag.name}</Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: 'lines',
      header: 'Lines',
      size: 90,
      enableSorting: false,
      cell: (info) => info.row.original.lines?.length ?? 0,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 130,
      filter: { type: 'picklist' },
      cell: (info) => (
        <Badge variant={info.getValue() === 'completed' ? 'success' : 'neutral'}>
          {info.getValue()}
        </Badge>
      ),
    },
    {
      accessorKey: 'totalPaise',
      header: 'Total (₹)',
      size: 130,
      filter: { type: 'number' },
      cell: (info) => (
        <strong className="typography-money-sm text-[var(--ink)]">
          {formatPaise(Number(info.getValue()))}
        </strong>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 110,
      enableSorting: false,
      cell: (info) => (
        <div className="text-right">
          <Button variant="outline" size="sm" onClick={() => setViewSale(info.row.original)}>
            View
          </Button>
        </div>
      ),
    },
  ], []);

  if (!canView) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view sales.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full md:h-full min-h-0 w-full max-w-[1100px] flex-col gap-5 p-6 max-md:overflow-visible md:overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Sales</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Review completed sales and their receipts. A sale can carry several
            tags (an exhibition name, for example) to group and compare takings.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)] max-md:min-h-[360px] max-md:min-h-[45vh]">
        {tagOptions.length > 0 && (
          <div className="border-b border-[var(--border)] px-4 py-2.5">
            <TagFilterChips
              tags={tagOptions}
              selected={tagFilter}
              onChange={setTagFilter}
              label="Filter by tag"
              testId="sales-tag-filter"
            />
          </div>
        )}
        <DataGrid
          data={sales}
          columns={columns}
          isLoading={loading}
          isEmpty={sales.length === 0}
          emptyMessage={tagFilter.length > 0 ? 'No sales carry the selected tags.' : 'No sales yet.'}
          loadingMessage="Loading sales…"
          className="flex-1"
        />
      </div>

      <Dialog
        open={Boolean(viewSale)}
        onClose={() => setViewSale(null)}
        title="Sale receipt"
        footer={
          <Button variant="outline" onClick={() => setViewSale(null)}>
            Close
          </Button>
        }
      >
        {viewSale && <SaleReceipt sale={viewSale} />}
      </Dialog>
    </div>
  );
}

export default SalesListScreen;
