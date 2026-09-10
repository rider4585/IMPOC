import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Button,
  Input,
  Badge,
  useToast,
} from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  searchCustomers,
  createCustomer,
  updateCustomer,
  updateCustomerConsent,
} from '../../services/customersApi.js';
import { CustomerFormDialog } from './CustomerFormDialog.jsx';

const CONSENT_CHANNELS = [
  { key: 'consentWhatsapp', channel: 'WHATSAPP', short: 'W', label: 'WhatsApp' },
  { key: 'consentEmail', channel: 'EMAIL', short: 'E', label: 'Email' },
  { key: 'consentSms', channel: 'SMS', short: 'S', label: 'SMS' },
  { key: 'consentWhatsappGroup', channel: 'WHATSAPP_GROUP', short: 'G', label: 'WhatsApp group' },
];

export function CustomersScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canView = can(PERMISSIONS.CUSTOMERS.VIEW);
  const canCreate = can(PERMISSIONS.CUSTOMERS.CREATE);
  const canUpdate = can(PERMISSIONS.CUSTOMERS.UPDATE);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // UX-M8: in-flight guard so a rapid double-click can't fire two consent toggles.
  const [consentBusy, setConsentBusy] = useState(false);

  const debounceRef = useRef(null);

  const load = useCallback(async (term) => {
    setLoading(true);
    setError('');
    try {
      const data = await searchCustomers(term);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [canView, search, load]);

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        await updateCustomer(editing.uuid, payload);
        toast.success({ title: 'Customer updated' });
      } else {
        await createCustomer(payload);
        toast.success({ title: 'Customer created' });
      }
      setFormOpen(false);
      await load(search);
    } catch (err) {
      toast.error({ title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleConsent = async (customer, { channel, key }) => {
    if (!canUpdate || consentBusy) return;
    const next = !customer[key];
    setConsentBusy(true);
    try {
      const updated = await updateCustomerConsent(customer.uuid, channel, next);
      setCustomers((prev) => prev.map((c) => (c.uuid === customer.uuid ? { ...c, ...updated } : c)));
      toast.success({ title: `${next ? 'Consent granted' : 'Consent withdrawn'} (${channel.toLowerCase()})` });
    } catch (err) {
      toast.error({ title: 'Consent update failed', description: err.message });
    } finally {
      setConsentBusy(false);
    }
  };

  if (!canView) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px] flex-col gap-5 p-6 overflow-hidden">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view customers.</p>
      </div>
    );
  }

  const dgColumns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 160,
      filter: { type: 'text' },
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      size: 140,
      filter: { type: 'text' },
      cell: (info) => info.getValue() || '—',
    },
    {
      accessorKey: 'email',
      header: 'Email',
      size: 180,
      filter: { type: 'text' },
      cell: (info) => info.getValue() || '—',
    },
    {
      id: 'consent',
      header: 'Consent',
      size: 180,
      cell: (info) => {
        const c = info.row.original;
        return (
          <div className="flex flex-wrap gap-1">
            {CONSENT_CHANNELS.map((cc) => {
              const active = Boolean(c[cc.key]);
              return (
                <button
                  key={cc.channel}
                  type="button"
                  title={`${cc.label} consent: ${active ? 'on' : 'off'} (click to toggle)`}
                  disabled={!canUpdate || consentBusy}
                  onClick={() => handleToggleConsent(c, cc)}
                  className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ${
                    active
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'bg-[var(--surface-sunken)] text-[var(--ink-faint)]'
                  } ${canUpdate && !consentBusy ? 'hover:brightness-95' : 'cursor-not-allowed opacity-70'}`}
                >
                  {cc.short}
                </button>
              );
            })}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'customerCount',
      header: 'Purchases',
      size: 110,
      cell: (info) => {
        const count = info.getValue();
        return typeof count === 'number'
          ? <Badge variant="neutral">{count}</Badge>
          : <span className="text-[var(--ink-faint)]">—</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 120,
      cell: (info) => {
        const c = info.row.original;
        return canUpdate ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(c);
              setFormOpen(true);
            }}
          >
            Edit
          </Button>
        ) : null;
      },
      enableSorting: false,
    },
  ], [canUpdate, consentBusy]);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Customers</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Manage customer contacts and receipt/offer consent.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            data-testid="customer-create"
          >
            Create customer
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}

      <div className="flex flex-col gap-4">
        <div className="max-w-[360px]">
          <Input
            type="search"
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search customers"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
          <DataGrid
            data={customers}
            columns={dgColumns}
            isLoading={loading}
            isEmpty={customers.length === 0}
            emptyMessage="No customers found."
            loadingMessage="Loading customers…"
          />
        </div>
      </div>

      {formOpen && (
        <CustomerFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          saving={saving}
          customer={editing}
        />
      )}
    </div>
  );
}

export default CustomersScreen;