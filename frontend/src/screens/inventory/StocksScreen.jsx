import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, SearchableSelect } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getTrips, listAllStocks } from '../../services/tripsApi.js';
import { getVendors } from '../../services/vendorsApi.js';
import { getProductTypes } from '../../services/picklistsApi.js';
import { formatPaise } from '../../platform/money.js';

const SEARCH_DEBOUNCE_MS = 300;

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

  const [search, setSearch] = useState('');
  const [tripUuid, setTripUuid] = useState('');
  const [vendorUuid, setVendorUuid] = useState('');

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
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [load]);

  if (!can(PERMISSIONS.INVENTORY.VIEW)) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view stocks.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div>
        <h1 className="typography-heading mb-1">Stocks</h1>
        <p className="typography-body-sm text-[var(--ink-muted)]">
          All stock lots across every trip. Filter by trip, vendor, or search.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All stocks</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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

          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-[var(--surface-sunken)]" />
              ))}
            </div>
          ) : stocks.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No stocks.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {stocks.map((stock) => {
                const qty = Number(stock.quantity);
                const scanned = Number(stock.unitsScannedCount ?? 0);
                const trip = tripByUuid.get(stock.tripUuid);
                const vendor = stock.vendorName || vendorByUuid.get(stock.vendorUuid)?.name || 'Vendor';
                const sub = subTypeName(stock.subTypeUuid);
                return (
                  <li
                    key={stock.uuid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm"
                    data-testid="stock-row"
                  >
                    <div>
                      <div className="font-semibold">
                        {typeName(stock.productTypeUuid)}
                        {sub && <span className="text-[var(--ink-muted)]"> ({sub})</span>}
                      </div>
                      <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                        {vendor}
                        {trip && <span> &middot; {tripLabel(trip)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[13px]">
                      <span className="text-[var(--ink-muted)]">
                        <span className={scanned >= qty && qty > 0 ? 'font-semibold text-[var(--success)]' : ''}>
                          {scanned} of {qty}
                        </span>{' '}
                        scanned
                      </span>
                      <span className="text-[var(--ink-muted)]">
                        Whole{' '}
                        {stock.wholeBuyingPricePaise != null ? (
                          formatPaise(Number(stock.wholeBuyingPricePaise))
                        ) : (
                          '—'
                        )}{' '}
                        &middot; Per unit {formatPaise(Number(stock.buyingPricePaise))}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/units?stockUuid=${encodeURIComponent(stock.uuid)}`)} data-testid="stock-units">
                        Units
                      </Button>
                      <Button size="sm" onClick={() => navigate(`/trips/${encodeURIComponent(stock.tripUuid)}/stocks/${encodeURIComponent(stock.uuid)}/scan`)} data-testid="stock-scan">
                        Scan
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default StocksScreen;