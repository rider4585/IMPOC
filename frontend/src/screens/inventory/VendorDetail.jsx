import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Badge, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Dialog, useToast } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getVendorHistory } from '../../services/vendorsApi.js';
import { formatPaise } from '../../platform/money.js';
import { unitStatusBadgeVariant } from '../rentals/rentalStatus.js';

function varianceGlyph(paise) {
  if (paise < 0) return { glyph: '↓', label: 'Var. loss', cls: 'text-[var(--money-out)]' };
  if (paise > 0) return { glyph: '↑', label: 'Var. gain', cls: 'text-[var(--money-in)]' };
  return { glyph: '±', label: 'Variance', cls: 'text-[var(--ink-muted)]' };
}

function StockBlock({ stock }) {
  const units = stock.units || [];
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{stock.stockName || stock.name || 'Stock'}</span>
        <span className="text-sm flex items-baseline gap-3">
          <span className="text-sm font-semibold text-[var(--ink)]">{formatPaise(Number(stock.buyingPricePaise))}</span>
          <span className="text-xs text-[var(--ink-muted)]">qty {stock.quantity} · {stock.channel}</span>
        </span>
      </div>
      {units.length === 0 ? (
        <p className="mt-1 text-xs text-[var(--ink-faint)]">No units scanned.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <Table>
            <TableHead sticky>
              <TableRow>
                <TableHeaderCell frozen>Barcode</TableHeaderCell>
                <TableHeaderCell>Variant</TableHeaderCell>
                <TableHeaderCell className="text-right">Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.uuid}>
                  <TableCell frozen>
                    <span className="font-mono text-[var(--ink)]">{unit.barcode}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-[var(--ink-muted)]">
                      {unit.colourName || ''} {unit.sizeName || ''}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={unitStatusBadgeVariant(unit.status)}>{unit.status || 'Unknown'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function VendorDetail() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailTrip, setDetailTrip] = useState(null);

  const loadHistory = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    setError('');
    try {
      const result = await getVendorHistory(uuid);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load vendor history');
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (!can(PERMISSIONS.INVENTORY.VIEW)) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view vendor details.</p>
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

  if (error || !data) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/vendors')}>&larr; Vendors</Button>
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error || 'Vendor not found'}</div>
      </div>
    );
  }

  const vendor = data.vendor || data;
  const trips = data.trips || [];

  const tripStocks = (trip) => {
    const tripVendors = Array.isArray(trip.trip_vendors) ? trip.trip_vendors : [];
    if (tripVendors.length > 0) {
      return tripVendors.flatMap((tv) => (Array.isArray(tv.stocks) ? tv.stocks : []));
    }
    return trip.lines || [];
  };

  const tripVendorSummary = (trip) => {
    const tripVendors = Array.isArray(trip.trip_vendors) ? trip.trip_vendors : [];
    if (tripVendors.length === 0) return null;
    return tripVendors.map((tv, idx) => ({
      key: tv.uuid || tv.vendor?.uuid || `tv-${idx}`,
      name: tv.vendor?.name || 'Vendor',
      billReference: tv.bill_reference ?? tv.billReference,
      totalPaid: tv.total_paid ?? tv.totalPaidPaise,
    }));
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'purchasedOn',
      header: 'Date',
      size: 140,
      cell: (info) => {
        const date = info.getValue();
        return (
          <span className="text-sm font-medium text-[var(--ink)]">
            {new Date(date).toLocaleDateString()}
          </span>
        );
      },
      filter: { type: 'date' },
    },
    {
      accessorKey: 'totalPaidPaise',
      header: 'Paid',
      size: 140,
      cell: (info) => (
        <span className="text-right text-xs font-medium text-[var(--ink)] typography-money-sm">
          {formatPaise(Number(info.getValue()) || 0)}
        </span>
      ),
      filter: { type: 'number' },
    },
    {
      accessorKey: 'variancePaise',
      header: 'Variance',
      size: 150,
      cell: (info) => {
        const paise = Number(info.getValue()) || 0;
        const vg = varianceGlyph(paise);
        return (
          <span className={`text-right text-xs font-medium ${vg.cls}`}>
            <span aria-hidden="true">{vg.glyph}</span>
            <span className="sr-only">{vg.label}:</span>{' '}
            {formatPaise(paise)}
          </span>
        );
      },
      filter: { type: 'number' },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 140,
      cell: (info) => {
        const trip = info.row.original;
        const stocks = tripStocks(trip);
        return (
          <div className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailTrip(trip)}
              disabled={stocks.length === 0}
            >
              View {stocks.length} stock{stocks.length !== 1 ? 's' : ''}
            </Button>
          </div>
        );
      },
      enableSorting: false,
    },
  ], []);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6 overflow-hidden">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/vendors')}>&larr; Vendors</Button>
        <h1 className="typography-heading mb-1 mt-1">{vendor.name}</h1>
        <p className="typography-body-sm text-[var(--ink-muted)]">
          {vendor.phone || ''}{vendor.phone && vendor.address ? ' · ' : ''}{vendor.address || ''}
          {' '}&middot;{' '}
          <Badge variant={vendor.isActive !== false ? 'success' : 'neutral'}>
            {vendor.isActive !== false ? 'active' : 'inactive'}
          </Badge>
        </p>
        {vendor.notes && <p className="mt-1 text-sm text-[var(--ink-muted)]">{vendor.notes}</p>}
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}

      <h2 className="text-lg font-semibold">Purchase history ({trips.length} trips)</h2>

      {trips.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-6 text-center">
          <p className="text-sm text-[var(--ink-muted)]">Empty — no trips recorded for this vendor yet.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
          <DataGrid
            data={trips}
            columns={columns}
            isLoading={loading}
            isEmpty={trips.length === 0}
            emptyMessage="No trips."
            getRowTestId={() => 'vendor-detail-trip'}
            className="flex-1"
          />
        </div>
      )}

      {detailTrip && (
        <Dialog open={!!detailTrip} onOpenChange={() => setDetailTrip(null)}>
          <div className="flex flex-col gap-4 p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">
              Trip — {new Date(detailTrip.purchasedOn).toLocaleDateString()}
            </h3>

            {tripVendorSummary(detailTrip) && (
              <div>
                <div className="mb-2 text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">Vendors</div>
                <div className="flex flex-wrap gap-2">
                  {tripVendorSummary(detailTrip).map((s) => (
                    <span
                      key={s.key}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-1 text-sm text-[var(--ink)]"
                    >
                      {s.name}
                      {s.billReference ? ` · ${s.billReference}` : ''}
                      {s.totalPaid != null && <span className="typography-money-sm"> · {formatPaise(Number(s.totalPaid))}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">Stocks</div>
              {tripStocks(detailTrip).length === 0 ? (
                <p className="text-sm text-[var(--ink-muted)]">No stocks in this trip.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {tripStocks(detailTrip).map((stock) => (
                    <StockBlock key={stock.uuid} stock={stock} />
                  ))}
                </div>
              )}
            </div>

            <Button variant="outline" onClick={() => setDetailTrip(null)}>Close</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default VendorDetail;
