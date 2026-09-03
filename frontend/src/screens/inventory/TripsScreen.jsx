import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, useToast } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getStockIntakes, createStockIntake } from '../../services/intakeApi.js';
import { getVendors } from '../../services/vendorsApi.js';
import { formatPaise } from '../../platform/money.js';
import { parseRupeesToPaise } from '../../platform/moneyInput.js';

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
  const [form, setForm] = useState({ vendorUuid: '', purchasedOn: todayISO(), billReference: '', totalPaidPaise: '' });
  const [formError, setFormError] = useState('');

  const vendorName = useCallback(
    (uuid) => {
      const v = vendors.find((x) => x.uuid === uuid);
      return v ? v.name : 'Vendor';
    },
    [vendors]
  );

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getStockIntakes();
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
    if (!form.vendorUuid) { setFormError('Please select a vendor.'); return; }
    if (!form.purchasedOn) { setFormError('Please choose a purchase date.'); return; }
    const totalPaidPaise = parseRupeesToPaise(form.totalPaidPaise);
    if (Number.isNaN(totalPaidPaise)) { setFormError('Total paid must be a valid rupee amount.'); return; }
    setSaving(true);
    try {
      const created = await createStockIntake({
        vendorUuid: form.vendorUuid,
        purchasedOn: form.purchasedOn,
        billReference: form.billReference.trim() || null,
        totalPaidPaise,
      });
      toast.success({ title: 'Trip created' });
      setFormOpen(false);
      setForm({ vendorUuid: '', purchasedOn: todayISO(), billReference: '', totalPaidPaise: '' });
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

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Trips</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Buying trips, newest first. Each ties lots to a vendor visit.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setFormOpen(true)} data-testid="trips-create">
            New trip
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
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
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-white p-3 text-sm"
                  >
                    <button
                      type="button"
                      className="border-none bg-transparent p-0 text-left font-semibold text-primary hover:underline"
                      onClick={() => navigate(`/trips/${t.uuid}`)}
                      data-testid="trip-row"
                    >
                      {vendorName(t.vendorUuid)} &middot; {new Date(t.purchasedOn).toLocaleDateString()}
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

      {formOpen && (
        <div className="relative z-50" role="dialog" aria-modal="true" aria-label="Create trip">
          <div className="fixed inset-0 bg-black/50" onClick={() => setFormOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--border)] bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold leading-none tracking-tight">Create trip</h2>
              <button type="button" className="rounded-sm text-[var(--ink-muted)] hover:text-[var(--ink)]" onClick={() => setFormOpen(false)} aria-label="Close">
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <form id="trip-create-form" onSubmit={handleCreateTrip} className="flex flex-col gap-4">
              <Select label="Vendor" value={form.vendorUuid} onChange={set('vendorUuid')} required>
                <option value="">Select a vendor…</option>
                {vendors.filter((v) => v.isActive !== false).map((v) => (
                  <option key={v.uuid} value={v.uuid}>{v.name}</option>
                ))}
              </Select>
              <Input label="Purchased on" type="date" value={form.purchasedOn} onChange={set('purchasedOn')} required />
              <Input label="Bill reference" value={form.billReference} onChange={set('billReference')} placeholder="Optional" maxLength={100} />
              <Input label="Total paid (₹)" value={form.totalPaidPaise} onChange={set('totalPaidPaise')} placeholder="e.g. 14400" inputMode="decimal" hint="Enter in rupees; stored as whole paise." />
              {formError && (
                <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{formError}</div>
              )}
            </form>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" form="trip-create-form" loading={saving}>Create trip</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TripsScreen;
