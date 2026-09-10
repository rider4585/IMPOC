import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  SearchableSelect,
  Dialog,
  Badge,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  listExpenses,
  createExpense,
  updateExpense,
  cancelExpense,
} from '../../services/expensesApi.js';
import { formatPaise } from '../../platform/money.js';
import { createRequestKey } from '../../platform/requestKey.js';
import { ExpenseFormDialog } from './ExpenseFormDialog.jsx';

const STATUS_FILTERS = ['all', 'completed', 'cancelled'];

export function ExpensesScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canView = can(PERMISSIONS.EXPENSES.VIEW);
  const canCreate = can(PERMISSIONS.EXPENSES.CREATE);
  const canUpdate = can(PERMISSIONS.EXPENSES.UPDATE);

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [saving, setSaving] = useState(false);

  // SEC-M-3 idempotency: one key per action intent (create / cancel), reused across retries
  // of the same intent until it succeeds or its dialog is closed (fresh key on a new intent).
  const saveKeyRef = useRef(null);
  const cancelKeyRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listExpenses();
      setExpenses(data);
    } catch (err) {
      setError(err.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  const categories = useMemo(() => {
    const set = new Set();
    expenses.forEach((e) => set.add(e.category));
    return Array.from(set).sort();
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (dateFilter && e.expenseDate !== dateFilter) return false;
      return true;
    });
  }, [expenses, statusFilter, categoryFilter, dateFilter]);

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        await updateExpense(editing.uuid, {
          category: payload.category,
          purpose: payload.purpose,
          expenseDate: payload.expenseDate,
          notes: payload.notes,
        });
        toast.success({ title: 'Expense updated' });
      } else {
        await createExpense({ ...payload, requestUuid: saveKeyRef.current });
        toast.success({ title: 'Expense recorded' });
      }
      saveKeyRef.current = null;
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error({ title: editing ? 'Update failed' : 'Create failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setSaving(true);
    try {
      await cancelExpense(cancelling.uuid, cancelReason.trim() || undefined, {
        requestUuid: cancelKeyRef.current,
      });
      toast.success({ title: 'Expense cancelled' });
      cancelKeyRef.current = null;
      setCancelling(null);
      setCancelReason('');
      await load();
    } catch (err) {
      toast.error({ title: 'Cancel failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view expenses.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Expenses</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Record and track shop expenses.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => { saveKeyRef.current = createRequestKey(); setEditing(null); setFormOpen(true); }}
            data-testid="expenses-create"
          >
            Record expense
          </Button>
        )}
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            Retry
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expense list</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchableSelect
              label="Status"
              className="min-w-[160px]"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All' },
                ...STATUS_FILTERS.filter((s) => s !== 'all').map((s) => ({ value: s, label: s })),
              ]}
            />
            <SearchableSelect
              label="Category"
              className="min-w-[160px]"
              value={categoryFilter}
              onChange={setCategoryFilter}
              searchPlaceholder="Search categories…"
              emptyMessage="No categories yet."
              options={[
                { value: '', label: 'All categories' },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
            />
            <Input
              label="Date"
              type="date"
              className="min-w-[160px]"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-[var(--surface-sunken)]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No expenses match this view.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((e) => (
                <li
                  key={e.uuid}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-sm"
                >
                  <div>
                    <div className="font-semibold">{e.category}</div>
                    <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                      {e.expenseDate} · {e.purpose || 'No purpose'}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </div>
                    {e.reversals && e.reversals.length > 0 && (
                      <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                        Reversals: {e.reversals.map((r) => `${r.reversalType} (${formatPaise(Number(r.amountPaise))})`).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={e.status === 'cancelled' ? 'neutral' : 'success'}>{e.status}</Badge>
                    <strong>{formatPaise(Number(e.amountPaise))}</strong>
                    {e.status !== 'cancelled' && canUpdate && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => { setEditing(e); setFormOpen(true); }}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { cancelKeyRef.current = createRequestKey(); setCancelling(e); setCancelReason(''); }}>
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <ExpenseFormDialog
          open={formOpen}
          onClose={() => { saveKeyRef.current = null; setFormOpen(false); setEditing(null); }}
          onSave={handleSave}
          saving={saving}
          expense={editing}
        />
      )}

      {cancelling && (
        <Dialog
          open={Boolean(cancelling)}
          onClose={() => { cancelKeyRef.current = null; setCancelling(null); }}
          title="Cancel expense"
          footer={
            <>
              <Button variant="outline" onClick={() => { cancelKeyRef.current = null; setCancelling(null); }} disabled={saving}>
                Keep
              </Button>
              <Button variant="danger" onClick={handleCancel} loading={saving}>
                Cancel expense
              </Button>
            </>
          }
        >
          <p className="text-sm text-[var(--ink-muted)]">
            This records a reversing row for {formatPaise(Number(cancelling.amountPaise))} and marks the expense cancelled. It cannot be undone.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <Input
              label="Reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Optional"
              maxLength={2000}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default ExpensesScreen;
