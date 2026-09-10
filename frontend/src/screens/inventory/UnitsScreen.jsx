import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Button,
  Input,
  SearchableSelect,
} from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { listAllUnits } from '../../services/unitsApi.js';
import { listAllStocks } from '../../services/tripsApi.js';
import { getProductTypes } from '../../services/picklistsApi.js';
import { formatPaise } from '../../platform/money.js';

const SEARCH_DEBOUNCE_MS = 300;

const UNIT_STATUSES = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'sold', label: 'Sold' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' },
  { value: 'in_maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
  { value: 'rented', label: 'Rented' },
];

const STATUS_META = {
  in_stock: { label: 'In stock', cls: 'bg-[var(--status-in-stock)]/15 text-[var(--status-in-stock)]' },
  sold: { label: 'Sold', cls: 'bg-[var(--status-sold)]/15 text-[var(--status-sold)]' },
  damaged: { label: 'Damaged', cls: 'bg-[var(--danger)]/15 text-[var(--danger)]' },
  lost: { label: 'Lost', cls: 'bg-[var(--danger)]/15 text-[var(--danger)]' },
  in_maintenance: { label: 'Maintenance', cls: 'bg-[var(--status-maintenance)]/15 text-[var(--status-maintenance)]' },
  retired: { label: 'Retired', cls: 'bg-[var(--status-terminal)]/15 text-[var(--status-terminal)]' },
  rented: { label: 'Rented', cls: 'bg-[var(--status-rented)]/15 text-[var(--status-rented)]' },
};

const badgeBase = 'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold';

function readStockUuid(search) {
  try {
    return new URLSearchParams(search).get('stockUuid') || '';
  } catch {
    return '';
  }
}

export function UnitsScreen() {
  const { permissions } = useAuth();
  const location = useLocation();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [stockUuid, setStockUuid] = useState(() => readStockUuid(location.search));

  const [stocks, setStocks] = useState([]);
  const [productTypes, setProductTypes] = useState([]);

  const [prevSearch, setPrevSearch] = useState(location.search);
  if (location.search !== prevSearch) {
    setPrevSearch(location.search);
    setStockUuid(readStockUuid(location.search));
  }

  const typeName = useCallback(
    (uuid) => productTypes.find((p) => p.uuid === uuid)?.name || '—',
    [productTypes]
  );

  const stockLabel = useCallback(
    (s) => {
      const t = typeName(s.productTypeUuid);
      const sub = s.subTypeUuid ? typeName(s.subTypeUuid) : null;
      return sub ? `${t} (${sub})` : t;
    },
    [typeName]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listAllUnits({ search, stockUuid });
      setUnits(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load units');
    } finally {
      setLoading(false);
    }
  }, [search, stockUuid]);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      if (!cancelled) load();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [load]);

  useEffect(() => {
    listAllStocks({})
      .then((data) => setStocks(Array.isArray(data) ? data : data?.items || []))
      .catch(() => {});
    getProductTypes().then(setProductTypes).catch(() => {});
  }, []);

  const legend = useMemo(() => Object.values(STATUS_META), []);

  if (!can(PERMISSIONS.INVENTORY.VIEW)) {
    return (
      <div className="flex flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view units.</p>
      </div>
    );
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'barcode',
      header: 'Barcode',
      size: 150,
      cell: (info) => (
        <span className="inline-flex rounded-md border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-xs font-semibold tracking-[0.08em] text-[var(--ink)]">
          {info.getValue()}
        </span>
      ),
      enableSorting: false,
      filter: { type: 'text' },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 120,
      cell: (info) => {
        const status = info.getValue();
        const meta = STATUS_META[status] || { label: status || 'Unknown', cls: 'bg-[var(--surface-sunken)] text-[var(--ink-muted)]' };
        return (
          <span className={`${badgeBase} ${meta.cls}`} data-testid={`unit-status-${status}`}>
            {meta.label}
          </span>
        );
      },
      filter: { type: 'picklist', options: UNIT_STATUSES.map(s => ({ value: s.value, label: s.label })) },
    },
    {
      accessorKey: 'stockName',
      header: 'Stock / Vendor',
      size: 250,
      cell: (info) => {
        const unit = info.row.original;
        return (
          <div>
            <div className="font-semibold">{unit.stockName || 'Stock'}</div>
            <div className="typography-body-sm text-[var(--ink-muted)]">
              {unit.vendorName || 'Vendor'}
              {unit.colourName && <span> &middot; {unit.colourName}</span>}
              {unit.sizeName && <span> ({unit.sizeName})</span>}
            </div>
          </div>
        );
      },
      enableSorting: false,
      filter: { type: 'text' },
    },
    {
      accessorKey: 'buyingPricePaise',
      header: 'Buy (₹)',
      size: 120,
      cell: (info) => (
        <span className="text-right typography-money-sm text-[var(--ink)]">
          Buy {formatPaise(Number(info.getValue()))}
        </span>
      ),
      enableSorting: false,
      filter: { type: 'number' },
    },
  ], []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-6 overflow-hidden">
      <div>
        <h1 className="typography-heading mb-1">Units</h1>
        <p className="typography-body-sm text-[var(--ink-muted)]">
          Every scanned item across all stocks. Filter by status or stock.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          type="search"
          label="Search"
          placeholder="Search barcode, stock, vendor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search units"
        />
        {stockUuid && (
          <SearchableSelect
            label="Stock"
            value={stockUuid}
            onChange={setStockUuid}
            searchPlaceholder="Search stocks…"
            emptyMessage="No stocks."
            options={[
              { value: '', label: 'All stocks' },
              ...stocks.map((s) => ({ value: s.uuid, label: stockLabel(s) })),
            ]}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--ink-muted)]">
        <span className="font-medium uppercase tracking-wide">Status key:</span>
        {legend.map((meta) => (
          <span key={meta.label} className="inline-flex items-center gap-1.5">
            <span className={`${badgeBase} ${meta.cls}`}>{meta.label}</span>
          </span>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
        <DataGrid
          data={units}
          columns={columns}
          isLoading={loading}
          isEmpty={units.length === 0}
          emptyMessage={`No units.${stockUuid ? ' This stock has no scanned units yet.' : ''}`}
          getRowTestId={() => 'unit-row'}
          className="flex-1"
        />
      </div>
    </div>
  );
}

export default UnitsScreen;