import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getVendorHistory } from '../../services/vendorsApi.js';
import { formatPaise } from '../../platform/money.js';

export function VendorDetail() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

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
        <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error || 'Vendor not found'}</div>
      </div>
    );
  }

  const vendor = data.vendor || data;
  const trips = data.trips || [];
  const paginatedTrips = trips.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
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
        <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}

      <h2 className="text-lg font-semibold">Purchase history ({trips.length} trips)</h2>

      {trips.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-white p-6 text-center">
          <p className="text-sm text-[var(--ink-muted)]">Empty — no trips recorded for this vendor yet.</p>
        </div>
      ) : (
        <>
          {paginatedTrips.map((trip) => (
            <Card key={trip.uuid}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between gap-2">
                  <span>Trip — {new Date(trip.purchasedOn).toLocaleDateString()}</span>
                  <span className="text-sm font-normal text-[var(--ink-muted)]">
                    Paid {formatPaise(Number(trip.totalPaidPaise))}
                    {trip.variancePaise != null && (
                      <span className={Number(trip.variancePaise) < 0 ? ' text-[var(--money-out)]' : Number(trip.variancePaise) > 0 ? ' text-[var(--money-in)]' : ''}>
                        {' '}&middot; Variance {formatPaise(Number(trip.variancePaise))}
                      </span>
                    )}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {(trip.lines || []).length === 0 ? (
                  <p className="text-sm text-[var(--ink-muted)]">No lots in this trip.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {trip.lines.map((line) => (
                      <div key={line.uuid} className="rounded-md border border-[var(--border)] bg-white p-3">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="font-semibold">{line.name || line.productTypeUuid || 'Lot'}</span>
                          <span className="text-[var(--ink-muted)]">qty {line.quantity} · {line.channel}</span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">
                          Buy {formatPaise(Number(line.buyingPricePaise))} · Sell {formatPaise(Number(line.sellingPricePaise))}
                        </div>
                        {(line.units || []).length === 0 ? (
                          <p className="mt-1 text-xs text-[var(--ink-faint)]">No units scanned.</p>
                        ) : (
                          <ul className="mt-2 flex flex-col gap-1">
                            {line.units.map((unit) => (
                              <li key={unit.uuid} className="flex items-center gap-2 text-xs">
                                <span className="font-mono text-[var(--ink)]">{unit.barcode}</span>
                                <span className="text-[var(--ink-muted)]">{unit.colour || ''} {unit.size || ''}</span>
                                <span className="ml-auto text-[var(--ink-muted)]">{unit.status}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {trips.length > pageSize && (
            <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
              <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, trips.length)} of {trips.length}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page * pageSize >= trips.length} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VendorDetail;
