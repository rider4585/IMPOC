import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Dialog,
  Badge,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { listSales } from '../../services/salesApi.js';
import { formatPaise } from '../../platform/money.js';
import { SaleReceipt } from './SaleReceipt.jsx';
import './pos.css';

export function SalesListScreen() {
  const { permissions } = useAuth();
  const canView = permissions && permissions.includes(PERMISSIONS.SALES.VIEW);

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewSale, setViewSale] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listSales();
      setSales(data);
    } catch (err) {
      setError(err.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  if (!canView) {
    return (
      <div className="pos-page">
        <p className="admin-muted">You do not have permission to view sales.</p>
      </div>
    );
  }

  return (
    <div className="pos-page">
      <div className="pos-page__header">
        <div>
          <h1 className="typography-heading">Sales</h1>
          <p className="typography-body-sm pos-page__subtitle">
            Review completed sales and their receipts.
          </p>
        </div>
      </div>

      {error && <div className="admin-error" role="alert">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Past sales</CardTitle>
        </CardHeader>
        <CardContent className="pos-card__content">
          {loading ? (
            <p className="admin-muted">Loading sales…</p>
          ) : sales.length === 0 ? (
            <p className="admin-muted">No sales yet.</p>
          ) : (
            <ul className="pos-sales-list">
              {sales.map((s) => (
                <li key={s.uuid} className="pos-sale-item">
                  <div>
                    <div className="pos-sale-title">
                      {s.saleNumber} · {new Date(s.soldAt || s.createdAt).toLocaleDateString()}
                    </div>
                    <div className="pos-sale-meta">
                      {s.customerName || 'Walk-in'} · {s.lines.length} line(s)
                      {' · '}
                      <Badge variant={s.status === 'completed' ? 'success' : 'neutral'}>
                        {s.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="pos-sale-right">
                    <strong>{formatPaise(Number(s.totalPaise))}</strong>
                    <Button variant="outline" size="sm" onClick={() => setViewSale(s)}>
                      View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(viewSale)}
        onClose={() => setViewSale(null)}
        title="Sale receipt"
        footer={
          <Button variant="outline" onClick={() => setViewSale(null)}>
            Close
          </Button>
        }
      >
        {viewSale && <SaleReceipt sale={viewSale} />}
      </Dialog>
    </div>
  );
}

export default SalesListScreen;
