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
import '../admin/admin.css';
import './intake.css';

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
      <div className="admin-page">
        <p className="admin-muted">You do not have permission to view intake.</p>
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
    <div className="intake-page">
      {!activeTrip ? (
        <>
          <div className="intake-page__header">
            <div>
              <h1 className="typography-heading">Intake</h1>
              <p className="typography-body-sm intake-page__subtitle">
                Manage purchase trips and scan units into lots.
              </p>
            </div>
            {canCreate && (
              <Button onClick={() => setTripOpen(true)} data-testid="intake-create-trip">
                Create trip
              </Button>
            )}
          </div>

          {error && <div className="admin-error" role="alert">{error}</div>}

          <Card>
            <CardHeader>
              <CardTitle>Trips</CardTitle>
            </CardHeader>
            <CardContent className="intake-card__content">
              {loading ? (
                <p className="admin-muted">Loading trips…</p>
              ) : trips.length === 0 ? (
                <p className="admin-muted">No trips yet. Create your first trip to get started.</p>
              ) : (
                <ul className="intake-trip-list">
                  {trips.map((t) => {
                    const v = vendors.find((x) => x.uuid === t.vendorUuid);
                    return (
                      <li key={t.uuid} className="intake-trip-item">
                        <button
                          type="button"
                          className="intake-lot-link"
                          onClick={() => loadLots(t)}
                        >
                          {v ? v.name : 'Vendor'} &middot; {new Date(t.purchasedOn).toLocaleDateString()}
                        </button>
                        <span className="intake-unit-meta">
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
          <div className="intake-page__header">
            <div>
              <Button variant="ghost" size="sm" onClick={goBack}>&larr; All trips</Button>
              <h1 className="typography-heading">{vendorName || 'Trip'} &middot; {new Date(activeTrip.purchasedOn).toLocaleDateString()}</h1>
              <p className="typography-body-sm intake-page__subtitle">
                {activeTrip.billReference || 'No bill reference'} &middot; Paid{' '}
                {formatPaise(Number(activeTrip.totalPaidPaise))}
              </p>
            </div>
            {canCreate && (
              <div className="intake-header-actions">
                <Button variant="outline" onClick={handleCloneLot}>Clone last lot</Button>
                <Button onClick={() => { setLotPrefill(null); setLotOpen(true); }}>
                  Add lot
                </Button>
              </div>
            )}
          </div>

          {error && <div className="admin-error" role="alert">{error}</div>}

          <Card>
            <CardHeader>
              <CardTitle>Lots</CardTitle>
            </CardHeader>
            <CardContent className="intake-card__content">
              {lotsLoading ? (
                <p className="admin-muted">Loading lots…</p>
              ) : lots.length === 0 ? (
                <p className="admin-muted">No lots in this trip yet.</p>
              ) : (
                <ul className="intake-lot-list">
                  {lots.map((lot) => {
                    const pt = productTypes.find((x) => x.uuid === lot.productTypeUuid);
                    return (
                      <li key={lot.uuid} className="intake-lot-item">
                        <div>
                          <div className="intake-lot-title">
                            {pt ? pt.name : 'Product'} &middot; qty {lot.quantity}
                          </div>
                          <div className="intake-lot-meta">
                            Buy {formatPaise(Number(lot.buyingPricePaise))} · Sell{' '}
                            {formatPaise(Number(lot.sellingPricePaise))} · Channel{' '}
                            <span className="intake-lot-channel">{lot.channel.toLowerCase()}</span>
                          </div>
                        </div>
                        <div className="intake-actions">
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
