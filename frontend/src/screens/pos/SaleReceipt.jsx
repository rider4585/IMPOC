import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../../components/ui';
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
        <Table>
          <TableHead>
            <TableRow className="hover:bg-transparent">
              <TableHeaderCell>Barcode</TableHeaderCell>
              <TableHeaderCell>Price</TableHeaderCell>
              <TableHeaderCell>Unit status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sale.lines.map((line) => (
              <TableRow key={line.uuid}>
                <TableCell>{line.barcode}</TableCell>
                <TableCell>{formatPaise(Number(line.sellingPricePaise))}</TableCell>
                <TableCell><Badge variant="neutral">{line.unitStatus}</Badge></TableCell>
              </TableRow>
            ))}
            {sale.lines.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-sm text-[var(--ink-muted)]">No lines.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
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
