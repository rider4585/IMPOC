import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Dialog, useToast } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getTrips, createTrip } from '../../services/tripsApi.js';
import { getVendors } from '../../services/vendorsApi.js';
import { formatPaise } from '../../platform/money.js';

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function TripsScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);
  const canCreate = can(PERMISSIONS.INVENTORY.CREATE);

  const [trips, setTrips] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', purchasedOn: todayISO(), notes: '' });
  const [formError, setFormError] = useState('');

  const vendorName = useCallback(
    (uuid) => {
      const v = vendors.find((x) => x.uuid === uuid);
      return v ? v.name : 'Vendor';
    },
    [vendors]
  );

  const tripLabel = useCallback(
    (t) => {
      if (t.name) return t.name;
      const firstTv = Array.isArray(t.trip_vendors) ? t.trip_vendors[0] : null;
      const name = firstTv?.vendor?.name || vendorName(t.vendorUuid);
      const extra = Array.isArray(t.trip_vendors) && t.trip_vendors.length > 1
        ? ` +${t.trip_vendors.length - 1}`
        : '';
      return `${name}${extra}`;
    },
    [vendorName]
  );

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getTrips();
      if (Array.isArray(response)) {
        setTrips(response);
        setTotal(response.length);
      } else if (response && typeof response === 'object' && 'items' in response) {
        setTrips(response.items);
        setTotal(response.total);
      } else {
        setTrips([]);
        setTotal(0);
      }
    } catch (err) {
      setError(err.message || 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
    getVendors().then(setVendors).catch(() => {});
  }, [loadTrips]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    setFormError('');
    const name = form.name.trim();
    if (!name) { setFormError('Please enter a trip name.'); return; }
    if (!form.purchasedOn) { setFormError('Please choose a purchase date.'); return; }
    setSaving(true);
    try {
      const created = await createTrip({
        name,
        purchasedOn: form.purchasedOn,
        notes: form.notes.trim() || null,
        vendors: [],
      });
      toast.success({ title: 'Trip created' });
      setFormOpen(false);
      setForm({ name: '', purchasedOn: todayISO(), notes: '' });
      if (created?.uuid) {
        navigate(`/trips/${created.uuid}`);
      } else {
        await loadTrips();
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!can(PERMISSIONS.INVENTORY.VIEW)) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view trips.</p>
      </div>
    );
  }

  const canSubmitCreate = form.name.trim().length > 0 && !!form.purchasedOn;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Trips</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Buying trips, newest first. Each groups the vendors and stocks bought on one visit.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setFormOpen(true)} data-testid="trips-create">
            New trip
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All trips</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-[var(--surface-sunken)]" />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No trips yet. Create your first trip to get started.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {trips.slice((page - 1) * pageSize, page * pageSize).map((t) => (
                  <li
                    key={t.uuid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm"
                  >
                    <button
                      type="button"
                      className="border-none bg-transparent p-0 text-left font-semibold text-primary hover:underline"
                      onClick={() => navigate(`/trips/${t.uuid}`)}
                      data-testid="trip-row"
                    >
                      {tripLabel(t)} &middot; {new Date(t.purchasedOn).toLocaleDateString()}
                    </button>
                    <span className="text-[var(--ink-muted)]">
                      Paid {formatPaise(Number(t.totalPaidPaise))}
                      {t.variancePaise != null && (
                        <span className={Number(t.variancePaise) < 0 ? ' text-[var(--money-out)]' : Number(t.variancePaise) > 0 ? ' text-[var(--money-in)]' : ''}>
                          {' '}&middot; Variance {formatPaise(Number(t.variancePaise))}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {total > pageSize && (
                <div className="mt-3 flex items-center justify-between text-xs text-[var(--ink-muted)]">
                  <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                    <Button variant="outline" size="sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Create trip"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="trip-create-form" loading={saving} disabled={!canSubmitCreate}>Create trip</Button>
          </>
        }
      >
        <form id="trip-create-form" onSubmit={handleCreateTrip} className="flex flex-col gap-4">
          <Input label="Trip name" value={form.name} onChange={set('name')} placeholder="e.g. Delhi Akshardham trip" required maxLength={200} autoFocus />
          <Input label="Purchased on" type="date" value={form.purchasedOn} onChange={set('purchasedOn')} required />
          <Input label="Notes" value={form.notes} onChange={set('notes')} placeholder="Optional" maxLength={2000} />
          {formError && (
            <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{formError}</div>
          )}
        </form>
      </Dialog>
    </div>
  );
}

export default TripsScreen;
