import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Select,
  Input,
  Dialog,
  Badge,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { listRentals, getRental, createRental, processRentalReturn, cancelRental } from '../../services/rentalsApi.js';
import { getDamageGrades } from '../../services/picklistsApi.js';
import { formatPaise } from '../../platform/money.js';
import { RentalCreateDialog } from './RentalCreateDialog.jsx';
import { ReturnUnitsDialog } from './ReturnUnitsDialog.jsx';
import '../admin/admin.css';
import './rentals.css';

function statusBadgeVariant(status) {
  switch (status) {
    case 'active':
      return 'info';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function isLate(agreement) {
  if (agreement.status !== 'active') return false;
  const due = new Date(`${agreement.dueDate}T23:59:59`);
  return due.getTime() < Date.now();
}

export function RentalsScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canView = can(PERMISSIONS.RENTALS.VIEW);
  const canCreate = can(PERMISSIONS.RENTALS.CREATE);
  const canReturn = can(PERMISSIONS.RENTALS.RETURN);
  const canCancel = can(PERMISSIONS.RENTALS.CANCEL);

  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const [activeRental, setActiveRental] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [damageGrades, setDamageGrades] = useState([]);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRentals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listRentals();
      setRentals(data);
    } catch (err) {
      setError(err.message || 'Failed to load rentals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) {
      loadRentals();
      getDamageGrades().then(setDamageGrades).catch(() => {});
    }
  }, [canView, loadRentals]);

  const openDetail = useCallback(async (r) => {
    setDetailLoading(true);
    setError('');
    try {
      const fresh = await getRental(r.uuid);
      setActiveRental(fresh);
    } catch (err) {
      setError(err.message || 'Failed to load agreement');
      setActiveRental(r);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const goBack = () => {
    setActiveRental(null);
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return rentals;
    return rentals.filter((r) => r.status === filter);
  }, [rentals, filter]);

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      const agreement = await createRental(payload);
      toast.success({ title: `Agreement ${agreement.agreementNumber} created` });
      setCreateOpen(false);
      await loadRentals();
    } catch (err) {
      toast.error({ title: 'Checkout failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const refreshActive = async () => {
    if (activeRental) {
      const all = await listRentals();
      const fresh = all.find((x) => x.uuid === activeRental.uuid);
      setActiveRental(fresh || activeRental);
    }
    await loadRentals();
  };

  const handleReturn = async (payload) => {
    setSaving(true);
    try {
      await processRentalReturn(activeRental.uuid, payload);
      toast.success({ title: 'Return processed' });
      setReturnOpen(false);
      await refreshActive();
    } catch (err) {
      toast.error({ title: 'Return failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setSaving(true);
    try {
      await cancelRental(activeRental.uuid, cancelReason.trim() || undefined);
      toast.success({ title: 'Agreement cancelled' });
      setCancelOpen(false);
      setCancelReason('');
      await refreshActive();
    } catch (err) {
      toast.error({ title: 'Cancel failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="admin-page">
        <p className="admin-muted">You do not have permission to view rentals.</p>
      </div>
    );
  }

  return (
    <div className="rentals-page">
      {!activeRental ? (
        <>
          <div className="rentals-page__header">
            <div>
              <h1 className="typography-heading">Rentals</h1>
              <p className="typography-body-sm rentals-page__subtitle">
                Rent out units, track active agreements, and process returns.
              </p>
            </div>
            {canCreate && (
              <Button onClick={() => setCreateOpen(true)} data-testid="rentals-create">
                New agreement
              </Button>
            )}
          </div>

          {error && <div className="admin-error" role="alert">{error}</div>}

          <Card>
            <CardHeader>
              <CardTitle>Agreements</CardTitle>
            </CardHeader>
            <CardContent className="rentals-card__content">
              <div className="rentals-filter">
                <Select label="Filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </div>

              {loading ? (
                <p className="admin-muted">Loading rentals…</p>
              ) : filtered.length === 0 ? (
                <p className="admin-muted">No rental agreements in this view.</p>
              ) : (
                <ul className="rentals-list">
                  {filtered.map((r) => {
                    const late = isLate(r);
                    const returnedCount = r.lines.filter((l) => l.returns && l.returns.length > 0).length;
                    return (
                      <li key={r.uuid} className="rentals-item">
                        <div>
                          <div className="rentals-item__title">
                            <button
                              type="button"
                              className="rentals-item__link"
                              onClick={() => openDetail(r)}
                            >
                              {r.agreementNumber}
                            </button>{' '}
                            · {r.customerName || 'Walk-in'}
                          </div>
                          <div className="rentals-item__meta">
                            {r.lines.length} unit(s) · {returnedCount} returned · due{' '}
                            {new Date(`${r.dueDate}T00:00:00`).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="rentals-item__right">
                          {late && <Badge variant="danger">Late</Badge>}
                          <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                          <strong>{formatPaise(Number(r.depositRefundablePaise))}</strong>
                          <Button variant="outline" size="sm" onClick={() => openDetail(r)}>
                            View
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="rentals-page__header">
            <div>
              <Button variant="ghost" size="sm" onClick={goBack}>&larr; All rentals</Button>
              <h1 className="typography-heading">
                {activeRental.agreementNumber} · {activeRental.customerName || 'Walk-in'}
              </h1>
              <p className="typography-body-sm rentals-page__subtitle">
                {activeRental.startDate} → due {activeRental.dueDate}
              </p>
            </div>
            {activeRental.status === 'active' && (
              <div className="rentals-header-actions">
                {canReturn && (
                  <Button onClick={() => setReturnOpen(true)}>Process return</Button>
                )}
                {canCancel && (
                  <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel agreement</Button>
                )}
              </div>
            )}
          </div>

          {detailLoading && <p className="admin-muted">Loading…</p>}
          {error && <div className="admin-error" role="alert">{error}</div>}

          <Card>
            <CardHeader>
              <CardTitle>
                Status <Badge variant={statusBadgeVariant(activeRental.status)}>{activeRental.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="rentals-card__content">
              {activeRental.notes && <p className="admin-muted">{activeRental.notes}</p>}
              <div className="rentals-summary">
                <div className="rentals-money-row">
                  <span>Total deposit collected</span>
                  <strong>{formatPaise(Number(activeRental.depositRefundablePaise))}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Units</CardTitle>
            </CardHeader>
            <CardContent className="rentals-card__content">
              <ul className="rentals-lines-list">
                {activeRental.lines.map((line) => (
                  <li key={line.uuid} className="rentals-line-item">
                    <div>
                      <div className="rentals-line-title">
                        {line.barcode} · {formatPaise(Number(line.rentPerDayPaise))}/day
                      </div>
                      <div className="rentals-line-meta">
                        Deposit {formatPaise(Number(line.depositPaise))} · overdue{' '}
                        {formatPaise(Number(line.overduePerDayPaise))}/day · status:{' '}
                        <Badge variant="neutral">{line.unitStatus}</Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {activeRental.returns && activeRental.returns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Returns</CardTitle>
              </CardHeader>
              <CardContent className="rentals-card__content">
                <ul className="rentals-lines-list">
                  {activeRental.returns.map((ret) => (
                    <li key={ret.uuid} className="rentals-line-item">
                      <div>
                        <div className="rentals-line-title">
                          Unit · returned{' '}
                          {new Date(`${ret.actualReturnDate}T00:00:00`).toLocaleDateString()}
                        </div>
                        <div className="rentals-line-meta">
                          {ret.damageGradeName ? `Grade: ${ret.damageGradeName}` : 'No damage grade'}
                          {ret.damageGradeOutcome ? ` · ${ret.damageGradeOutcome}` : ''}
                          {' · '}late {ret.lateDays} day(s)
                          {' · '}overdue {formatPaise(Number(ret.overdueChargePaise))}
                          {' · '}damage {formatPaise(Number(ret.damageChargePaise))}
                          {' · '}refunded {formatPaise(Number(ret.depositRefundedPaise))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {activeRental.reversals && activeRental.reversals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reversals</CardTitle>
              </CardHeader>
              <CardContent className="rentals-card__content">
                <ul className="rentals-lines-list">
                  {activeRental.reversals.map((rev) => (
                    <li key={rev.uuid} className="rentals-line-item">
                      <div className="rentals-line-title">{rev.reversalType}</div>
                      <div className="rentals-line-meta">
                        {formatPaise(Number(rev.amountPaise))}
                        {rev.reason ? ` · ${rev.reason}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {createOpen && (
        <RentalCreateDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSave={handleCreate}
          saving={saving}
        />
      )}

      {returnOpen && activeRental && (
        <ReturnUnitsDialog
          open={returnOpen}
          onClose={() => setReturnOpen(false)}
          onSave={handleReturn}
          saving={saving}
          agreement={activeRental}
          damageGrades={damageGrades}
        />
      )}

      {cancelOpen && (
        <Dialog
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          title="Cancel agreement"
          footer={
            <>
              <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={saving}>
                Keep
              </Button>
              <Button variant="danger" onClick={handleCancel} loading={saving}>
                Cancel agreement
              </Button>
            </>
          }
        >
          <p className="admin-muted">
            Cancelling returns any still-rented units to stock and records a reversal. This cannot be undone.
          </p>
          <div className="admin-form">
            <Input
              label="Reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Optional"
              maxLength={2000}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default RentalsScreen;
