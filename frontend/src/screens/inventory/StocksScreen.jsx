import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  SearchableSelect,
} from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getTrips, listAllStocks } from '../../services/tripsApi.js';
import { getVendors } from '../../services/vendorsApi.js';
import { getProductTypes } from '../../services/picklistsApi.js';
import { formatPaise } from '../../platform/money.js';

function fallbackName(uuid) {
  if (!uuid) return '—';
  const id = String(uuid);
  if (id.startsWith('type-')) return 'Type';
  if (id.startsWith('subtype-')) return 'Subtype';
  return '—';
}

function tripLabel(t) {
  if (t.name) return t.name;
  return `Trip${t.purchasedOn ? ` ${new Date(t.purchasedOn).toLocaleDateString()}` : ''}`;
}

export function StocksScreen() {
  const { permissions } = useAuth();
  const navigate = useNavigate();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const [stocks, setStocks] = useState([]);
  const [trips, setTrips] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tripUuid, setTripUuid] = useState('');
  const [vendorUuid, setVendorUuid] = useState('');
  const [search, setSearch] = useState('');

  const typeName = useCallback(
    (uuid) => productTypes.find((p) => p.uuid === uuid)?.name || fallbackName(uuid),
    [productTypes]
  );

  const subTypeName = useCallback(
    (uuid) => (uuid ? productTypes.find((p) => p.uuid === uuid)?.name || fallbackName(uuid) : null),
    [productTypes]
  );

  const tripByUuid = useMemo(() => new Map(trips.map((t) => [t.uuid, t])), [trips]);
  const vendorByUuid = useMemo(() => new Map(vendors.map((v) => [v.uuid, v])), [vendors]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listAllStocks({ tripUuid, vendorUuid, search });
      setStocks(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load stocks');
    } finally {
      setLoading(false);
    }
  }, [tripUuid, vendorUuid, search]);

  useEffect(() => {
    getTrips().then(setTrips).catch(() => {});
    getVendors().then(setVendors).catch(() => {});
    getProductTypes().then(setProductTypes).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      if (!cancelled) load();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [load]);

  if (!can(PERMISSIONS.INVENTORY.VIEW)) {
    return (
      <div className="flex flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view stocks.</p>
      </div>
    );
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'productTypeUuid',
      header: 'Stock',
      size: 250,
      cell: (info) => {
        const stock = info.row.original;
        const sub = subTypeName(stock.subTypeUuid);
        return (
          <div className="font-semibold">
            {typeName(stock.productTypeUuid)}
            {sub && <span className="text-[var(--ink-muted)]"> ({sub})</span>}
          </div>
        );
      },
      enableSorting: false,
      filter: { type: 'text' },
    },
    {
      accessorKey: 'vendorName',
      header: 'Vendor / Trip',
      size: 250,
      cell: (info) => {
        const stock = info.row.original;
        const trip = tripByUuid.get(stock.tripUuid);
        const vendor = stock.vendorName || vendorByUuid.get(stock.vendorUuid)?.name || 'Vendor';
        return (
          <div className="typography-body-sm text-[var(--ink-muted)]">
            {vendor}
            {trip && <span> &middot; {tripLabel(trip)}</span>}
          </div>
        );
      },
      filter: { type: 'text' },
    },
    {
      accessorKey: 'unitsScannedCount',
      header: 'Scanned',
      size: 150,
      cell: (info) => {
        const stock = info.row.original;
        const qty = Number(stock.quantity);
        const scanned = Number(stock.unitsScannedCount ?? 0);
        const complete = qty > 0 && scanned >= qty;
        return (
          <span className={`text-right text-xs font-medium ${complete ? 'font-semibold text-[var(--success)]' : 'text-[var(--ink-muted)]'}`}>
            {complete && <span aria-hidden="true">✓ </span>}
            <span className={complete ? 'sr-only' : ''}>{complete ? 'Complete' : ''}</span>
            {scanned} of {qty} scanned
          </span>
        );
      },
      filter: { type: 'number' },
    },
    {
      accessorKey: 'buyingPricePaise',
      header: 'Money (₹)',
      size: 200,
      cell: (info) => {
        const stock = info.row.original;
        return (
          <div className="text-right">
            <div className="typography-money-sm text-[var(--ink)]">
              {stock.wholeBuyingPricePaise != null
                ? `Whole ${formatPaise(Number(stock.wholeBuyingPricePaise))}`
                : 'Whole —'}
            </div>
            <div className="typography-money-sm text-[var(--ink-muted)]">
              Per unit {formatPaise(Number(stock.buyingPricePaise))}
            </div>
            {(Number(stock.cgstRatePct) > 0 || Number(stock.sgstRatePct) > 0) && (
              <div className="text-xs text-[var(--ink-faint)]" title="CGST + SGST charged by the vendor (R-51)">
                GST {Number(stock.cgstRatePct)}% + {Number(stock.sgstRatePct)}%
              </div>
            )}
          </div>
        );
      },
      enableSorting: false,
      filter: { type: 'number' },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 150,
      cell: (info) => {
        const stock = info.row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/units?stockUuid=${encodeURIComponent(stock.uuid)}`)} data-testid="stock-units">
              Units
            </Button>
            <Button size="sm" onClick={() => navigate(`/trips/${encodeURIComponent(stock.tripUuid)}/stocks/${encodeURIComponent(stock.uuid)}/scan`)} data-testid="stock-scan">
              Scan
            </Button>
          </div>
        );
      },
      enableSorting: false,
    },
  ], [navigate, tripByUuid, vendorByUuid, typeName, subTypeName]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-6 overflow-hidden">
      <div>
        <h1 className="typography-heading mb-1">Stocks</h1>
        <p className="typography-body-sm text-[var(--ink-muted)]">
          All stock lots across every trip. Filter by trip or vendor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          type="search"
          label="Search"
          placeholder="Search type, subtype, vendor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search stocks"
        />
        <SearchableSelect
          label="Trip"
          value={tripUuid}
          onChange={setTripUuid}
          searchPlaceholder="Search trips…"
          emptyMessage="No trips."
          options={[
            { value: '', label: 'All trips' },
            ...trips.map((t) => ({
              value: t.uuid,
              label: tripLabel(t),
            })),
          ]}
        />
        <SearchableSelect
          label="Vendor"
          value={vendorUuid}
          onChange={setVendorUuid}
          searchPlaceholder="Search vendors…"
          emptyMessage="No vendors."
          options={[
            { value: '', label: 'All vendors' },
            ...vendors.map((v) => ({ value: v.uuid, label: v.name })),
          ]}
        />
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
          data={stocks}
          columns={columns}
          isLoading={loading}
          isEmpty={stocks.length === 0}
          emptyMessage="No stocks."
          getRowTestId={(stock) => 'stock-row'}
          className="flex-1"
        />
      </div>
    </div>
  );
}

export default StocksScreen;