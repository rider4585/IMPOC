import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Dialog, useToast } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getTrip, getStocks, cloneLastStock, addTripVendor } from '../../services/tripsApi.js';
import { getVendors } from '../../services/vendorsApi.js';
import { getProductTypes } from '../../services/picklistsApi.js';
import { formatPaise } from '../../platform/money.js';
import { parseRupeesToPaise } from '../../platform/moneyInput.js';

export function TripDetailScreen() {
  const { tripUuid } = useParams();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);
  const canCreate = can(PERMISSIONS.INVENTORY.CREATE);

  const [trip, setTrip] = useState(null);
  const [tripVendors, setTripVendors] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState({ vendorUuid: '', billReference: '', totalPaidPaise: '' });
  const [vendorFormError, setVendorFormError] = useState('');
  const [savingVendor, setSavingVendor] = useState(false);

  const ptName = useCallback(
    (uuid) => productTypes.find((p) => p.uuid === uuid)?.name || 'Product',
    [productTypes]
  );

  const tripVendorNames = useMemo(() => {
    const map = new Map();
    tripVendors.forEach((tv) => {
      const v = tv.vendor || {};
      if (v.uuid) map.set(v.uuid, v.name || 'Vendor');
      if (tv.vendorUuid) map.set(tv.vendorUuid, v.name || 'Vendor');
    });
    return map;
  }, [tripVendors]);

  const vendorName = useCallback(
    (uuid) => tripVendorNames.get(uuid) || vendors.find((v) => v.uuid === uuid)?.name || 'Vendor',
    [tripVendorNames, vendors]
  );

  const loadTrip = useCallback(async () => {
    if (!tripUuid) return;
    setLoading(true);
    setError('');
    try {
      const data = await getTrip(tripUuid);
      setTrip(data);
      const tv = Array.isArray(data?.trip_vendors) ? data.trip_vendors : [];
      if (tv.length > 0) {
        setTripVendors(tv);
      } else if (data?.vendorUuid) {
        // Legacy/mid-migration server: single vendor on the trip DTO
        setTripVendors([
          {
            uuid: null,
            vendorUuid: data.vendorUuid,
            bill_reference: data.billReference ?? null,
            total_paid: data.totalPaidPaise ?? null,
          },
        ]);
      } else {
        setTripVendors([]);
      }
      if (Array.isArray(data?.stocks)) {
        setStocks(data.stocks);
      } else {
        const stocksData = await getStocks(tripUuid);
        setStocks(Array.isArray(stocksData) ? stocksData : stocksData?.items || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  }, [tripUuid]);

  useEffect(() => {
    loadTrip();
    getVendors().then(setVendors).catch(() => {});
    getProductTypes().then(setProductTypes).catch(() => {});
  }, [loadTrip]);

  const handleCloneStock = async () => {
    if (!tripUuid) return;
    try {
      const clone = await cloneLastStock(tripUuid);
      if (!clone) {
        toast.info({ title: 'No stocks to clone' });
        return;
      }
      navigate(`/trips/${tripUuid}/stocks/new`, { state: { prefill: clone } });
    } catch (err) {
      toast.error({ title: 'Clone failed', description: err.message });
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    setVendorFormError('');
    if (!vendorForm.vendorUuid) {
      setVendorFormError('Please select a vendor.');
      return;
    }
    const totalPaidPaise = parseRupeesToPaise(vendorForm.totalPaidPaise);
    if (Number.isNaN(totalPaidPaise)) {
      setVendorFormError('Total paid must be a valid rupee amount.');
      return;
    }
    setSavingVendor(true);
    try {
      await addTripVendor(tripUuid, {
        vendorUuid: vendorForm.vendorUuid,
        billReference: vendorForm.billReference.trim() || null,
        totalPaidPaise,
      });
      toast.success({ title: 'Vendor added' });
      setAddVendorOpen(false);
      setVendorForm({ vendorUuid: '', billReference: '', totalPaidPaise: '' });
      await loadTrip();
    } catch (err) {
      setVendorFormError(err.message);
    } finally {
      setSavingVendor(false);
    }
  };

  const openAddVendor = () => {
    const existing = new Set(tripVendors.map((tv) => tv.vendor?.uuid || tv.vendorUuid).filter(Boolean));
    setVendorForm({ vendorUuid: '', billReference: '', totalPaidPaise: '' });
    setVendorFormError('');
    setAddVendorOpen(true);
    const available = vendors.filter((v) => v.isActive !== false && !existing.has(v.uuid));
    if (available.length === 1) {
      setVendorForm((f) => ({ ...f, vendorUuid: available[0].uuid }));
    }
  };

  if (!can(PERMISSIONS.INVENTORY.VIEW)) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view this trip.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--surface-sunken)]" />
        <div className="h-20 animate-pulse rounded-md bg-[var(--surface-sunken)]" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>&larr; All trips</Button>
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error || 'Trip not found'}</div>
      </div>
    );
  }

  const existingVendorUuids = new Set(tripVendors.map((tv) => tv.vendor?.uuid || tv.vendorUuid).filter(Boolean));
  const availableVendors = vendors.filter((v) => v.isActive !== false && !existingVendorUuids.has(v.uuid));

  const stocksByVendor = useMemo(() => {
    const groups = [];
    tripVendors.forEach((tv) => {
      const key = tv.vendor?.uuid || tv.vendorUuid;
      if (!key) return;
      groups.push({ key, name: vendorName(key), stocks: [] });
    });
    const byKey = new Map(groups.map((g) => [g.key, g]));
    stocks.forEach((stock) => {
      const key = stock.vendorUuid || '';
      const group = byKey.get(key);
      if (group) group.stocks.push(stock);
      else {
        if (!byKey.has('__unknown')) {
          byKey.set('__unknown', { key: '__unknown', name: '—', stocks: [] });
          groups.push(byKey.get('__unknown'));
        }
        byKey.get('__unknown').stocks.push(stock);
      }
    });
    return groups.filter((g) => g.stocks.length > 0 || (g.key && g.key !== '__unknown'));
  }, [tripVendors, stocks, vendorName]);

  const totalStockCost = stocks.reduce((sum, stock) => sum + (Number(stock.quantity) * Number(stock.buyingPricePaise)), 0);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>&larr; All trips</Button>
          <h1 className="typography-heading mb-1 mt-1">
            Trip &middot; {new Date(trip.purchasedOn).toLocaleDateString()}
            {tripVendors.length > 0 && <span className="text-[var(--ink-muted)]"> &middot; {tripVendors.length} vendor{tripVendors.length > 1 ? 's' : ''}</span>}
          </h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            {trip.billReference || 'No bill reference'} &middot; Paid {formatPaise(Number(trip.totalPaidPaise))}
          </p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            {stocks.length > 0 && (
              <Button variant="outline" onClick={handleCloneStock} data-testid="clone-last-stock">Clone last stock</Button>
            )}
            <Button variant="outline" onClick={openAddVendor} data-testid="add-vendor">Add vendor</Button>
            <Button onClick={() => navigate(`/trips/${tripUuid}/stocks/new`)} data-testid="add-stock">Add stock</Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}

      {/* Variance strip */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-sm">
        {stocks.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No stocks yet.</p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span>
              Recorded{' '}
              <span className="font-semibold tabular-nums">{formatPaise(Number(trip.totalPaidPaise))}</span>
            </span>
            <span className="text-[var(--ink-muted)]">&middot;</span>
            <span>
              Stocks{' '}
              <span className="font-semibold tabular-nums">{formatPaise(totalStockCost)}</span>
            </span>
            <span className="text-[var(--ink-muted)]">&middot;</span>
            <span>
              Variance{' '}
              <span
                className={
                  'font-semibold tabular-nums ' +
                  (Number(trip.variancePaise) < 0
                    ? 'text-[var(--money-out)]'
                    : Number(trip.variancePaise) > 0
                    ? 'text-[var(--money-in)]'
                    : '')
                }
              >
                {formatPaise(Number(trip.variancePaise))}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Per-vendor bills */}
      <Card>
        <CardHeader>
          <CardTitle>Vendors ({tripVendors.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {tripVendors.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">
              No vendors on this trip yet. Add one to start buying stock.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tripVendors.map((tv, idx) => {
                const name = tv.vendor?.name || vendorName(tv.vendorUuid);
                const billRef = tv.bill_reference ?? tv.billReference;
                const paid = tv.total_paid ?? tv.totalPaidPaise;
                return (
                  <li
                    key={tv.uuid || tv.vendor?.uuid || tv.vendorUuid || idx}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold">{name}</div>
                      <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                        {billRef ? `Bill ${billRef}` : 'No bill reference'}
                        {paid != null && <> &middot; Paid {formatPaise(Number(paid))}</>}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/vendors/${tv.vendor?.uuid || tv.vendorUuid}`)}
                      disabled={!tv.vendor?.uuid && !tv.vendorUuid}
                    >
                      View vendor
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Stocks grouped by vendor */}
      {stocksByVendor.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle>Stocks — {group.name} ({group.stocks.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ul className="flex flex-col gap-2">
              {group.stocks.map((stock) => {
                const scanned = stock.unitsScannedCount ?? 0;
                const qty = Number(stock.quantity);
                const isFull = scanned >= qty;
                return (
                  <li
                    key={stock.uuid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold">
                        {ptName(stock.productTypeUuid)} {stock.name ? `· ${stock.name}` : ''} &middot; qty {qty}
                      </div>
                      <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                        Buy {formatPaise(Number(stock.buyingPricePaise))} · Sell{' '}
                        {formatPaise(Number(stock.sellingPricePaise))} · Channel{' '}
                        <span className="capitalize">{stock.channel?.toLowerCase()}</span>
                        {stock.channel === 'RENTAL' && stock.rentPerDayPaise && (
                          <> &middot; Rent {formatPaise(Number(stock.rentPerDayPaise))}/day</>
                        )}
                      </div>
                      <div className="mt-0.5 text-[13px]">
                        <span className={isFull ? 'font-semibold text-[var(--success)]' : 'text-[var(--ink-muted)]'}>
                          {scanned} of {qty} scanned
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {canCreate && !isFull && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/trips/${tripUuid}/stocks/${stock.uuid}/scan`)}
                          data-testid="start-scanning"
                        >
                          Start scanning
                        </Button>
                      )}
                      {canCreate && isFull && (
                        <span className="text-xs font-semibold text-[var(--success)]">Stock complete</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Dialog
        open={addVendorOpen}
        onClose={() => setAddVendorOpen(false)}
        title="Add vendor to trip"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddVendorOpen(false)} disabled={savingVendor}>Cancel</Button>
            <Button type="submit" form="add-vendor-form" loading={savingVendor}>Add vendor</Button>
          </>
        }
      >
        <form id="add-vendor-form" onSubmit={handleAddVendor} className="flex flex-col gap-4">
          <Select label="Vendor" value={vendorForm.vendorUuid} onChange={(e) => setVendorForm((f) => ({ ...f, vendorUuid: e.target.value }))} required>
            <option value="">Select a vendor…</option>
            {availableVendors.map((v) => (
              <option key={v.uuid} value={v.uuid}>{v.name}</option>
            ))}
          </Select>
          <Input
            label="Bill reference"
            value={vendorForm.billReference}
            onChange={(e) => setVendorForm((f) => ({ ...f, billReference: e.target.value }))}
            placeholder="Optional"
            maxLength={100}
          />
          <Input
            label="Total paid (₹)"
            value={vendorForm.totalPaidPaise}
            onChange={(e) => setVendorForm((f) => ({ ...f, totalPaidPaise: e.target.value }))}
            placeholder="e.g. 14400"
            inputMode="decimal"
            hint="Enter in rupees; stored as whole paise."
          />
          {vendorFormError && (
            <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{vendorFormError}</div>
          )}
        </form>
      </Dialog>
    </div>
  );
}

export default TripDetailScreen;