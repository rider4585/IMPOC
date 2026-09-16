import React, { useMemo, useRef } from 'react';
import { Dialog, Button } from '../ui';
import { buildBrandedReceiptHtml } from '../../platform/brandedReceiptHtml.js';
import { useBranding } from '../../theme/BrandingProvider.jsx';

/**
 * BrandedReceiptDialog — live preview + print for the colourful A5 branded
 * receipt (R-45). Renders self-contained HTML inside an isolated iframe
 * (srcDoc) so the receipt's own cream/brown palette never inherits the app's
 * dark theme, and "Print" triggers the iframe's own print.
 *
 * When `html` is given (a snapshot rendered from the PUBLISHED template), it is
 * used verbatim — this is how POS prints the active receipt template (R-47).
 * Otherwise it falls back to the static `buildBrandedReceiptHtml`.
 *
 * Props: open, onClose, receipt, title, html
 */
export function BrandedReceiptDialog({ open, onClose, receipt, title = 'Branded receipt', html }) {
  const iframeRef = useRef(null);
  // R-58: the uploaded shop logo replaces the monogram on the printed receipt
  const { logoDataUrl } = useBranding();
  const builtHtml = useMemo(() => (receipt ? buildBrandedReceiptHtml(receipt, logoDataUrl ? { logoSrc: logoDataUrl } : {}) : ''), [receipt, logoDataUrl]);
  const resolvedHtml = html ?? builtHtml;

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (win) win.print();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className="max-w-4xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handlePrint} disabled={!resolvedHtml}>
            Print
          </Button>
        </>
      }
    >
      {resolvedHtml ? (
        <iframe
          ref={iframeRef}
          title="Branded receipt preview"
          srcDoc={resolvedHtml}
          data-testid="branded-receipt-frame"
          className="h-[70vh] w-full rounded-md border border-[var(--border)] bg-white"
        />
      ) : (
        <p className="text-sm text-[var(--ink-muted)]">No receipt data available.</p>
      )}
    </Dialog>
  );
}

export default BrandedReceiptDialog;
