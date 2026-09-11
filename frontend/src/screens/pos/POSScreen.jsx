import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  Select,
  Dialog,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getUnitByBarcode } from '../../services/unitsApi.js';
import { createSale } from '../../services/salesApi.js';
import { createRental } from '../../services/rentalsApi.js';
import { getPaymentMethods, getCustomerSources, getUpiAccounts } from '../../services/picklistsApi.js';
import { publishPosDisplayState } from '../../services/posDisplayApi.js';
import BarcodeScanner from '../../components/BarcodeScanner.jsx';
import { formatPaise } from '../../platform/money.js';
import { formatPaiseForInput, parseRupeesToPaise } from '../../platform/moneyInput.js';
import { createRequestKey } from '../../platform/requestKey.js';
import { buildUpiUri } from '../../platform/upi.js';
import { getOrCreateDisplayCode } from '../../platform/posDisplayCode.js';
import { CustomerPicker } from '../../components/customers/CustomerPicker.jsx';
import { ReceiptSection } from '../../components/receipts/ReceiptSection.jsx';
import { SaleReceipt } from './SaleReceipt.jsx';
import { PaymentDialog } from './PaymentDialog.jsx';
import { SHOP_NAME } from '../../components/ShopLogo.jsx';

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function itemTitle(item) {
  return item.stockName || `Item ${item.barcode}`;
}

function itemDetail(item) {
  const bits = [item.colourName, item.sizeName].filter(Boolean);
  return bits.length > 0 ? bits.join(' · ') : null;
}

// R-35: how long the Payment dialog's "Thank you" confirmation shows before
// the existing SaleReceipt is revealed.
const THANK_YOU_DELAY_MS = 450;

/**
 * SalePriceInput (R-30) — inline money editor for a cart line. Editing the
 * selling price re-renders the line so the till total updates live. A price
 * below the unit's floor price is refused inline and surfaced again at
 * checkout. Edits are not committed until the typed amount parses to a valid,
 * floor-legal rupee value, so a bad keystroke can never change the cart total.
 */
function SalePriceInput({ valuePaise, floorPaise, onChange, name }) {
  const [raw, setRaw] = useState(() => formatPaiseForInput(valuePaise));

  const commitParsed = (text) => {
    const parsed = parseRupeesToPaise(text);
    if (Number.isNaN(parsed)) {
      return { ok: false, message: 'Enter a valid rupee amount.' };
    }
    const floor = Number(floorPaise) || 0;
    if (parsed < floor) {
      return { ok: false, message: 'Price cannot be below floor price' };
    }
    return { ok: true, parsed };
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const result = commitParsed(raw);
    if (result.ok) onChange(result.parsed);
  };

  const handleBlur = () => {
    const result = commitParsed(raw);
    if (result.ok) onChange(result.parsed);
    setRaw(formatPaiseForInput(valuePaise));
  };

  const result = commitParsed(raw);
  const showError = !result.ok && raw.trim() !== '';

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        aria-label={
          showError
            ? `Selling price for ${name}. ${result.message}`
            : `Selling price for ${name}`
        }
        aria-invalid={showError || undefined}
        className={`w-28 rounded-md border bg-[var(--surface-sunken)] px-2 py-1 text-right font-semibold text-[var(--ink)] ${
          showError
            ? 'border-[var(--danger)] text-[var(--danger)]'
            : 'border-[var(--border-strong)] hover:border-[var(--ink-faint)]'
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`}
      />
      {showError && (
        <span role="alert" className="text-xs font-medium text-[var(--danger)]">{result.message}</span>
      )}
    </div>
  );
}

export function POSScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canCheckoutSale = can(PERMISSIONS.SALES.CREATE);
  const canCheckoutRental = can(PERMISSIONS.RENTALS.CREATE);

  const [mode, setMode] = useState('sale');

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const [customerSources, setCustomerSources] = useState([]);
  const [customerSource, setCustomerSource] = useState('');
  const [picklistsError, setPicklistsError] = useState('');

  const [upiAccounts, setUpiAccounts] = useState([]);
  const [selectedUpiAccountUuid, setSelectedUpiAccountUuid] = useState('');

  // R-35: display code is stable per terminal (persisted in localStorage).
  const [displayCode] = useState(() => getOrCreateDisplayCode());

  useEffect(() => {
    let cancelled = false;
    setPicklistsError('');
    getPaymentMethods()
      .then((methods) => {
        if (cancelled) return;
        setPaymentMethods(methods);
        if (methods.length > 0 && !methods.some((m) => m.name === paymentMethod)) {
          setPaymentMethod(methods[0].name);
        }
      })
      .catch((err) => {
        if (!cancelled) setPicklistsError(err.message || 'Failed to load payment methods.');
      });
    getCustomerSources()
      .then((sources) => {
        if (cancelled) return;
        setCustomerSources(sources);
      })
      .catch((err) => {
        if (!cancelled) setPicklistsError(err.message || 'Failed to load customer sources.');
      });
    getUpiAccounts()
      .then((accounts) => {
        if (cancelled) return;
        setUpiAccounts(accounts);
      })
      .catch((err) => {
        if (!cancelled) setPicklistsError(err.message || 'Failed to load UPI accounts.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UX-H7: manual Retry for a failed picklists fetch (surfaced via banner).
  const loadPicklists = useCallback(() => {
    setPicklistsError('');
    getPaymentMethods()
      .then((methods) => {
        setPaymentMethods(methods);
        if (methods.length > 0 && !methods.some((m) => m.name === paymentMethod)) {
          setPaymentMethod(methods[0].name);
        }
      })
      .catch((err) => setPicklistsError(err.message || 'Failed to load payment methods.'));
    getCustomerSources()
      .then((sources) => setCustomerSources(sources))
      .catch((err) => setPicklistsError(err.message || 'Failed to load customer sources.'));
    getUpiAccounts()
      .then((accounts) => setUpiAccounts(accounts))
      .catch((err) => setPicklistsError(err.message || 'Failed to load UPI accounts.'));
  }, [paymentMethod]);

  // Default the UPI account selector to the first active account once loaded.
  useEffect(() => {
    if (upiAccounts.length > 0 && !upiAccounts.some((a) => a.uuid === selectedUpiAccountUuid)) {
      setSelectedUpiAccountUuid(upiAccounts[0].uuid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upiAccounts]);

  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmClearTimerRef = useRef(null);

  const [scannerOpen, setScannerOpen] = useState(false);

  const [startDate, setStartDate] = useState(todayISO);
  const [rentalDays, setRentalDays] = useState('3');
  const [rentalNotes, setRentalNotes] = useState('');

  // R-35: two-step payment confirmation (sale mode only).
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState('confirm'); // 'confirm' | 'thankyou'
  const thankYouTimerRef = useRef(null);

  useEffect(() => () => {
    if (thankYouTimerRef.current) clearTimeout(thankYouTimerRef.current);
  }, []);

  // SEC-M-3 idempotency: one key per checkout intent, reused across retries of the same
  // intent (fresh key once the checkout succeeds or the cart is cleared).
  const checkoutKeyRef = useRef(null);

  const totalPaise = useMemo(() => {
    if (mode === 'sale') {
      return cart.reduce((sum, item) => sum + item.sellingPricePaise, 0);
    }
    return cart.reduce((sum, item) => sum + item.rentPerDayPaise * Number(rentalDays || 0), 0);
  }, [cart, mode, rentalDays]);

  // R-35: fire-and-forget publish to the customer-facing display channel — a
  // display update must never block or fail the actual checkout.
  const publishDisplay = useCallback(
    (state) => {
      publishPosDisplayState(displayCode, state).catch(() => {});
    },
    [displayCode]
  );

  const selectedUpiAccount = useMemo(
    () => upiAccounts.find((a) => a.uuid === selectedUpiAccountUuid) || upiAccounts[0] || null,
    [upiAccounts, selectedUpiAccountUuid]
  );

  const upiUri = useMemo(() => {
    if (paymentMethod !== 'UPI' || !selectedUpiAccount || !checkoutKeyRef.current) return null;
    return buildUpiUri({
      vpa: selectedUpiAccount.vpa,
      payee: SHOP_NAME,
      amountRupees: totalPaise / 100,
      note: `${SHOP_NAME} sale`,
      txnRef: checkoutKeyRef.current,
    });
    // paymentDialogOpen forces a recompute once the idempotency key is minted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, selectedUpiAccount, totalPaise, paymentDialogOpen]);

  const displayUrl = useMemo(
    () => `${window.location.origin}/display/${displayCode}`,
    [displayCode]
  );

  // Mirror the payment step to the customer-facing display whenever the
  // dialog is open in the confirm step (an amount/method/QR change re-publishes).
  useEffect(() => {
    if (!paymentDialogOpen || paymentStep !== 'confirm') return;
    if (paymentMethod === 'UPI' && !upiUri) return;
    publishDisplay({
      status: 'awaiting',
      method: paymentMethod === 'UPI' ? 'UPI' : 'Cash',
      amountPaise: totalPaise,
      upiUri: paymentMethod === 'UPI' ? upiUri : undefined,
    });
  }, [paymentDialogOpen, paymentStep, paymentMethod, totalPaise, upiUri, publishDisplay]);

  const addByBarcode = useCallback(
    async (value) => {
      const b = String(value || '').trim();
      if (!b) return;
      setLookupError('');
      setBarcode('');
      setLookupLoading(true);
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
              stockName: unit.stockName || null,
              colourName: unit.colourName || null,
              sizeName: unit.sizeName || null,
              sellingPricePaise: Number(unit.sellingPricePaise),
              floorPricePaise: Number(unit.floorPricePaise) || 0,
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
              stockName: unit.stockName || null,
              colourName: unit.colourName || null,
              sizeName: unit.sizeName || null,
              rentPerDayPaise: Number(unit.rentPerDayPaise),
              depositPaise: Number(unit.depositPaise),
            },
          ]);
        }
        toast.success({ title: `Added ${unit.stockName || `Item ${unit.barcode}`}` });
      } catch (err) {
        setLookupError(err.message || 'Lookup failed');
        toast.error({ title: 'Lookup failed', description: err.message });
      } finally {
        setLookupLoading(false);
      }
    },
    [cart, mode, toast]
  );

  const handleScannerDetected = useCallback(
    (value) => {
      setScannerOpen(false);
      addByBarcode(value);
    },
    [addByBarcode]
  );

  const removeItem = (uuid) => {
    setCart((prev) => prev.filter((item) => item.uuid !== uuid));
  };

  // R-30: reflect an edited per-unit selling price immediately in the total.
  const updateItemPrice = (uuid, paise) => {
    setCart((prev) =>
      prev.map((item) => (item.uuid === uuid ? { ...item, sellingPricePaise: paise } : item))
    );
  };

  const resetPaymentMethodToDefault = (methods) => {
    if (methods.length > 0 && !methods.some((m) => m.name === 'Cash')) {
      setPaymentMethod(methods[0].name);
    } else {
      setPaymentMethod('Cash');
    }
  };

  const clearCart = () => {
    if (confirmClearTimerRef.current) clearTimeout(confirmClearTimerRef.current);
    confirmClearTimerRef.current = null;
    if (thankYouTimerRef.current) clearTimeout(thankYouTimerRef.current);
    thankYouTimerRef.current = null;
    setConfirmClear(false);
    setCart([]);
    setCustomer(null);
    setBarcode('');
    setReceipt(null);
    setLookupError('');
    setStartDate(todayISO());
    setRentalDays('3');
    setRentalNotes('');
    setCustomerSource('');
    checkoutKeyRef.current = null;
    setPaymentDialogOpen(false);
    setPaymentStep('confirm');
    publishDisplay({ status: 'idle' });
    resetPaymentMethodToDefault(paymentMethods);
  };

  // UX-M5: destructive Clear needs a lightweight 3s re-tap confirm.
  const handleClearClick = () => {
    if (cart.length === 0) {
      setConfirmClear(false);
      return;
    }
    if (!confirmClear) {
      setConfirmClear(true);
      if (confirmClearTimerRef.current) clearTimeout(confirmClearTimerRef.current);
      confirmClearTimerRef.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    clearCart();
  };

  /**
   * R-35: Checkout (sale mode) opens the Payment dialog instead of creating
   * the sale immediately. The sale is created only in handleMarkReceived.
   */
  const openPayment = () => {
    if (cart.length === 0) return;
    const belowFloor = cart.find((item) => item.sellingPricePaise < item.floorPricePaise);
    if (belowFloor) {
      toast.error({
        title: 'Price below floor',
        description: `Price cannot be below floor price for ${belowFloor.barcode}.`,
      });
      return;
    }
    if (paymentMethod === 'UPI' && upiAccounts.length === 0) {
      toast.error({
        title: 'No UPI account',
        description: 'Add a UPI account in Picklists to accept UPI.',
      });
      return;
    }
    if (!checkoutKeyRef.current) {
      checkoutKeyRef.current = createRequestKey();
    }
    setPaymentStep('confirm');
    setPaymentDialogOpen(true);
  };

  const handleCancelPayment = () => {
    setPaymentDialogOpen(false);
    setPaymentStep('confirm');
    publishDisplay({ status: 'idle' });
    // checkoutKeyRef intentionally kept (SEC-M-3): re-opening reuses the same intent.
  };

  /**
   * R-35: Mark received — creates the sale (moved from the old handleCheckout),
   * then shows a brief Thank you step before revealing the existing SaleReceipt.
   */
  const handleMarkReceived = async () => {
    setCheckingOut(true);
    try {
      const customerPayload = {
        customerName: customer?.name || undefined,
        customerUuid: customer?.uuid,
        paymentMethod: paymentMethod || undefined,
        customerSource: customerSource || undefined,
      };
      const sale = await createSale({
        ...customerPayload,
        requestUuid: checkoutKeyRef.current,
        items: cart.map((item) => ({
          unitUuid: item.uuid,
          sellingPricePaise: item.sellingPricePaise,
        })),
      });

      // R-42c: first name only (single token) for the display's spoken thank-you.
      const customerFirstName = customer?.name?.trim().split(/\s+/)[0] || undefined;
      publishDisplay({ status: 'received', customerFirstName });
      setPaymentStep('thankyou');
      toast.success({ title: 'Checkout complete' });

      thankYouTimerRef.current = setTimeout(() => {
        setReceipt(sale);
        setPaymentDialogOpen(false);
        setPaymentStep('confirm');
        setCart([]);
        setCustomer(null);
        setBarcode('');
        setCustomerSource('');
        checkoutKeyRef.current = null;
        resetPaymentMethodToDefault(paymentMethods);
      }, THANK_YOU_DELAY_MS);
    } catch (err) {
      toast.error({ title: 'Checkout failed', description: err.message });
    } finally {
      setCheckingOut(false);
    }
  };

  /**
   * Rental checkout — unchanged by R-35 (rental mode keeps the single-step
   * "Check out rental" flow).
   */
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    if (!checkoutKeyRef.current) {
      checkoutKeyRef.current = createRequestKey();
    }
    try {
      const customerPayload = {
        customerName: customer?.name || undefined,
        customerUuid: customer?.uuid,
        paymentMethod: paymentMethod || undefined,
        customerSource: customerSource || undefined,
      };
      const days = Number(rentalDays);
      if (!Number.isInteger(days) || days <= 0) {
        toast.error({ title: 'Invalid days', description: 'Rental days must be a positive number.' });
        setCheckingOut(false);
        return;
      }
      const agreement = await createRental({
        ...customerPayload,
        requestUuid: checkoutKeyRef.current,
        startDate: startDate || undefined,
        rentalDays: days,
        notes: rentalNotes.trim() || undefined,
        items: cart.map((item) => ({ unitUuid: item.uuid })),
      });
      setReceipt(agreement);
      setCart([]);
      setCustomer(null);
      setBarcode('');
      setStartDate(todayISO());
      setRentalDays('3');
      setRentalNotes('');
      setCustomerSource('');
      checkoutKeyRef.current = null;
      resetPaymentMethodToDefault(paymentMethods);
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
        {/*
          UX-M5: sticky "New transaction" so a fresh sale is always one tap away.
          The scroll container is AppShell's <main> which carries p-4/sm:p-6.
          A plain `top-0` pins the bar at the INNER edge of that padding, leaving
          a 16-24px band above it where scrolling content bleeds through. Offset
          `top` by main's padding so the bar sticks flush to main's top border and
          its background covers that band (values mirror main's p-4 / sm:p-6).
        */}
        <div className="sticky top-[-16px] z-10 -mx-6 -mt-1 mb-1 flex justify-end bg-[var(--surface-base)] px-6 pb-2 pt-3 sm:top-[-24px]">
          <Button onClick={() => setReceipt(null)} data-testid="pos-new-transaction">
            New transaction
          </Button>
        </div>
        {mode === 'sale' ? (
          <SaleReceipt sale={receipt} />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Receipt — {receipt.agreementNumber}</CardTitle>
              </CardHeader>
            <CardContent className="p-4">
              <div className="mb-2 text-sm text-[var(--ink-muted)]">
                <p>
                  {receipt.customerName ? `${receipt.customerName} · ` : ''}
                  {receipt.startDate} → due {receipt.dueDate} · {receipt.status}
                </p>
                {(receipt.customerMobile || (receipt.customer && (receipt.customer.phone || receipt.customer.email))) && (
                  <p className="mt-1 text-xs">
                    {receipt.customerMobile || receipt.customer?.phone || ''}
                    {[(receipt.customerMobile || receipt.customer?.phone), receipt.customer?.email]
                      .filter(Boolean)
                      .length > 1
                      ? ' · '
                      : ''}
                    {receipt.customer?.email}
                  </p>
                )}
                {receipt.paymentMethod && <p className="mt-1 text-xs">Payment · {receipt.paymentMethod}</p>}
              </div>
              <ul className="flex flex-col gap-2">
                {receipt.lines.map((line) => (
                  <li key={line.uuid} className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm">
                    <span className="font-semibold">{line.barcode}</span>
                    <span className="text-[var(--ink-muted)]">
                      {formatPaise(Number(line.rentPerDayPaise))}/day &middot; deposit {formatPaise(Number(line.depositPaise))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-lg">
                <span>Deposit collected</span>
                <strong className="typography-money">{formatPaise(Number(receipt.depositRefundablePaise))}</strong>
              </div>
            </CardContent>
          </Card>
            <ReceiptSection
              entityType="RENTAL"
              entityUuid={receipt.uuid}
              printTitle={`Print receipt — ${receipt.agreementNumber}`}
            />
          </>
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
                ? 'bg-[var(--surface-raised)] text-[var(--ink)] shadow-sm'
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
                ? 'bg-[var(--surface-raised)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => { setMode('rental'); clearCart(); }}
          >
            Rental
          </button>
        </div>
      </div>

      {lookupError && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{lookupError}</div>
      )}

      {picklistsError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
          <span>{picklistsError} Payment method and source may be incomplete.</span>
          <Button variant="outline" size="sm" onClick={loadPicklists}>
            Retry
          </Button>
        </div>
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
                disabled={lookupLoading}
              />
              {lookupLoading && (
                <p className="mt-2 flex items-center gap-2 text-sm text-[var(--ink-muted)]" role="status">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--primary)]" aria-hidden="true" />
                  Looking up barcode…
                </p>
              )}
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => setScannerOpen(true)}
                data-testid="pos-scan-open"
              >
                Scan barcode with camera
              </Button>
            </CardContent>
          </Card>

          <Dialog
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            title="Scan barcode"
            footer={
              <Button variant="outline" onClick={() => setScannerOpen(false)}>
                Close
              </Button>
            }
          >
            <div
              className="relative mx-auto w-full max-w-sm overflow-hidden rounded-lg"
              style={{ aspectRatio: '3/4', maxHeight: '60vh' }}
            >
              <BarcodeScanner onDetected={handleScannerDetected} />
            </div>
            <p className="mt-3 text-center text-xs text-[var(--ink-muted)]">
              Point the camera at a product barcode. A detected item is added to the cart automatically.
            </p>
          </Dialog>

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
                      className="flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm sm:flex-row sm:items-center sm:gap-3"
                    >
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">{itemTitle(item)}</span>
                        <span className="block text-xs text-[var(--ink-muted)]">
                          {item.barcode}
                          {itemDetail(item) && <span> · {itemDetail(item)}</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:contents">
                        <span className="whitespace-nowrap sm:ml-auto">
                          {mode === 'sale' ? (
                            <SalePriceInput
                              valuePaise={item.sellingPricePaise}
                              floorPaise={item.floorPricePaise}
                              name={item.barcode}
                              onChange={(paise) => updateItemPrice(item.uuid, paise)}
                            />
                          ) : (
                            <span className="typography-money-sm text-right text-[var(--ink-muted)]">
                              {formatPaise(item.rentPerDayPaise)}/day · deposit {formatPaise(item.depositPaise)}
                            </span>
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.uuid)}
                          aria-label={`Remove ${item.barcode}`}
                          className="shrink-0"
                        >
                          <Trash2 className="h-4 w-4 sm:hidden" aria-hidden="true" />
                          <span className="hidden sm:inline">Remove</span>
                        </Button>
                      </div>
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
              <CustomerPicker value={customer} onChange={setCustomer} />
              <Select
                label="Payment method"
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={paymentMethods.map((method) => ({ value: method.name, label: method.name }))}
                dataTestid="pos-payment-method"
                className="mt-3"
              />
              <Select
                label="How did the customer hear about us?"
                value={customerSource}
                onChange={setCustomerSource}
                options={[
                  { value: '', label: 'Not selected / Walk-in' },
                  ...customerSources.map((source) => ({ value: source.name, label: source.name })),
                ]}
                dataTestid="pos-customer-source"
                className="mt-3"
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
              <div className="mt-4 flex items-end justify-between border-t border-[var(--border)] pt-3">
                <span className="text-sm text-[var(--ink-muted)]">Total</span>
                <span className="typography-money-lg" data-testid="pos-total">
                  {mode === 'sale'
                    ? formatPaise(totalPaise)
                    : `${formatPaise(totalPaise)} (${rentalDays || 0} days)`}
                </span>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
              <Button
                variant={confirmClear ? 'danger' : 'outline'}
                onClick={handleClearClick}
                disabled={cart.length === 0}
                data-testid="pos-clear"
              >
                {confirmClear ? 'Confirm clear?' : 'Clear'}
              </Button>
              <Button
                onClick={mode === 'sale' ? openPayment : handleCheckout}
                loading={mode === 'rental' && checkingOut}
                disabled={cart.length === 0}
                data-testid="pos-checkout"
              >
                {mode === 'sale'
                  ? (canCheckoutSale ? 'Checkout' : 'No permission')
                  : (canCheckoutRental ? 'Check out rental' : 'No permission')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {mode === 'sale' && (
        <PaymentDialog
          open={paymentDialogOpen}
          step={paymentStep}
          paymentMethod={paymentMethod}
          totalPaise={totalPaise}
          upiAccounts={upiAccounts}
          selectedUpiAccountUuid={selectedUpiAccount?.uuid || ''}
          onSelectUpiAccount={setSelectedUpiAccountUuid}
          upiUri={upiUri}
          confirming={checkingOut}
          onMarkReceived={handleMarkReceived}
          onCancel={handleCancelPayment}
          displayCode={displayCode}
          displayUrl={displayUrl}
        />
      )}
    </div>
  );
}

export default POSScreen;
