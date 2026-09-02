import React, { useState } from 'react';
import { Dialog, Button, Input, Select, Card, CardContent } from '../../components/ui';
import { CHANNEL } from '../../constants/channel.js';
import { formatPaiseForInput, parseRupeesToPaise } from '../../platform/moneyInput.js';

function rupeeOrEmpty(paise) {
  if (paise == null || Number.isNaN(Number(paise))) return '';
  return formatPaiseForInput(Number(paise));
}

export function CreateLotDialog({ open, onClose, onSave, saving, productTypes, prefill, tripUuid }) {
  const [form, setForm] = useState(() => ({
    productTypeUuid: prefill?.productTypeUuid || '',
    quantity: prefill?.quantity != null ? String(prefill.quantity) : '1',
    buyingPricePaise: rupeeOrEmpty(prefill?.buyingPricePaise),
    sellingPricePaise: rupeeOrEmpty(prefill?.sellingPricePaise),
    floorPricePaise: rupeeOrEmpty(prefill?.floorPricePaise),
    channel: prefill?.channel || CHANNEL.RETAIL,
    rentPerDayPaise: rupeeOrEmpty(prefill?.rentPerDayPaise),
    depositPaise: rupeeOrEmpty(prefill?.depositPaise),
    overduePerDayPaise: rupeeOrEmpty(prefill?.overduePerDayPaise),
  }));
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!form.productTypeUuid) {
      setError('Please select a product type.');
      return;
    }

    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Quantity must be a whole number of at least 1.');
      return;
    }

    const buying = parseRupeesToPaise(form.buyingPricePaise);
    const selling = parseRupeesToPaise(form.sellingPricePaise);
    const floor = parseRupeesToPaise(form.floorPricePaise);
    if ([buying, selling, floor].some(Number.isNaN)) {
      setError('Buying, selling and floor prices must be valid rupee amounts.');
      return;
    }
    if (floor > selling) {
      setError('Floor price cannot exceed selling price.');
      return;
    }

    const isRental = form.channel === CHANNEL.RENTAL;
    if (isRental) {
      const rent = parseRupeesToPaise(form.rentPerDayPaise);
      const deposit = parseRupeesToPaise(form.depositPaise);
      const overdue = parseRupeesToPaise(form.overduePerDayPaise);
      if ([rent, deposit, overdue].some(Number.isNaN)) {
        setError('Rent per day, deposit and overdue per day are required for RENTAL.');
        return;
      }
      if (overdue <= rent) {
        setError('Overdue per day must be greater than rent per day.');
        return;
      }
      onSave({
        tripUuid,
        productTypeUuid: form.productTypeUuid,
        quantity,
        buyingPricePaise: buying,
        sellingPricePaise: selling,
        floorPricePaise: floor,
        channel: form.channel,
        rentPerDayPaise: rent,
        depositPaise: deposit,
        overduePerDayPaise: overdue,
      });
    } else {
      onSave({
        tripUuid,
        productTypeUuid: form.productTypeUuid,
        quantity,
        buyingPricePaise: buying,
        sellingPricePaise: selling,
        floorPricePaise: floor,
        channel: form.channel,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={prefill?.prefilled ? 'Add lot (cloned from last lot)' : 'Add lot'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="lot-form" loading={saving}>
            Save lot
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id="lot-form" onSubmit={handleSubmit} className="admin-form">
            <Select label="Product type" value={form.productTypeUuid} onChange={set('productTypeUuid')} required>
              <option value="">Select a product type…</option>
              {productTypes.map((t) => (
                <option key={t.uuid} value={t.uuid}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Input
              label="Quantity"
              type="number"
              min={1}
              step={1}
              value={form.quantity}
              onChange={set('quantity')}
              required
            />
            <Input
              label="Buying price (₹)"
              value={form.buyingPricePaise}
              onChange={set('buyingPricePaise')}
              inputMode="decimal"
              required
            />
            <Input
              label="Selling price (₹)"
              value={form.sellingPricePaise}
              onChange={set('sellingPricePaise')}
              inputMode="decimal"
              required
            />
            <Input
              label="Floor price (₹)"
              value={form.floorPricePaise}
              onChange={set('floorPricePaise')}
              inputMode="decimal"
              required
              hint="Cannot exceed selling price."
            />
            <Select label="Channel" value={form.channel} onChange={set('channel')} required>
              <option value={CHANNEL.RETAIL}>Retail</option>
              <option value={CHANNEL.RENTAL}>Rental</option>
            </Select>

            {form.channel === CHANNEL.RENTAL && (
              <>
                <Input
                  label="Rent per day (₹)"
                  value={form.rentPerDayPaise}
                  onChange={set('rentPerDayPaise')}
                  inputMode="decimal"
                  required
                />
                <Input
                  label="Deposit (₹)"
                  value={form.depositPaise}
                  onChange={set('depositPaise')}
                  inputMode="decimal"
                  required
                />
                <Input
                  label="Overdue per day (₹)"
                  value={form.overduePerDayPaise}
                  onChange={set('overduePerDayPaise')}
                  inputMode="decimal"
                  required
                  hint="Must be greater than rent per day."
                />
              </>
            )}

            {error && (
              <div className="admin-error" role="alert">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export default CreateLotDialog;
