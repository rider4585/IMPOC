import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Dialog,
  useToast,
} from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
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

// UX-H4: variance is never colour alone — a sign glyph + explicit label rides
// alongside the money token.
function varianceGlyph(paise) {
  if (paise < 0) return { glyph: '↓', label: 'Var. loss', cls: 'text-[var(--money-out)]' };
  if (paise > 0) return { glyph: '↑', label: 'Var. gain', cls: 'text-[var(--money-in)]' };
  return { glyph: '±', label: 'Variance', cls: 'text-[var(--ink-muted)]' };
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
      } else if (response && typeof response === 'object' && 'items' in response) {
        setTrips(response.items);
      } else {
        setTrips([]);
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
      <div className="flex flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view trips.</p>
      </div>
    );
  }

  const canSubmitCreate = form.name.trim().length > 0 && !!form.purchasedOn;

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Trip',
      size: 300,
      cell: (info) => {
        const t = info.row.original;
        return (
          <Button
            variant="link"
            size="sm"
            className="px-0 text-left"
            onClick={() => navigate(`/trips/${t.uuid}`)}
            data-testid="trip-row"
          >
            {tripLabel(t)} &middot; {new Date(t.purchasedOn).toLocaleDateString()}
          </Button>
        );
      },
      enableColumnFilter: false,
      enableSorting: false,
    },
    {
      accessorKey: 'totalPaidPaise',
      header: 'Paid',
      size: 120,
      cell: (info) => (
        <span className="text-right text-xs font-medium text-[var(--ink)]">
          {formatPaise(Number(info.getValue()) || 0)}
        </span>
      ),
      enableColumnFilter: false,
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
      enableColumnFilter: false,
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 120,
      cell: (info) => (
        <div className="text-right">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/trips/${info.row.original.uuid}`)}
          >
            View
          </Button>
        </div>
      ),
      enableColumnFilter: false,
      enableSorting: false,
    },
  ], [navigate, tripLabel]);

  return (
    <div className="flex flex-col gap-5 p-6 overflow-hidden">
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

      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
        <DataGrid
          data={trips}
          columns={columns}
          isLoading={loading}
          isEmpty={trips.length === 0}
          emptyMessage="No trips yet. Create your first trip to get started."
          onRowClick={(row) => navigate(`/trips/${row.uuid}`)}
          className="flex-1"
        />
      </div>

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
