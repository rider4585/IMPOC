import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, Button, Select } from '../../components/ui';
import { formatPaise } from '../../platform/money.js';

/**
 * PaymentDialog (R-35) — the two-step Checkout confirmation.
 *
 * step 'confirm': shows the amount (+ UPI QR when paymentMethod is 'UPI') and
 * Mark received / Cancel. The sale is created only when the caller's
 * onMarkReceived resolves successfully — this component never talks to the
 * API itself.
 * step 'thankyou': a brief confirmation; the caller reveals the receipt.
 */
export function PaymentDialog({
  open,
  step,
  paymentMethod,
  totalPaise,
  upiAccounts = [],
  selectedUpiAccountUuid,
  onSelectUpiAccount,
  upiUri,
  confirming,
  onMarkReceived,
  onCancel,
  displayCode,
  displayUrl,
}) {
  const isUpi = paymentMethod === 'UPI';
  const noActiveUpiAccount = isUpi && upiAccounts.length === 0;

  return (
    <Dialog
      open={open}
      onClose={step === 'confirm' ? onCancel : undefined}
      title={step === 'thankyou' ? undefined : 'Payment'}
      footer={
        step === 'confirm' ? (
          <>
            <Button variant="outline" onClick={onCancel} disabled={confirming}>
              Cancel
            </Button>
            <Button
              onClick={onMarkReceived}
              loading={confirming}
              disabled={noActiveUpiAccount}
              data-testid="payment-mark-received"
            >
              Mark received
            </Button>
          </>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait">
        {step === 'thankyou' ? (
          <motion.div
            key="thankyou"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-8 text-center"
            data-testid="payment-thankyou"
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success)]/15 text-[var(--success)]"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h3 className="typography-heading">Thank you!</h3>
            <p className="typography-body-sm text-[var(--ink-muted)]">Payment received.</p>
          </motion.div>
        ) : (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col items-center gap-1 py-1">
              <span className="text-sm text-[var(--ink-muted)]">Amount</span>
              <span className="typography-money-lg" data-testid="payment-amount">
                {formatPaise(totalPaise)}
              </span>
            </div>

            {isUpi && upiAccounts.length > 1 && (
              <Select
                label="UPI account"
                value={selectedUpiAccountUuid}
                onChange={onSelectUpiAccount}
                options={upiAccounts.map((a) => ({ value: a.uuid, label: `${a.label} — ${a.vpa}` }))}
                dataTestid="payment-upi-account"
              />
            )}

            {isUpi && upiUri && (
              <div className="flex flex-col items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
                <QRCodeSVG value={upiUri} size={200} data-testid="payment-upi-qr" />
                <p className="text-center text-sm font-medium text-[var(--ink)]">
                  Scan to pay {formatPaise(totalPaise)}
                </p>
              </div>
            )}

            {noActiveUpiAccount && (
              <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
                No active UPI account configured. Add one in Picklists &gt; UPI accounts to accept UPI.
              </div>
            )}

            {!isUpi && (
              <p className="text-center text-sm text-[var(--ink-muted)]">
                Collect the cash payment, then tap Mark received.
              </p>
            )}

            {displayCode && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3 text-xs text-[var(--ink-muted)]">
                <div>
                  <p className="font-medium text-[var(--ink)]">Customer display</p>
                  <p>Code {displayCode}{displayUrl ? ` — ${displayUrl}` : ''}</p>
                </div>
                {displayUrl && <QRCodeSVG value={displayUrl} size={56} />}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

export default PaymentDialog;
