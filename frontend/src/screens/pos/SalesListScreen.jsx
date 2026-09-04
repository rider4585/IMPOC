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
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view sales.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Sales</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Review completed sales and their receipts.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Past sales</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-[var(--surface-sunken)]" />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No sales yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sales.map((s) => (
                <li
                  key={s.uuid}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm"
                >
                  <div>
                    <div className="font-semibold">
                      {s.saleNumber} · {new Date(s.soldAt || s.createdAt).toLocaleDateString()}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
                      {s.customerName || 'Walk-in'} · {s.lines.length} line(s)
                      {' · '}
                      <Badge variant={s.status === 'completed' ? 'success' : 'neutral'}>
                        {s.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
