import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../../components/ui';
import { formatPaise } from '../../platform/money.js';
import { ReceiptSection } from '../../components/receipts/ReceiptSection.jsx';

/**
 * Read-only sale receipt. sale is a sale DTO:
 * { saleNumber, customerName, customer?, soldAt, totalPaise, status, lines[], reversals[] }
 * The digital structure preview + printer button live in <ReceiptSection />.
 */
export function SaleReceipt({ sale }) {
  const customer = sale.customer || null;
  const customerName = customer?.name || sale.customerName;
  const customerPhone = customer?.phone || sale.customerMobile;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Receipt — {sale.saleNumber}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="mb-2 text-sm text-[var(--ink-muted)]">
            {customerName ? `${customerName} · ` : ''}
            {new Date(sale.soldAt || sale.createdAt).toLocaleDateString()}
            {sale.status ? ` · ${sale.status}` : ''}
          </p>
          {(customerPhone || (customer && customer.email)) && (
            <p className="mb-2 text-xs text-[var(--ink-muted)]">
              {customerPhone}
              {customerPhone && customer?.email ? ' · ' : ''}
              {customer?.email}
            </p>
          )}
          {sale.paymentMethod && (
            <p className="mb-2 text-xs text-[var(--ink-muted)]">Payment · {sale.paymentMethod}</p>
          )}
          <Table>
            <TableHead>
              <TableRow noHover>
                <TableHeaderCell>Barcode</TableHeaderCell>
                <TableHeaderCell>Price</TableHeaderCell>
                <TableHeaderCell>Unit status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(sale.lines || []).map((line) => (
                <TableRow key={line.uuid} noHover>
                  <TableCell>{line.barcode}</TableCell>
                  <TableCell>{formatPaise(Number(line.sellingPricePaise))}</TableCell>
                  <TableCell><Badge variant="neutral">{line.unitStatus}</Badge></TableCell>
                </TableRow>
              ))}
              {(!sale.lines || sale.lines.length === 0) && (
                <TableRow noHover><TableCell colSpan={3} className="text-sm text-[var(--ink-muted)]">No lines.</TableCell></TableRow>
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
      <ReceiptSection
        entityType="SALE"
        entityUuid={sale.uuid}
        printTitle={`Print receipt — ${sale.saleNumber}`}
      />
    </>
  );
}

export default SaleReceipt;