import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../ui';
import { getReceiptPreview } from '../../services/receiptApi.js';
import { ReceiptPreview } from './ReceiptPreview.jsx';
import { ReceiptPrintDialog } from './ReceiptPrintDialog.jsx';
import { BrandedReceiptDialog } from './BrandedReceiptDialog.jsx';

/**
 * ReceiptSection — digital receipt (getReceiptPreview) + printer button
 * (getReceiptPrint) for a sale or rental entity. Drop in under an existing
 * receipt to satisfy the Schema V2 receipt format.
 *
 * Props: entityType ('SALE'|'RENTAL'), entityUuid, printTitle
 */
export function ReceiptSection({ entityType, entityUuid, printTitle = 'Print receipt' }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  const [brandedOpen, setBrandedOpen] = useState(false);

  const load = useCallback(async () => {
    if (!entityUuid) return;
    setLoading(true);
    setError('');
    try {
      const data = await getReceiptPreview(entityType, entityUuid);
      setPreview(data?.receipt || data || null);
    } catch (err) {
      setError(err.message || 'Failed to load receipt preview');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityUuid]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrintClick = () => {
    if (!entityUuid) return;
    setPrintOpen(true);
  };

  return (
    <>
      <div className="mb-1 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBrandedOpen(true)}
          disabled={!preview}
          data-testid="branded-receipt-button"
        >
          Branded receipt
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrintClick} disabled={!entityUuid}>
          Print receipt
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Digital receipt</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading && !preview ? (
            <p className="text-sm text-[var(--ink-muted)]">Loading receipt…</p>
          ) : error ? (
            <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
              {error}
              <button
                type="button"
                className="ml-2 font-medium underline"
                onClick={load}
              >
                Retry
              </button>
            </div>
          ) : preview ? (
            <ReceiptPreview receipt={preview} />
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">No digital receipt available.</p>
          )}
        </CardContent>
      </Card>

      <ReceiptPrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        entityType={entityType}
        entityUuid={entityUuid}
        title={printTitle}
      />

      <BrandedReceiptDialog
        open={brandedOpen}
        onClose={() => setBrandedOpen(false)}
        receipt={preview}
        title={printTitle.replace(/^Print receipt/, 'Branded receipt')}
      />
    </>
  );
}

export default ReceiptSection;