import React, { useState } from 'react';
import { Dialog, Button, Input, Card, CardContent } from '../../components/ui';
import { parseRupeesToPaise } from '../../platform/moneyInput.js';

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function ExpenseFormDialog({ open, onClose, onSave, saving, expense }) {
  const isEdit = Boolean(expense);
  const [form, setForm] = useState({
    amountInput: expense ? `${Number(expense.amountPaise) / 100}` : '',
    category: expense?.category || '',
    purpose: expense?.purpose || '',
    expenseDate: expense?.expenseDate || todayISO(),
    notes: expense?.notes || '',
  });
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.category.trim()) {
      setError('Category is required.');
      return;
    }
    let amountPaise;
    if (!isEdit) {
      amountPaise = parseRupeesToPaise(form.amountInput);
      if (Number.isNaN(amountPaise)) {
        setError('Amount must be a valid rupee amount (e.g. 1299.50).');
        return;
      }
    }
    onSave({
      amountPaise,
      category: form.category.trim(),
      purpose: form.purpose.trim() || undefined,
      expenseDate: form.expenseDate || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Edit expense' : 'Record expense'}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Record expense'}
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id="expense-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Amount (₹)"
              value={form.amountInput}
              onChange={set('amountInput')}
              placeholder="e.g. 499.00"
              inputMode="decimal"
              disabled={isEdit}
              hint={isEdit ? 'Amount cannot change once recorded.' : undefined}
              required={!isEdit}
            />
            <Input
              label="Category"
              value={form.category}
              onChange={set('category')}
              placeholder="e.g. Rent, Utilities, Repairs"
              maxLength={100}
              required
            />
            <Input
              label="Purpose"
              value={form.purpose}
              onChange={set('purpose')}
              placeholder="Optional"
              maxLength={2000}
            />
            <Input
              label="Expense date"
              type="date"
              value={form.expenseDate}
              onChange={set('expenseDate')}
            />
            <Input
              label="Notes"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Optional"
              maxLength={2000}
            />
            {error && (
              <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export default ExpenseFormDialog;
