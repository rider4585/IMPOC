import React, { useState, useEffect } from 'react';
import { Dialog, Button } from '../ui';
import { getReceiptPrint } from '../../services/receiptApi.js';

/**
 * ReceiptPrintDialog — loads the plain-text printer receipt (GET /receipts/print)
 * and shows it in a printer-friendly monospace dialog. "Print" triggers
 * window.print with @media print CSS that hides everything but the receipt.
 */
export function ReceiptPrintDialog({ open, onClose, entityType, entityUuid, title = 'Print receipt' }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !entityUuid) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setText('');
    getReceiptPrint(entityType, entityUuid)
      .then((data) => {
        if (!cancelled) setText(data?.text || '');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load receipt');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityType, entityUuid]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>
          <Button onClick={handlePrint} disabled={loading || Boolean(error) || !text}>
            Print
          </Button>
        </>
      }
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print-area, .receipt-print-area * { visibility: visible; }
          .receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      {loading ? (
        <p className="text-sm text-[var(--ink-muted)]">Loading receipt…</p>
      ) : error ? (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      ) : (
        <pre
          className="receipt-print-area max-h-[60vh] overflow-auto whitespace-pre rounded-md border border-[var(--border)] bg-white p-4 font-mono text-xs leading-relaxed text-black"
          data-testid="receipt-print-text"
        >
          {text}
        </pre>
      )}
    </Dialog>
  );
}

export default ReceiptPrintDialog;