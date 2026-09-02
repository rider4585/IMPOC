import React, { useState } from 'react';
import { Dialog, Button, Input, Select, Card, CardContent } from '../../components/ui';
import { parseRupeesToPaise } from '../../platform/moneyInput.js';

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function CreateTripDialog({ open, onClose, onSave, saving, vendors }) {
  const [form, setForm] = useState({
    vendorUuid: '',
    purchasedOn: todayISO(),
    billReference: '',
    totalPaidPaise: '',
  });
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.vendorUuid) {
      setError('Please select a vendor.');
      return;
    }
    if (!form.purchasedOn) {
      setError('Please choose a purchase date.');
      return;
    }
    const totalPaidPaise = parseRupeesToPaise(form.totalPaidPaise);
    if (Number.isNaN(totalPaidPaise)) {
      setError('Total paid must be a valid rupee amount (e.g. 1299.50).');
      return;
    }
    onSave({
      vendorUuid: form.vendorUuid,
      purchasedOn: form.purchasedOn,
      billReference: form.billReference.trim() || null,
      totalPaidPaise,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create intake trip"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="trip-form" loading={saving}>
            Create trip
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id="trip-form" onSubmit={handleSubmit} className="admin-form">
            <Select label="Vendor" value={form.vendorUuid} onChange={set('vendorUuid')} required>
              <option value="">Select a vendor…</option>
              {vendors.map((v) => (
                <option key={v.uuid} value={v.uuid}>
                  {v.name}
                </option>
              ))}
            </Select>
            <Input
              label="Purchased on"
              type="date"
              value={form.purchasedOn}
              onChange={set('purchasedOn')}
              required
            />
            <Input
              label="Bill reference"
              value={form.billReference}
              onChange={set('billReference')}
              placeholder="Optional"
              maxLength={100}
            />
            <Input
              label="Total paid (₹)"
              value={form.totalPaidPaise}
              onChange={set('totalPaidPaise')}
              placeholder="e.g. 1299.50"
              inputMode="decimal"
              hint="Enter in rupees; stored as whole paise."
            />
            {error && (
              <div className="admin-error" role="alert">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export default CreateTripDialog;
