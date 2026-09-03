import React, { useState } from 'react';
import { Dialog, Button, Input, Card, CardContent, useToast } from '../../components/ui';
import { getUnitByBarcode } from '../../services/unitsApi.js';
import { formatPaise } from '../../platform/money.js';

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function RentalCreateDialog({ open, onClose, onSave, saving }) {
  const toast = useToast();
  const [form, setForm] = useState({
    customerName: '',
    startDate: todayISO(),
    rentalDays: '3',
    notes: '',
  });
  const [barcode, setBarcode] = useState('');
  const [items, setItems] = useState([]);
  const [lookupError, setLookupError] = useState('');
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAddByBarcode = async () => {
    const b = String(barcode || '').trim();
    if (!b) return;
    setLookupError('');
    setBarcode('');
    try {
      const unit = await getUnitByBarcode(b);
      if (!unit) {
        setLookupError(`No unit found with barcode "${b}".`);
        return;
      }
      if (unit.channel !== 'RENTAL') {
        setLookupError('This unit is a retail item and cannot be rented.');
        return;
      }
      if (unit.status !== 'in_stock') {
        setLookupError(`Unit "${b}" is currently "${unit.status}" and not available to rent.`);
        return;
      }
      if (items.some((i) => i.uuid === unit.uuid)) {
        setLookupError('Unit is already in the list.');
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          uuid: unit.uuid,
          barcode: unit.barcode,
          rentPerDayPaise: Number(unit.rentPerDayPaise),
          depositPaise: Number(unit.depositPaise),
          overduePerDayPaise: Number(unit.overduePerDayPaise),
        },
      ]);
      toast.success({ title: `Added ${unit.barcode}` });
    } catch (err) {
      setLookupError(err.message || 'Lookup failed');
    }
  };

  const removeItem = (uuid) => {
    setItems((prev) => prev.filter((i) => i.uuid !== uuid));
  };

  const handleClose = () => {
    setItems([]);
    setBarcode('');
    setLookupError('');
    setError('');
    setForm({
      customerName: '',
      startDate: todayISO(),
      rentalDays: '3',
      notes: '',
    });
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('Add at least one rentable unit.');
      return;
    }
    const days = Number(form.rentalDays);
    if (!Number.isInteger(days) || days <= 0) {
      setError('Rental days must be a positive whole number.');
      return;
    }
    onSave({
      customerName: form.customerName.trim() || undefined,
      startDate: form.startDate || undefined,
      rentalDays: days,
      notes: form.notes.trim() || undefined,
      items: items.map((i) => ({ unitUuid: i.uuid })),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="New rental agreement"
      className="rentals-create-dialog"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="rental-form" loading={saving}>
            Check out
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id="rental-form" onSubmit={handleSubmit} className="admin-form">
            <Input
              label="Customer name"
              value={form.customerName}
              onChange={set('customerName')}
              placeholder="Optional"
              maxLength={255}
            />
            <div className="rentals-add-item">
              <Input
                label="Scan or enter barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddByBarcode();
                  }
                }}
                placeholder="RENTAL unit barcode"
                maxLength={12}
              />
              <Button variant="outline" onClick={handleAddByBarcode}>
                Add
              </Button>
            </div>
            {lookupError && (
              <div className="admin-error" role="alert">{lookupError}</div>
            )}

            {items.length > 0 && (
              <ul className="rentals-cart">
                {items.map((i) => (
                  <li key={i.uuid} className="rentals-cart-item">
                    <span className="intake-unit-barcode">{i.barcode}</span>
                    <span className="rentals-cart-price">
                      {formatPaise(i.rentPerDayPaise)}/day · deposit {formatPaise(i.depositPaise)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(i.uuid)} aria-label={`Remove ${i.barcode}`}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="intake-inline-form">
              <Input
                label="Start date"
                type="date"
                value={form.startDate}
                onChange={set('startDate')}
                required
              />
              <Input
                label="Rental days"
                type="number"
                min={1}
                value={form.rentalDays}
                onChange={set('rentalDays')}
                required
              />
            </div>
            <Input
              label="Notes"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Optional"
              maxLength={2000}
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

export default RentalCreateDialog;
