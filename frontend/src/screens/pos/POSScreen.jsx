import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getUnitByBarcode } from '../../services/unitsApi.js';
import { createSale } from '../../services/salesApi.js';
import { createRental } from '../../services/rentalsApi.js';
import { formatPaise } from '../../platform/money.js';
import { SaleReceipt } from './SaleReceipt.jsx';

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function POSScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canCheckoutSale = can(PERMISSIONS.SALES.CREATE);
  const canCheckoutRental = can(PERMISSIONS.RENTALS.CREATE);

  const [mode, setMode] = useState('sale');

  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [lookupError, setLookupError] = useState('');

  const [startDate, setStartDate] = useState(todayISO);
  const [rentalDays, setRentalDays] = useState('3');
  const [rentalNotes, setRentalNotes] = useState('');

  const totalPaise = useMemo(() => {
    if (mode === 'sale') {
      return cart.reduce((sum, item) => sum + item.sellingPricePaise, 0);
    }
    return cart.reduce((sum, item) => sum + item.rentPerDayPaise * Number(rentalDays || 0), 0);
  }, [cart, mode, rentalDays]);

  const addByBarcode = useCallback(
    async (value) => {
      const b = String(value || '').trim();
      if (!b) return;
      setLookupError('');
      setBarcode('');
      try {
        const unit = await getUnitByBarcode(b);
        if (!unit) {
          setLookupError(`No unit found with barcode "${b}".`);
          toast.error({ title: 'Not found', description: `No unit with barcode "${b}".` });
          return;
        }
        if (mode === 'sale') {
          if (unit.channel !== 'RETAIL') {
            toast.error({ title: 'Not sellable', description: 'This unit is a rental item and cannot be sold.' });
            return;
          }
          if (unit.status !== 'in_stock') {
            toast.error({ title: 'Not in stock', description: `Unit "${b}" is currently "${unit.status}".` });
            return;
          }
          if (cart.some((item) => item.uuid === unit.uuid)) {
            toast.warning({ title: 'Already in cart' });
            return;
          }
          setCart((prev) => [
            ...prev,
            {
              uuid: unit.uuid,
              barcode: unit.barcode,
              sellingPricePaise: Number(unit.sellingPricePaise),
            },
          ]);
        } else {
          if (unit.channel !== 'RENTAL') {
            toast.error({ title: 'Not rentable', description: 'This unit is a retail item and cannot be rented.' });
            return;
          }
          if (unit.status !== 'in_stock') {
            toast.error({ title: 'Not in stock', description: `Unit "${b}" is currently "${unit.status}".` });
            return;
          }
          if (cart.some((item) => item.uuid === unit.uuid)) {
            toast.warning({ title: 'Already in cart' });
            return;
          }
          setCart((prev) => [
            ...prev,
            {
              uuid: unit.uuid,
              barcode: unit.barcode,
              rentPerDayPaise: Number(unit.rentPerDayPaise),
              depositPaise: Number(unit.depositPaise),
            },
          ]);
        }
        toast.success({ title: `Added ${unit.barcode}` });
      } catch (err) {
        setLookupError(err.message || 'Lookup failed');
        toast.error({ title: 'Lookup failed', description: err.message });
      }
    },
    [cart, mode, toast]
  );

  const removeItem = (uuid) => {
    setCart((prev) => prev.filter((item) => item.uuid !== uuid));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setBarcode('');
    setReceipt(null);
    setLookupError('');
    setStartDate(todayISO());
    setRentalDays('3');
    setRentalNotes('');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      if (mode === 'sale') {
        const sale = await createSale({
          customerName: customerName.trim() || undefined,
          items: cart.map((item) => ({ unitUuid: item.uuid })),
        });
        setReceipt(sale);
      } else {
        const days = Number(rentalDays);
        if (!Number.isInteger(days) || days <= 0) {
          toast.error({ title: 'Invalid days', description: 'Rental days must be a positive number.' });
          setCheckingOut(false);
          return;
        }
        const agreement = await createRental({
          customerName: customerName.trim() || undefined,
          startDate: startDate || undefined,
          rentalDays: days,
          notes: rentalNotes.trim() || undefined,
          items: cart.map((item) => ({ unitUuid: item.uuid })),
        });
        setReceipt(agreement);
      }
      setCart([]);
      setCustomerName('');
      setBarcode('');
      setStartDate(todayISO());
      setRentalDays('3');
      setRentalNotes('');
      toast.success({ title: 'Checkout complete' });
    } catch (err) {
      toast.error({ title: 'Checkout failed', description: err.message });
    } finally {
      setCheckingOut(false);
    }
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      addByBarcode(barcode);
    }
  };

  if (receipt) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        {mode === 'sale' ? (
          <SaleReceipt sale={receipt} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Receipt — {receipt.agreementNumber}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="mb-2 text-sm text-[var(--ink-muted)]">
                {receipt.customerName ? `${receipt.customerName} · ` : ''}
                {receipt.startDate} → due {receipt.dueDate} · {receipt.status}
              </p>
              <ul className="flex flex-col gap-2">
                {receipt.lines.map((line) => (
                  <li key={line.uuid} className="flex items-center justify-between rounded-md border border-[var(--border)] bg-white p-3 text-sm">
                    <span className="font-semibold">{line.barcode}</span>
                    <span className="text-[var(--ink-muted)]">
                      {formatPaise(Number(line.rentPerDayPaise))}/day · deposit {formatPaise(Number(line.depositPaise))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-lg">
                <span>Deposit collected</span>
                <strong>{formatPaise(Number(receipt.depositRefundablePaise))}</strong>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="flex justify-end">
          <Button onClick={() => setReceipt(null)}>New transaction</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Point of Sale</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            {mode === 'sale'
              ? 'Scan or look up sellable units, then checkout.'
              : 'Scan or look up rentable units, then check out a rental agreement.'}
          </p>
        </div>
        <div className="flex rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] p-0.5">
          <button
            type="button"
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'sale'
                ? 'bg-white text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => { setMode('sale'); clearCart(); }}
          >
            Sale
          </button>
          <button
            type="button"
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'rental'
                ? 'bg-white text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => { setMode('rental'); clearCart(); }}
          >
            Rental
          </button>
        </div>
      </div>

      {lookupError && (
        <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{lookupError}</div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] items-start">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Add items</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Input
                label="Scan or enter barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Scan barcode, then press Enter"
                autoFocus
                maxLength={12}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cart ({cart.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {cart.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted)]">Cart is empty. Scan or enter a barcode to add items.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cart.map((item) => (
                    <li
                      key={item.uuid}
                      className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-white p-3 text-sm"
                    >
                      <span className="font-semibold">{item.barcode}</span>
                      <span className="ml-auto text-[var(--ink-muted)]">
                        {mode === 'sale'
                          ? formatPaise(item.sellingPricePaise)
                          : `${formatPaise(item.rentPerDayPaise)}/day · deposit ${formatPaise(item.depositPaise)}`}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(item.uuid)} aria-label={`Remove ${item.barcode}`}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{mode === 'sale' ? 'Checkout' : 'Rental checkout'}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Input
                label="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional"
              />
              {mode === 'rental' && (
                <>
                  <Input
                    label="Start date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                  <Input
                    label="Rental days"
                    type="number"
                    min={1}
                    value={rentalDays}
                    onChange={(e) => setRentalDays(e.target.value)}
                    required
                  />
                  <Input
                    label="Notes"
                    value={rentalNotes}
                    onChange={(e) => setRentalNotes(e.target.value)}
                    placeholder="Optional"
                    maxLength={2000}
                  />
                </>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-lg">
                <span>Total</span>
                <strong data-testid="pos-total">
                  {mode === 'sale'
                    ? formatPaise(totalPaise)
                    : `${formatPaise(totalPaise)} (${rentalDays || 0} days)`}
                </strong>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
              <Button variant="outline" onClick={clearCart} disabled={cart.length === 0}>
                Clear
              </Button>
              <Button
                onClick={handleCheckout}
                loading={checkingOut}
                disabled={cart.length === 0}
                data-testid="pos-checkout"
              >
                {mode === 'sale'
                  ? (canCheckoutSale ? 'Charge' : 'No permission')
                  : (canCheckoutRental ? 'Check out rental' : 'No permission')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default POSScreen;
