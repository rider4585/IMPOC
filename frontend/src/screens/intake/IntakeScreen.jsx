import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  getStockIntakes,
  createStockIntake,
  getStockIntakeLines,
  createStockIntakeLine,
  cloneLastLot,
} from '../../services/intakeApi.js';
import { getVendors } from '../../services/vendorsApi.js';
import { getProductTypes, getColours, getSizes } from '../../services/picklistsApi.js';
import { formatPaise } from '../../platform/money.js';
import { CreateTripDialog } from './CreateTripDialog.jsx';
import { CreateLotDialog } from './CreateLotDialog.jsx';
import { ScanScreen } from './ScanScreen.jsx';

export function IntakeScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canCreate = can(PERMISSIONS.INVENTORY.CREATE);
  const canView = can(PERMISSIONS.INVENTORY.VIEW);

  // Reference data
  const [vendors, setVendors] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [colours, setColours] = useState([]);
  const [sizes, setSizes] = useState([]);

  // Trips
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Trip detail
  const [activeTrip, setActiveTrip] = useState(null);
  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(false);

  // Scan context
  const [scanLot, setScanLot] = useState(null);

  // Dialogs
  const [tripOpen, setTripOpen] = useState(false);
  const [lotOpen, setLotOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lotPrefill, setLotPrefill] = useState(null);

  const vendorName = useMemo(() => {
    if (!activeTrip) return '';
    const v = vendors.find((x) => x.uuid === activeTrip.vendorUuid);
    return v ? v.name : '';
  }, [vendors, activeTrip]);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getStockIntakes();
      setTrips(data);
    } catch (err) {
      setError(err.message || 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
    getVendors().then(setVendors).catch(() => {});
    if (canView) {
      getProductTypes().then(setProductTypes).catch(() => {});
      getColours().then(setColours).catch(() => {});
      getSizes().then(setSizes).catch(() => {});
    }
  }, [loadTrips, canView]);

  const loadLots = useCallback(async (trip) => {
    setLotsLoading(true);
    setScanLot(null);
    try {
      const data = await getStockIntakeLines(trip.uuid);
      setLots(data);
      setActiveTrip(trip);
    } catch (err) {
      setError(err.message || 'Failed to load lots');
      setActiveTrip(null);
    } finally {
      setLotsLoading(false);
    }
  }, []);

  const goBack = () => {
    setActiveTrip(null);
    setLots([]);
    setScanLot(null);
  };

  const handleCreateTrip = async ({ vendorUuid, purchasedOn, billReference, totalPaidPaise }) => {
    setSaving(true);
    try {
      await createStockIntake({ vendorUuid, purchasedOn, billReference, totalPaidPaise });
      toast.success({ title: 'Trip created' });
      setTripOpen(false);
      await loadTrips();
    } catch (err) {
      toast.error({ title: 'Create failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLot = async (payload) => {
    setSaving(true);
    try {
      await createStockIntakeLine(activeTrip.uuid, payload);
      toast.success({ title: 'Lot added' });
      setLotOpen(false);
      const data = await getStockIntakeLines(activeTrip.uuid);
      setLots(data);
    } catch (err) {
      toast.error({ title: 'Create failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCloneLot = async () => {
    try {
      const clone = await cloneLastLot(activeTrip.uuid);
      if (!clone) {
        toast.info({ title: 'No lots to clone' });
        return;
      }
      setLotPrefill({ ...clone, prefilled: true });
      setLotOpen(true);
    } catch (err) {
      toast.error({ title: 'Clone failed', description: err.message });
    }
  };

  if (!canView) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view intake.</p>
      </div>
    );
  }

  if (scanLot) {
    return (
      <ScanScreen
        trip={activeTrip}
        lot={scanLot}
        colours={colours}
        sizes={sizes}
        canScan={canCreate}
        onBack={() => setScanLot(null)}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      {!activeTrip ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="typography-heading mb-1">Intake</h1>
              <p className="typography-body-sm text-[var(--ink-muted)]">
                Manage purchase trips and scan units into lots.
              </p>
            </div>
            {canCreate && (
              <Button onClick={() => setTripOpen(true)} data-testid="intake-create-trip">
                Create trip
              </Button>
            )}
          </div>

          {error && <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>}

          <Card>
            <CardHeader>
              <CardTitle>Trips</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {loading ? (
                <p className="text-sm text-[var(--ink-muted)]">Loading trips…</p>
              ) : trips.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted)]">No trips yet. Create your first trip to get started.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {trips.map((t) => {
                    const v = vendors.find((x) => x.uuid === t.vendorUuid);
                    return (
                      <li
                        key={t.uuid}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-sm"
                      >
                        <button
                          type="button"
                          className="border-none bg-transparent p-0 font-semibold text-primary hover:underline"
                          onClick={() => loadLots(t)}
                        >
                          {v ? v.name : 'Vendor'} &middot; {new Date(t.purchasedOn).toLocaleDateString()}
                        </button>
                        <span className="text-[var(--ink-muted)]">
                          Paid {formatPaise(Number(t.totalPaidPaise))}
                          {t.variancePaise != null && ` · Variance ${formatPaise(Number(t.variancePaise))}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Button variant="ghost" size="sm" onClick={goBack}>&larr; All trips</Button>
              <h1 className="typography-heading mb-1 mt-1">{vendorName || 'Trip'} &middot; {new Date(activeTrip.purchasedOn).toLocaleDateString()}</h1>
              <p className="typography-body-sm text-[var(--ink-muted)]">
                {activeTrip.billReference || 'No bill reference'} &middot; Paid{' '}
                {formatPaise(Number(activeTrip.totalPaidPaise))}
              </p>
            </div>
            {canCreate && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleCloneLot}>Clone last lot</Button>
                <Button onClick={() => { setLotPrefill(null); setLotOpen(true); }}>
                  Add lot
                </Button>
              </div>
            )}
          </div>

          {error && <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>}

          <Card>
            <CardHeader>
              <CardTitle>Lots</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {lotsLoading ? (
                <p className="text-sm text-[var(--ink-muted)]">Loading lots…</p>
              ) : lots.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted)]">No lots in this trip yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lots.map((lot) => {
                    const pt = productTypes.find((x) => x.uuid === lot.productTypeUuid);
                    return (
                      <li
                        key={lot.uuid}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-sm"
                      >
                        <div>
                          <div className="font-semibold">
                            {pt ? pt.name : 'Product'} &middot; qty {lot.quantity}
                          </div>
                          <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                            Buy {formatPaise(Number(lot.buyingPricePaise))} · Sell{' '}
                            {formatPaise(Number(lot.sellingPricePaise))} · Channel{' '}
                            <span className="capitalize">{lot.channel.toLowerCase()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {canCreate && (
                            <Button
                              size="sm"
                              onClick={() => { setScanLot(lot); }}
                              data-testid="intake-scan-lot"
                            >
                              Scan
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tripOpen && (
        <CreateTripDialog
          open={tripOpen}
          onClose={() => setTripOpen(false)}
          onSave={handleCreateTrip}
          saving={saving}
          vendors={vendors}
        />
      )}

      {lotOpen && (
        <CreateLotDialog
          open={lotOpen}
          onClose={() => setLotOpen(false)}
          onSave={handleCreateLot}
          saving={saving}
          productTypes={productTypes}
          prefill={lotPrefill}
          tripUuid={activeTrip.uuid}
        />
      )}
    </div>
  );
}

export default IntakeScreen;
