import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Badge,
  useToast,
} from '../../components/ui';
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
    if (!canUpdate) return;
    const next = !customer[key];
    try {
      const updated = await updateCustomerConsent(customer.uuid, channel, next);
      setCustomers((prev) => prev.map((c) => (c.uuid === customer.uuid ? { ...c, ...updated } : c)));
      toast.success({ title: `${next ? 'Consent granted' : 'Consent withdrawn'} (${channel.toLowerCase()})` });
    } catch (err) {
      toast.error({ title: 'Consent update failed', description: err.message });
    }
  };

  if (!canView) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view customers.</p>
      </div>
    );
  }

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

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-4 max-w-[360px]">
            <Input
              type="search"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search customers"
            />
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-[var(--surface-sunken)]" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No customers found.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Phone</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Consent</TableHeaderCell>
                  <TableHeaderCell>Purchases</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.uuid}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone || '—'}</TableCell>
                    <TableCell>{c.email || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {CONSENT_CHANNELS.map((cc) => {
                          const active = Boolean(c[cc.key]);
                          return (
                            <button
                              key={cc.channel}
                              type="button"
                              title={`${cc.label} consent: ${active ? 'on' : 'off'} (click to toggle)`}
                              disabled={!canUpdate}
                              onClick={() => handleToggleConsent(c, cc)}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                active
                                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                                  : 'bg-[var(--surface-sunken)] text-[var(--ink-faint)]'
                              } ${canUpdate ? 'hover:brightness-95' : 'cursor-not-allowed opacity-70'}`}
                            >
                              {cc.short}
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {typeof c.customerCount === 'number'
                        ? <Badge variant="neutral">{c.customerCount}</Badge>
                        : <span className="text-[var(--ink-faint)]">—</span>}
                    </TableCell>
                    <TableCell>
                      {canUpdate && (
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
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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