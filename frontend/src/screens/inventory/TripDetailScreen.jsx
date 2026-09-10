import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Dialog,
  SearchableSelect,
  useToast,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getTrip, getStocks, cloneLastStock, addTripVendor } from '../../services/tripsApi.js';
import { getVendors, createVendor } from '../../services/vendorsApi.js';
import { getProductTypes } from '../../services/picklistsApi.js';
import { formatPaise } from '../../platform/money.js';
import { parseRupeesToPaise } from '../../platform/moneyInput.js';

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // ~5MB cap for bill receipt images (base64 dataURL)

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
  const [creatingNewVendor, setCreatingNewVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState({ vendorUuid: '', billReference: '', totalPaidPaise: '', notes: '', receiptImage: null });
  const [newVendor, setNewVendor] = useState({ name: '', address: '', phone: '' });
  const [vendorFormError, setVendorFormError] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [savingVendor, setSavingVendor] = useState(false);
  const [receiptView, setReceiptView] = useState(null);

  const ptName = useCallback(
    (uuid) => productTypes.find((p) => p.uuid === uuid)?.name || 'Product',
    [productTypes]
  );

  const tripVendorNames = useMemo(() => {
    const map = new Map();
    tripVendors.forEach((tv) => {
      const v = tv.vendor || {};
      const name = tv.vendorName || v.name;
      if (v.uuid) map.set(v.uuid, name || 'Vendor');
      if (tv.vendorUuid) map.set(tv.vendorUuid, name || 'Vendor');
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
      const tv = Array.isArray(data?.vendors)
        ? data.vendors
        : Array.isArray(data?.trip_vendors) ? data.trip_vendors : [];
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

    let vendorUuid = vendorForm.vendorUuid;
    if (creatingNewVendor) {
      if (!newVendor.name.trim()) {
        setVendorFormError('Please enter the vendor name.');
        return;
      }
    } else if (!vendorUuid) {
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
      if (creatingNewVendor) {
        const created = await createVendor({
          name: newVendor.name.trim(),
          phone: newVendor.phone.trim() || undefined,
          address: newVendor.address.trim() || undefined,
        });
        vendorUuid = created.uuid;
        setVendors((prev) => [...prev.filter((v) => v.uuid !== created.uuid), created]);
      }
      await addTripVendor(tripUuid, {
        vendorUuid,
        billReference: vendorForm.billReference.trim() || null,
        totalPaidPaise,
        notes: vendorForm.notes.trim() || null,
        receiptImage: vendorForm.receiptImage || null,
      });
      toast.success({ title: 'Vendor added' });
      setAddVendorOpen(false);
      resetVendorDialog();
      await loadTrip();
    } catch (err) {
      setVendorFormError(err.message);
    } finally {
      setSavingVendor(false);
    }
  };

  const resetVendorDialog = () => {
    setVendorForm({ vendorUuid: '', billReference: '', totalPaidPaise: '', notes: '', receiptImage: null });
    setNewVendor({ name: '', address: '', phone: '' });
    setCreatingNewVendor(false);
    setVendorFormError('');
    setReceiptError('');
  };

  const openAddVendor = () => {
    resetVendorDialog();
    const existing = new Set(tripVendors.map((tv) => tv.vendor?.uuid || tv.vendorUuid).filter(Boolean));
    const available = vendors.filter((v) => v.isActive !== false && !existing.has(v.uuid));
    if (available.length === 1) {
      setVendorForm((f) => ({ ...f, vendorUuid: available[0].uuid }));
    }
    setAddVendorOpen(true);
  };

  const handleCreateVendor = (q) => {
    setCreatingNewVendor(true);
    setNewVendor((f) => ({ ...f, name: q }));
    setVendorForm((f) => ({ ...f, vendorUuid: '' }));
  };

  const handleChangeDirection = () => {
    setCreatingNewVendor(false);
    setNewVendor({ name: '', address: '', phone: '' });
  };

  const handleReceiptFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setReceiptError('');
    if (!file.type.startsWith('image/')) {
      setReceiptError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setReceiptError('Receipt image must be 5 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setVendorForm((f) => ({ ...f, receiptImage: reader.result }));
      }
    };
    reader.onerror = () => setReceiptError('Could not read the image file.');
    reader.readAsDataURL(file);
  };

  const stockByVendorGroups = useMemo(() => {
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

  const totalStockCost = useMemo(
    () => stocks.reduce((sum, stock) => sum + (Number(stock.quantity) * Number(stock.buyingPricePaise)), 0),
    [stocks]
  );

  const setNewV = (key) => (e) => setNewVendor((f) => ({ ...f, [key]: e.target.value }));

  const vendorColumns = useMemo(() => [
    {
      accessorKey: 'vendorName',
      header: 'Vendor',
      size: 160,
      filter: { type: 'text' },
      cell: (info) => <div className="font-semibold">{info.getValue()}</div>,
    },
    {
      accessorKey: 'billRef',
      header: 'Bill reference',
      size: 160,
      filter: { type: 'text' },
      cell: (info) => info.getValue() ? `Bill ${info.getValue()}` : <span className="text-[var(--ink-muted)]">No bill reference</span>,
    },
    {
      accessorKey: 'paid',
      header: 'Paid (₹)',
      size: 140,
      cell: (info) => info.getValue() != null ? (
        <span className="typography-money-sm text-[var(--ink)]">{formatPaise(Number(info.getValue()))}</span>
      ) : (
        <span className="text-[var(--ink-muted)]">—</span>
      ),
    },
    {
      accessorKey: 'receipt',
      header: 'Receipt',
      size: 80,
      cell: (info) => {
        const receipt = info.getValue();
        const tv = info.row.original;
        return receipt ? (
          <button
            type="button"
            onClick={() => setReceiptView({ src: receipt, name: tv.vendorName })}
            data-testid="view-receipt"
            className="inline-block h-11 w-11 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] transition-opacity hover:opacity-80"
            title={`View receipt — ${tv.vendorName}`}
            aria-label={`View receipt for ${tv.vendorName}`}
          >
            <img src={receipt} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <span className="text-[var(--ink-muted)]">—</span>
        );
      },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: 'View',
      size: 140,
      cell: (info) => {
        const tv = info.row.original;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/vendors/${tv.vendor?.uuid || tv.vendorUuid}`)}
            disabled={!tv.vendor?.uuid && !tv.vendorUuid}
          >
            View vendor
          </Button>
        );
      },
      enableSorting: false,
    },
  ], [vendorName]);

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
  const selectedVendor = availableVendors.find((v) => v.uuid === vendorForm.vendorUuid);
  const vendorComboboxOptions = availableVendors.map((v) => ({
    value: v.uuid,
    label: v.name,
    description: v.phone || undefined,
  }));

  const stocksByVendor = stockByVendorGroups;



  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>&larr; All trips</Button>
          <h1 className="typography-heading mb-1 mt-1">
            {trip.name || `Trip`} &middot; {new Date(trip.purchasedOn).toLocaleDateString()}
            {tripVendors.length > 0 && <span className="text-[var(--ink-muted)]"> &middot; {tripVendors.length} vendor{tripVendors.length > 1 ? 's' : ''}</span>}
          </h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Paid {formatPaise(Number(trip.totalPaidPaise))}
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
              <span className={'font-semibold tabular-nums ' + (Number(trip.variancePaise) < 0
                ? 'text-[var(--money-out)]'
                : Number(trip.variancePaise) > 0
                ? 'text-[var(--money-in)]'
                : 'text-[var(--ink-muted)]')}>
                {/* UX-H4: glyph + explicit label ride along with the money colour. */}
                <span aria-hidden="true">{Number(trip.variancePaise) < 0 ? '↓' : Number(trip.variancePaise) > 0 ? '↑' : '±'}</span>{' '}
                <span className="sr-only">Variance:</span>
                {formatPaise(Number(trip.variancePaise))}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Per-vendor bills */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
        <div className="border-b border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Vendors ({tripVendors.length})</h2>
        </div>
        {tripVendors.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-[var(--ink-muted)]">
              No vendors on this trip yet. Add one to start buying stock.
            </p>
          </div>
        ) : (
          <DataGrid
            data={tripVendors.map((tv, idx) => ({
              ...tv,
              id: tv.uuid || tv.vendor?.uuid || tv.vendorUuid || idx,
              vendorName: tv.vendor?.name || vendorName(tv.vendorUuid),
              billRef: tv.bill_reference ?? tv.billReference,
              paid: tv.total_paid ?? tv.totalPaidPaise,
              receipt: tv.receiptImage ?? tv.receipt_image ?? null,
            }))}
            columns={vendorColumns}
            isLoading={false}
            isEmpty={tripVendors.length === 0}
            emptyMessage="No vendors found."
          />
        )}
      </div>

      {/* Stocks grouped by vendor */}
      {stocksByVendor.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle>Stocks — {group.name} ({group.stocks.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHead sticky>
                  <TableRow>
                    <TableHeaderCell frozen>Stock</TableHeaderCell>
                    <TableHeaderCell className="text-right">Money (₹)</TableHeaderCell>
                    <TableHeaderCell className="text-right">Scanned</TableHeaderCell>
                    <TableHeaderCell className="text-right">Action</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.stocks.map((stock) => {
                    const scanned = stock.unitsScannedCount ?? 0;
                    const qty = Number(stock.quantity);
                    const isFull = scanned >= qty;
                    return (
                      <TableRow key={stock.uuid}>
                        <TableCell frozen>
                          <div className="font-semibold">
                            {ptName(stock.productTypeUuid)} {stock.name ? `· ${stock.name}` : ''} &middot; qty {qty}
                          </div>
                          <div className="typography-body-sm text-[var(--ink-muted)]">
                            Channel <span className="capitalize">{stock.channel?.toLowerCase()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="typography-money-sm text-[var(--ink)]">Buy {formatPaise(Number(stock.buyingPricePaise))}</div>
                          <div className="typography-money-sm text-[var(--ink-muted)]">Sell {formatPaise(Number(stock.sellingPricePaise))}</div>
                          {stock.channel === 'RENTAL' && stock.rentPerDayPaise && (
                            <div className="typography-money-sm text-[var(--ink-muted)]">Rent {formatPaise(Number(stock.rentPerDayPaise))}/day</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {/* UX-H4: completeness carries a glyph, never colour alone. */}
                          <span className={isFull ? 'font-semibold text-[var(--success)]' : 'text-[var(--ink-muted)]'}>
                            {isFull && <span aria-hidden="true">✓ </span>}
                            <span className={isFull ? 'sr-only' : ''}>{isFull ? 'Complete: ' : ''}</span>
                            {scanned} of {qty} scanned
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
          {creatingNewVendor ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--ink)]">Vendor</label>
              <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                <span className="truncate">
                  <span className="font-semibold text-[var(--primary)]">+ New vendor</span>
                  {newVendor.name ? <span className="ml-1 font-medium">{newVendor.name}</span> : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleChangeDirection}
                  data-testid="change-vendor-direction"
                >
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <SearchableSelect
              label="Vendor"
              value={vendorForm.vendorUuid}
              onChange={(val) => setVendorForm((f) => ({ ...f, vendorUuid: val }))}
              options={vendorComboboxOptions}
              placeholder="Search or select a vendor…"
              searchPlaceholder="Search vendors…"
              emptyMessage="No vendors found."
              creatable
              createLabel={(q) => `+ Create "${q}"`}
              onCreate={handleCreateVendor}
              dataTestid="vendor-search"
            />
          )}

          {creatingNewVendor ? (
            <div className="grid grid-cols-1 gap-4 rounded-md border border-[var(--border)] bg-[var(--surface-sunken)]/40 p-3">
              <Input
                label="Name"
                value={newVendor.name}
                onChange={setNewV('name')}
                placeholder="Vendor name"
                required
                autoFocus
              />
              <Input
                label="Contact number"
                value={newVendor.phone}
                onChange={setNewV('phone')}
                placeholder="Phone number"
                inputMode="tel"
              />
              <Input
                label="Address"
                value={newVendor.address}
                onChange={setNewV('address')}
                placeholder="Address"
              />
            </div>
          ) : selectedVendor ? (
            <Input
              label="Address"
              value={selectedVendor.address || ''}
              placeholder={selectedVendor.address ? 'Address' : 'No address on file'}
              readOnly
              hint={selectedVendor.address ? 'Auto-filled from the vendor record.' : undefined}
            />
          ) : null}

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
          <Input
            label="Notes"
            value={vendorForm.notes}
            onChange={(e) => setVendorForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional"
            maxLength={2000}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--ink)]">Bill receipt image</label>
            {vendorForm.receiptImage ? (
              <div className="flex items-center gap-3">
                <img
                  src={vendorForm.receiptImage}
                  alt="Bill receipt preview"
                  className="h-16 w-16 rounded-md border border-[var(--border)] object-cover"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVendorForm((f) => ({ ...f, receiptImage: null }))}
                  data-testid="clear-receipt"
                >
                  Remove
                </Button>
                <span className="text-xs text-[var(--ink-muted)]">Attached to this vendor&apos;s bill.</span>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                data-testid="receipt-file-input"
                className="text-sm text-[var(--ink)] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[var(--surface-sunken)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--ink)] hover:file:bg-[var(--border-strong)]"
                onChange={handleReceiptFile}
              />
            )}
            {receiptError && (
              <p className="text-xs font-medium text-[var(--danger)]" role="alert">{receiptError}</p>
            )}
          </div>

          {vendorFormError && (
            <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{vendorFormError}</div>
          )}
        </form>
      </Dialog>

      <Dialog
        open={!!receiptView}
        onClose={() => setReceiptView(null)}
        title={receiptView ? `Bill receipt — ${receiptView.name}` : 'Bill receipt'}
      >
        {receiptView && (
          <img
            src={receiptView.src}
            alt={`Bill receipt for ${receiptView.name}`}
            className="max-h-[70vh] w-full rounded-md object-contain"
          />
        )}
      </Dialog>
    </div>
  );
}

export default TripDetailScreen;