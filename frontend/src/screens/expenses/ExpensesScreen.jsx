import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Button,
  Input,
  Dialog,
  Badge,
  useToast,
  ActionMenu,
} from '../../components/ui/index.js';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
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

  const columns = useMemo(() => [
    {
      accessorKey: 'category',
      header: 'Category',
      size: 160,
      filter: { type: 'picklist' },
      cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
    },
    {
      accessorKey: 'expenseDate',
      header: 'Date',
      size: 110,
      filter: { type: 'date' },
    },
    {
      accessorKey: 'purpose',
      header: 'Purpose',
      size: 260,
      filter: { type: 'text' },
      enableSorting: false,
      cell: (info) => {
        const e = info.row.original;
        return (
          <div>
            <div>{e.purpose || 'No purpose'}</div>
            {e.notes && <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">{e.notes}</div>}
            {e.reversals && e.reversals.length > 0 && (
              <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                Reversals: {e.reversals.map((r) => `${r.reversalType} (${formatPaise(Number(r.amountPaise))})`).join(', ')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 110,
      filter: { type: 'picklist' },
      cell: (info) => (
        <Badge variant={info.getValue() === 'cancelled' ? 'neutral' : 'success'}>{info.getValue()}</Badge>
      ),
    },
    {
      accessorKey: 'amountPaise',
      header: 'Amount',
      size: 130,
      filter: { type: 'number' },
      cell: (info) => (
        <strong className="text-[var(--ink)]">{formatPaise(Number(info.getValue()))}</strong>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 130,
      enableSorting: false,
      cell: (info) => {
        const e = info.row.original;
        if (e.status === 'cancelled' || !canUpdate) return null;
        return (
          <ActionMenu
            primary={{
              label: 'Edit',
              onClick: () => {
                setEditing(e);
                setFormOpen(true);
              },
              dataTestid: `expense-edit-${e.uuid}`,
            }}
            items={[
              {
                label: 'Cancel',
                onClick: () => {
                  cancelKeyRef.current = createRequestKey();
                  setCancelling(e);
                  setCancelReason('');
                },
                danger: true,
                dataTestid: `expense-cancel-${e.uuid}`,
              },
            ]}
            dataTestid={`expense-actions-${e.uuid}`}
          />
        );
      },
    },
  ], [canUpdate]);

  if (!canView) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view expenses.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px] flex-col gap-5 p-6 overflow-hidden">
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
        <DataGrid
          data={expenses}
          columns={columns}
          isLoading={loading}
          isEmpty={expenses.length === 0}
          emptyMessage="No expenses match this view."
          loadingMessage="Loading expenses…"
          className="flex-1"
        />
      </div>

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
