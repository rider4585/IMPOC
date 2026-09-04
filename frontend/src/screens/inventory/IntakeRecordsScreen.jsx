import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  Dialog,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getIntakeRecords, createIntakeRecord } from '../../services/intakeRecordsApi.js';
import { getVendors } from '../../services/vendorsApi.js';

export function IntakeRecordsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { permissions } = useAuth();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const [records, setRecords] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', purchasedOn: '', vendorUuid: '', notes: '' });

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getIntakeRecords();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load intake records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
    getVendors()
      .then((data) => setVendors(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [loadRecords]);

  if (!can(PERMISSIONS.INVENTORY.VIEW)) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">
          You do not have permission to view intake records.
        </p>
      </div>
    );
  }

  const openForm = () => {
    setForm({ name: '', purchasedOn: new Date().toISOString().split('T')[0], vendorUuid: '', notes: '' });
    setFormError('');
    setFormOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!form.purchasedOn) {
      setFormError('Date is required');
      return;
    }
    setSaving(true);
    try {
      const created = await createIntakeRecord({
        name: form.name.trim(),
        purchasedOn: form.purchasedOn,
        vendorUuid: form.vendorUuid || null,
        notes: form.notes || null,
      });
      toast.success({ title: 'Intake record created' });
      setFormOpen(false);
      if (created?.uuid) {
        navigate(`/intake-records/${created.uuid}`);
      } else {
        await loadRecords();
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Intake Records</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Dated buying events (shopping days). Each record holds templates of what was
            bought, and templates pre-fill the buying price when you scan stock.
          </p>
        </div>
        {can(PERMISSIONS.INVENTORY.CREATE) && (
          <Button onClick={openForm} data-testid="intake-records-create">
            New intake record
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-md bg-[var(--surface-sunken)]"
                />
              ))}
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">
              No intake records yet. Create one for each day you buy stock.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {records.map((r) => {
                const vendor = vendors.find((v) => v.uuid === r.vendorUuid);
                return (
                  <li
                    key={r.uuid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-white p-3 text-sm"
                  >
                    <button
                      type="button"
                      className="border-none bg-transparent p-0 text-left font-semibold text-primary hover:underline"
                      onClick={() => navigate(`/intake-records/${r.uuid}`)}
                      data-testid="intake-record-row"
                    >
                      {r.name}
                    </button>
                    <span className="text-[var(--ink-muted)]">
                      {new Date(r.purchasedOn + 'T00:00:00').toLocaleDateString()}
                      {vendor ? ` · ${vendor.name}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New intake record"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="intake-record-create-form" loading={saving}>
              Create record
            </Button>
          </>
        }
      >
        <form
          id="intake-record-create-form"
          onSubmit={handleCreate}
          className="flex flex-col gap-4"
        >
          <Input
            label="Name"
            placeholder="e.g. 1st Aug wholesale"
            value={form.name}
            onChange={set('name')}
            required
            maxLength={200}
          />
          <Input
            label="Purchased on"
            type="date"
            value={form.purchasedOn}
            onChange={set('purchasedOn')}
            required
          />
          <Select label="Vendor" value={form.vendorUuid} onChange={set('vendorUuid')}>
            <option value="">-- No vendor --</option>
            {vendors.map((v) => (
              <option key={v.uuid} value={v.uuid}>
                {v.name}
              </option>
            ))}
          </Select>
          <Input
            label="Notes"
            placeholder="Optional notes about this buying run"
            value={form.notes}
            onChange={set('notes')}
            maxLength={2000}
          />
          {formError && (
            <div
              className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]"
              role="alert"
            >
              {formError}
            </div>
          )}
        </form>
      </Dialog>
    </div>
  );
}

export default IntakeRecordsScreen;
