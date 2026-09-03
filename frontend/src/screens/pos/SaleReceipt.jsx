import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/ui';
import { formatPaise } from '../../platform/money.js';

/**
 * Read-only sale receipt. sale is a sale DTO:
 * { saleNumber, customerName, soldAt, totalPaise, status, lines[], reversals[] }
 */
export function SaleReceipt({ sale }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipt — {sale.saleNumber}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <p className="mb-2 text-sm text-[var(--ink-muted)]">
          {sale.customerName ? `${sale.customerName} · ` : ''}
          {new Date(sale.soldAt || sale.createdAt).toLocaleDateString()} · {sale.status}
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-[var(--border)] p-2 text-left">Barcode</th>
              <th className="border-b border-[var(--border)] p-2 text-left">Price</th>
              <th className="border-b border-[var(--border)] p-2 text-left">Unit status</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((line) => (
              <tr key={line.uuid}>
                <td className="border-b border-[var(--border)] p-2">{line.barcode}</td>
                <td className="border-b border-[var(--border)] p-2">{formatPaise(Number(line.sellingPricePaise))}</td>
                <td className="border-b border-[var(--border)] p-2"><Badge variant="neutral">{line.unitStatus}</Badge></td>
              </tr>
            ))}
            {sale.lines.length === 0 && (
              <tr><td colSpan={3} className="p-2 text-sm text-[var(--ink-muted)]">No lines.</td></tr>
            )}
          </tbody>
        </table>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-lg">
          <span>Total</span>
          <strong>{formatPaise(Number(sale.totalPaise))}</strong>
        </div>
        {sale.reversals && sale.reversals.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-medium">Reversals</h4>
            {sale.reversals.map((rev) => (
              <div key={rev.uuid} className="flex items-center gap-2 py-2 text-sm">
                <Badge variant="danger">{rev.reversalType}</Badge>
                <span>{formatPaise(Number(rev.amountPaise))}</span>
                {rev.reason && <span className="text-[var(--ink-muted)]">— {rev.reason}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SaleReceipt;
