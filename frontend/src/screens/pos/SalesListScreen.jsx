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
import { SaleReceipt } from './SaleReceipt.jsx';

export function SalesListScreen() {
  const { permissions } = useAuth();
  const canView = permissions && permissions.includes(PERMISSIONS.SALES.VIEW);

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewSale, setViewSale] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listSales();
      setSales(Array.isArray(data) ? data : (data?.items ?? []));
    } catch (err) {
      setError(err.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, []);

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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px] flex-col gap-5 p-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Sales</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Review completed sales and their receipts.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
        <DataGrid
          data={sales}
          columns={columns}
          isLoading={loading}
          isEmpty={sales.length === 0}
          emptyMessage="No sales yet."
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
