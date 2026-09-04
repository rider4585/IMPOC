import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Button, useToast } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getStockIntake, getStockIntakeLines, cloneLastLot } from '../../services/intakeApi.js';
import { getVendors } from '../../services/vendorsApi.js';
import { getProductTypes } from '../../services/picklistsApi.js';
import { formatPaise } from '../../platform/money.js';

export function TripDetailScreen() {
  const { tripUuid } = useParams();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);
  const canCreate = can(PERMISSIONS.INVENTORY.CREATE);

  const [trip, setTrip] = useState(null);
  const [lots, setLots] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const vendorName = vendors.find((v) => v.uuid === trip?.vendorUuid)?.name || 'Vendor';
  const ptName = useCallback(
    (uuid) => productTypes.find((p) => p.uuid === uuid)?.name || 'Product',
    [productTypes]
  );

  const loadTrip = useCallback(async () => {
    if (!tripUuid) return;
    setLoading(true);
    setError('');
    try {
      const [tripData, lotsData] = await Promise.all([
        getStockIntake(tripUuid),
        getStockIntakeLines(tripUuid),
      ]);
      setTrip(tripData);
      setLots(Array.isArray(lotsData) ? lotsData : lotsData?.items || []);
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

  const handleCloneLot = async () => {
    if (!tripUuid) return;
    try {
      const clone = await cloneLastLot(tripUuid);
      if (!clone) {
        toast.info({ title: 'No lots to clone' });
        return;
      }
      navigate(`/trips/${tripUuid}/lots/new`, { state: { prefill: clone } });
    } catch (err) {
      toast.error({ title: 'Clone failed', description: err.message });
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

  const totalLotsCost = lots.reduce((sum, lot) => sum + (Number(lot.quantity) * Number(lot.buyingPricePaise)), 0);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>&larr; All trips</Button>
          <h1 className="typography-heading mb-1 mt-1">{vendorName} &middot; {new Date(trip.purchasedOn).toLocaleDateString()}</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            {trip.billReference || 'No bill reference'} &middot; Paid {formatPaise(Number(trip.totalPaidPaise))}
          </p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            {lots.length > 0 && (
              <Button variant="outline" onClick={handleCloneLot} data-testid="clone-last-lot">Clone last lot</Button>
            )}
            <Button onClick={() => navigate(`/trips/${tripUuid}/lots/new`)} data-testid="add-lot">Add lot</Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}

      {/* Variance strip */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-sm">
        {lots.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No lots yet.</p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span>
              Recorded{' '}
              <span className="font-semibold tabular-nums">{formatPaise(Number(trip.totalPaidPaise))}</span>
            </span>
            <span className="text-[var(--ink-muted)]">&middot;</span>
            <span>
              Lots{' '}
              <span className="font-semibold tabular-nums">{formatPaise(totalLotsCost)}</span>
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

      {/* Lot list */}
      <Card>
        <CardHeader>
          <CardTitle>Lots ({lots.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {lots.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No lots in this trip yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lots.map((lot) => {
                const scanned = lot.unitsScannedCount ?? 0;
                const qty = Number(lot.quantity);
                const isFull = scanned >= qty;
                return (
                  <li
                    key={lot.uuid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold">
                        {ptName(lot.productTypeUuid)} {lot.name ? `· ${lot.name}` : ''} &middot; qty {qty}
                      </div>
                      <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                        Buy {formatPaise(Number(lot.buyingPricePaise))} · Sell{' '}
                        {formatPaise(Number(lot.sellingPricePaise))} · Channel{' '}
                        <span className="capitalize">{lot.channel?.toLowerCase()}</span>
                        {lot.channel === 'RENTAL' && lot.rentPerDayPaise && (
                          <> &middot; Rent {formatPaise(Number(lot.rentPerDayPaise))}/day</>
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
                          onClick={() => navigate(`/trips/${tripUuid}/lots/${lot.uuid}/scan`)}
                          data-testid="start-scanning"
                        >
                          Start scanning
                        </Button>
                      )}
                      {canCreate && isFull && (
                        <span className="text-xs font-semibold text-[var(--success)]">Lot complete</span>
                      )}
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

export default TripDetailScreen;
