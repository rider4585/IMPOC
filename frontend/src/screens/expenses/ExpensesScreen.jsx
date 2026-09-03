import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
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
import { ExpenseFormDialog } from './ExpenseFormDialog.jsx';
import '../admin/admin.css';
import './expenses.css';

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
        await createExpense(payload);
        toast.success({ title: 'Expense recorded' });
      }
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
      await cancelExpense(cancelling.uuid, cancelReason.trim() || undefined);
      toast.success({ title: 'Expense cancelled' });
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
      <div className="admin-page">
        <p className="admin-muted">You do not have permission to view expenses.</p>
      </div>
    );
  }

  return (
    <div className="expenses-page">
      <div className="expenses-page__header">
        <div>
          <h1 className="typography-heading">Expenses</h1>
          <p className="typography-body-sm expenses-page__subtitle">
            Record and track shop expenses.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="expenses-create">
            Record expense
          </Button>
        )}
      </div>

      {error && <div className="admin-error" role="alert">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Expense list</CardTitle>
        </CardHeader>
        <CardContent className="expenses-card__content">
          <div className="expenses-filter">
            <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              {STATUS_FILTERS.filter((s) => s !== 'all').map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Select
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Input
              label="Date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="admin-muted">Loading expenses…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-muted">No expenses match this view.</p>
          ) : (
            <ul className="expenses-list">
              {filtered.map((e) => (
                <li key={e.uuid} className="expenses-item">
                  <div>
                    <div className="expenses-item__title">{e.category}</div>
                    <div className="expenses-item__meta">
                      {e.expenseDate} · {e.purpose || 'No purpose'}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </div>
                    {e.reversals && e.reversals.length > 0 && (
                      <div className="expenses-item__meta">
                        Reversals: {e.reversals.map((r) => `${r.reversalType} (${formatPaise(Number(r.amountPaise))})`).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="expenses-item__right">
                    <Badge variant={e.status === 'cancelled' ? 'neutral' : 'success'}>{e.status}</Badge>
                    <strong>{formatPaise(Number(e.amountPaise))}</strong>
                    {e.status !== 'cancelled' && canUpdate && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => { setEditing(e); setFormOpen(true); }}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setCancelling(e); setCancelReason(''); }}>
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
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={handleSave}
          saving={saving}
          expense={editing}
        />
      )}

      {cancelling && (
        <Dialog
          open={Boolean(cancelling)}
          onClose={() => setCancelling(null)}
          title="Cancel expense"
          footer={
            <>
              <Button variant="outline" onClick={() => setCancelling(null)} disabled={saving}>
                Keep
              </Button>
              <Button variant="danger" onClick={handleCancel} loading={saving}>
                Cancel expense
              </Button>
            </>
          }
        >
          <p className="admin-muted">
            This records a reversing row for {formatPaise(Number(cancelling.amountPaise))} and marks the expense cancelled. It cannot be undone.
          </p>
          <div className="admin-form">
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
