import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button, Input, Badge, Tabs, Tab, useToast } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  listEnquiries,
  createEnquiry,
  updateEnquiry,
  closeEnquiry,
  reopenEnquiry,
} from '../../services/enquiriesApi.js';
import { EnquiryFormDialog } from './EnquiryFormDialog.jsx';
import { CloseEnquiryDialog, CHANNEL_LABELS } from './CloseEnquiryDialog.jsx';

const TABS = [
  { key: 'OPEN', label: 'Open' },
  { key: 'CLOSED', label: 'Closed' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function ageLabel(createdAt) {
  if (!createdAt) return '—';
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/** "Saree · Red · M" — the structured part of the ask, if any. */
export function wantedSummary(enquiry) {
  return [enquiry.productType?.name, enquiry.colour?.name, enquiry.size?.name].filter(Boolean).join(' · ');
}

/**
 * EnquiriesScreen — the counter's list of "do you have X?" asks (R-63).
 * Open = still waiting. Closing has two outcomes: tell the customer it's
 * available (tap-to-send links) or close quietly.
 */
export function EnquiriesScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canView = can(PERMISSIONS.ENQUIRIES.VIEW);
  const canCreate = can(PERMISSIONS.ENQUIRIES.CREATE);
  const canUpdate = can(PERMISSIONS.ENQUIRIES.UPDATE);

  const [tab, setTab] = useState('OPEN');
  const [enquiries, setEnquiries] = useState([]);
  const [counts, setCounts] = useState({ OPEN: 0, CLOSED: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [closing, setClosing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyUuid, setBusyUuid] = useState(null);

  const debounceRef = useRef(null);

  const load = useCallback(async (status, term) => {
    setLoading(true);
    setError('');
    try {
      const data = await listEnquiries({ status, search: term });
      setEnquiries(data.enquiries);
      setCounts(data.counts);
    } catch (err) {
      setError(err.message || 'Failed to load enquiries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load(tab, search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [canView, tab, search, load]);

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        await updateEnquiry(editing.uuid, payload);
        toast.success({ title: 'Enquiry updated' });
      } else {
        await createEnquiry(payload);
        toast.success({ title: 'Enquiry logged' });
      }
      setFormOpen(false);
      setEditing(null);
      await load(tab, search);
    } catch (err) {
      toast.error({ title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Returns the server result so the dialog can show the tap-to-send links;
  // the dialog stays open for those, and closes itself for a quiet close.
  const handleClose = async ({ notify, channels, note }) => {
    if (!closing) return null;
    setSaving(true);
    try {
      const result = await closeEnquiry(closing.uuid, { notify, channels, note });
      toast.success({ title: notify ? 'Closed — message ready to send' : 'Enquiry closed' });
      if (!notify || result.handoffs.length === 0) {
        setClosing(null);
      }
      await load(tab, search);
      return result;
    } catch (err) {
      toast.error({ title: 'Close failed', description: err.message });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async (enquiry) => {
    setBusyUuid(enquiry.uuid);
    try {
      await reopenEnquiry(enquiry.uuid);
      toast.success({ title: 'Enquiry reopened' });
      await load(tab, search);
    } catch (err) {
      toast.error({ title: 'Reopen failed', description: err.message });
    } finally {
      setBusyUuid(null);
    }
  };

  const today = todayISO();

  const columns = useMemo(() => {
    const base = [
      {
        id: 'customer',
        header: 'Customer',
        size: 180,
        accessorFn: (row) => row.customer?.name || '',
        filter: { type: 'text' },
        cell: (info) => {
          const c = info.row.original.customer;
          return (
            <div className="min-w-0">
              <div className="truncate font-medium">{c?.name || '—'}</div>
              {(c?.phone || c?.email) && (
                <div className="truncate text-xs text-[var(--ink-muted)]">{c.phone || c.email}</div>
              )}
            </div>
          );
        },
      },
      {
        id: 'wanted',
        header: 'Looking for',
        size: 280,
        accessorFn: (row) => `${wantedSummary(row)} ${row.description}`,
        filter: { type: 'text' },
        cell: (info) => {
          const e = info.row.original;
          const summary = wantedSummary(e);
          return (
            <div className="min-w-0">
              {summary && <div className="truncate text-xs font-medium text-[var(--ink-muted)]">{summary}</div>}
              <div className="whitespace-normal">{e.description}</div>
            </div>
          );
        },
      },
    ];

    if (tab === 'OPEN') {
      base.push({
        accessorKey: 'promisedDate',
        header: 'Promised by',
        size: 140,
        cell: (info) => {
          const value = info.getValue();
          if (!value) return <span className="text-[var(--ink-faint)]">—</span>;
          const overdue = value < today;
          return (
            <span className="inline-flex items-center gap-2">
              {formatDate(value)}
              {overdue && <Badge variant="danger">Overdue</Badge>}
            </span>
          );
        },
      });
    } else {
      base.push({
        accessorKey: 'closedReason',
        header: 'Closed as',
        size: 200,
        cell: (info) => {
          const e = info.row.original;
          const told = info.getValue() === 'NOTIFIED';
          const via = (e.notifiedChannels || []).map((c) => CHANNEL_LABELS[c] || c).join(', ');
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={told ? 'success' : 'neutral'}>{told ? 'Customer told' : 'Closed quietly'}</Badge>
                {told && via && <span className="text-xs text-[var(--ink-muted)]">{via}</span>}
              </div>
              {e.closedNote && <div className="truncate text-xs text-[var(--ink-muted)]">{e.closedNote}</div>}
            </div>
          );
        },
      });
    }

    base.push(
      {
        accessorKey: 'createdAt',
        header: 'Age',
        size: 100,
        cell: (info) => (
          <span title={new Date(info.getValue()).toLocaleString()}>{ageLabel(info.getValue())}</span>
        ),
      },
      {
        accessorKey: 'createdBy',
        header: 'Taken by',
        size: 120,
        cell: (info) => info.getValue() || '—',
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 170,
        enableSorting: false,
        cell: (info) => {
          const e = info.row.original;
          if (!canUpdate) return null;
          if (e.status === 'CLOSED') {
            return (
              <Button variant="outline" size="sm" loading={busyUuid === e.uuid} onClick={() => handleReopen(e)}>
                Reopen
              </Button>
            );
          }
          return (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(e);
                  setFormOpen(true);
                }}
              >
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setClosing(e)} data-testid={`enquiry-close-${e.uuid}`}>
                Close
              </Button>
            </div>
          );
        },
      }
    );
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canUpdate, busyUuid, today]);

  if (!canView) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px] flex-col gap-5 p-6 overflow-hidden">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view enquiries.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px] flex-col gap-5 p-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Enquiries</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            What customers asked for that we did not have. Close each one when it is sorted.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            data-testid="enquiry-create"
          >
            Log enquiry
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}

      <div className="border-b border-[var(--border)] pb-2">
        <Tabs aria-label="Enquiry status">
          {TABS.map((t) => (
            <Tab key={t.key} id={`enquiry-tab-${t.key}`} active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
              <span className="ml-2 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs text-[var(--ink-muted)]">
                {counts[t.key] ?? 0}
              </span>
            </Tab>
          ))}
        </Tabs>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="max-w-[360px]">
          <Input
            type="search"
            placeholder="Search by customer, phone, or what they wanted…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search enquiries"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
          <DataGrid
            data={enquiries}
            columns={columns}
            isLoading={loading}
            isEmpty={enquiries.length === 0}
            emptyMessage={tab === 'OPEN' ? 'No open enquiries.' : 'No closed enquiries.'}
            loadingMessage="Loading enquiries…"
            className="flex-1"
          />
        </div>
      </div>

      {formOpen && (
        <EnquiryFormDialog
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
          saving={saving}
          enquiry={editing}
        />
      )}

      {closing && (
        <CloseEnquiryDialog
          open={Boolean(closing)}
          onClose={() => setClosing(null)}
          onConfirm={handleClose}
          saving={saving}
          enquiry={closing}
        />
      )}
    </div>
  );
}

export default EnquiriesScreen;
