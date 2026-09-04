import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../ui';
import { formatPaise } from '../../platform/money.js';

/**
 * ReceiptPreview — renders the structured digital receipt payload from
 * GET /receipts/preview.
 *
 * receipt shape:
 * {
 *   store: {name, address, phone},
 *   transaction: {type, number, date, totalPaise, paidPaise, changePaise, status},
 *   customer: {name, phone, email},
 *   lines: [{productName, productType, colour, size, quantity, unitPricePaise, lineTotalPaise}],
 *   totals: {subtotalPaise, discountPaise, totalPaise, amountPaidPaise, balancePaise, itemsCount}
 * }
 */
export function ReceiptPreview({ receipt }) {
  if (!receipt) return null;
  const { store, transaction, customer, lines, totals } = receipt;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-4">
        <p className="text-lg font-semibold">{store?.name || 'Store'}</p>
        {store?.address && <p className="text-sm text-[var(--ink-muted)]">{store.address}</p>}
        {store?.phone && <p className="text-sm text-[var(--ink-muted)]">Ph: {store.phone}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transaction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {transaction && (
              <>
                <p className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Type</span>
                  <span className="font-medium">{transaction.type}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Number</span>
                  <span className="font-medium">{transaction.number}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Date</span>
                  <span className="font-medium">{transaction.date}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Status</span>
                  <Badge variant="neutral">{transaction.status}</Badge>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {customer && (customer.name || customer.phone || customer.email) ? (
              <>
                {customer.name && <p className="font-medium">{customer.name}</p>}
                {customer.phone && <p className="text-[var(--ink-muted)]">{customer.phone}</p>}
                {customer.email && <p className="text-[var(--ink-muted)]">{customer.email}</p>}
              </>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">Walk-in</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Product</TableHeaderCell>
            <TableHeaderCell>Qty</TableHeaderCell>
            <TableHeaderCell>Unit price</TableHeaderCell>
            <TableHeaderCell>Total</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(lines || []).map((line, idx) => (
            <TableRow key={line.lineTotalPaise !== undefined ? `${line.productName}-${idx}` : idx}>
              <TableCell>
                <span className="font-medium">{line.productName || '—'}</span>
                {line.productType && <span className="block text-xs text-[var(--ink-muted)]">{line.productType}</span>}
                {line.colour && <span className="block text-xs text-[var(--ink-muted)]">{line.colour} {line.size || ''}</span>}
              </TableCell>
              <TableCell>{line.quantity}</TableCell>
              <TableCell>{formatPaise(Number(line.unitPricePaise))}</TableCell>
              <TableCell>{formatPaise(Number(line.lineTotalPaise))}</TableCell>
            </TableRow>
          ))}
          {(!lines || lines.length === 0) && (
            <TableRow>
              <TableCell colSpan={4} className="text-sm text-[var(--ink-muted)]">No lines.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {totals && (
        <div className="flex flex-col gap-1 rounded-md border border-[var(--border)] p-4 text-sm">
          <p className="flex justify-between">
            <span className="text-[var(--ink-muted)]">Items</span>
            <span>{totals.itemsCount}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-[var(--ink-muted)]">Subtotal</span>
            <span>{formatPaise(Number(totals.subtotalPaise))}</span>
          </p>
          {Number(totals.discountPaise) > 0 && (
            <p className="flex justify-between">
              <span className="text-[var(--ink-muted)]">Discount</span>
              <span>−{formatPaise(Number(totals.discountPaise))}</span>
            </p>
          )}
          <p className="flex justify-between border-t border-[var(--border)] pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatPaise(Number(totals.totalPaise))}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-[var(--ink-muted)]">Paid</span>
            <span>{formatPaise(Number(totals.amountPaidPaise))}</span>
          </p>
          {Number(totals.balancePaise) > 0 && (
            <p className="flex justify-between">
              <span className="text-[var(--ink-muted)]">Balance</span>
              <span>{formatPaise(Number(totals.balancePaise))}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default ReceiptPreview;