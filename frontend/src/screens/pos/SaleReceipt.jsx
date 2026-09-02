import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/ui';
import { formatPaise } from '../../platform/money.js';
import './pos.css';

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
      <CardContent className="pos-card__content">
        <p className="pos-receipt-meta">
          {sale.customerName ? `${sale.customerName} · ` : ''}
          {new Date(sale.soldAt || sale.createdAt).toLocaleDateString()} · {sale.status}
        </p>
        <table className="pos-receipt-table">
          <thead>
            <tr><th>Barcode</th><th>Price</th><th>Unit status</th></tr>
          </thead>
          <tbody>
            {sale.lines.map((line) => (
              <tr key={line.uuid}>
                <td>{line.barcode}</td>
                <td>{formatPaise(Number(line.sellingPricePaise))}</td>
                <td><Badge variant="neutral">{line.unitStatus}</Badge></td>
              </tr>
            ))}
            {sale.lines.length === 0 && (
              <tr><td colSpan={3} className="admin-muted">No lines.</td></tr>
            )}
          </tbody>
        </table>
        <div className="pos-total-row">
          <span>Total</span>
          <strong>{formatPaise(Number(sale.totalPaise))}</strong>
        </div>
        {sale.reversals && sale.reversals.length > 0 && (
          <div className="pos-reversals">
            <h4>Reversals</h4>
            {sale.reversals.map((rev) => (
              <div key={rev.uuid} className="pos-reversal-item">
                <Badge variant="danger">{rev.reversalType}</Badge>
                <span>{formatPaise(Number(rev.amountPaise))}</span>
                {rev.reason && <span className="pos-reversal-reason">— {rev.reason}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SaleReceipt;
