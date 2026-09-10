import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  SearchableSelect,
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
import { createRequestKey } from '../../platform/requestKey.js';
import { RentalCreateDialog } from './RentalCreateDialog.jsx';
import { ReturnUnitsDialog } from './ReturnUnitsDialog.jsx';
import { unitStatusBadgeVariant } from './rentalStatus.js';
import { ReceiptSection } from '../../components/receipts/ReceiptSection.jsx';

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

  const [createOpen, setCreateOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [saving, setSaving] = useState(false);

  // SEC-M-3 idempotency: one key per action intent, reused across retries of the same
  // intent until the action succeeds or its dialog is closed (fresh key on a new intent).
  const createKeyRef = useRef(null);
  const returnKeyRef = useRef(null);
  const cancelKeyRef = useRef(null);

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
      const agreement = await createRental({ ...payload, requestUuid: createKeyRef.current });
      toast.success({ title: `Agreement ${agreement.agreementNumber} created` });
      createKeyRef.current = null;
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
      await processRentalReturn(activeRental.uuid, { ...payload, requestUuid: returnKeyRef.current });
      toast.success({ title: 'Return processed' });
      returnKeyRef.current = null;
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
      await cancelRental(activeRental.uuid, cancelReason.trim() || undefined, {
        requestUuid: cancelKeyRef.current,
      });
      toast.success({ title: 'Agreement cancelled' });
      cancelKeyRef.current = null;
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
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view rentals.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      {!activeRental ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="typography-heading mb-1">Rentals</h1>
              <p className="typography-body-sm text-[var(--ink-muted)]">
                Rent out units, track active agreements, and process returns.
              </p>
            </div>
            {canCreate && (
              <Button
                onClick={() => {
                  createKeyRef.current = createRequestKey();
                  setCreateOpen(true);
                }}
                data-testid="rentals-create"
              >
                New agreement
              </Button>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Agreements</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchableSelect
                  label="Filter"
                  value={filter}
                  onChange={setFilter}
                  searchPlaceholder="Search statuses…"
                  emptyMessage="No matching statuses."
                  options={[
                    { value: 'all', label: 'All statuses' },
                    { value: 'active', label: 'Active' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]}
                />
              </div>

              {loading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-md bg-[var(--surface-sunken)]" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted)]">No rental agreements in this view.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {filtered.map((r) => {
                    const late = isLate(r);
                    const returnedCount = r.lines.filter((l) => l.returns && l.returns.length > 0).length;
                    return (
                      <li
                        key={r.uuid}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm"
                      >
                        <div>
                          <div className="font-semibold">
                            <button
                              type="button"
                              className="border-none bg-transparent p-0 font-semibold text-primary hover:underline"
                              onClick={() => openDetail(r)}
                            >
                              {r.agreementNumber}
                            </button>
                            {' · '}{r.customerName || 'Walk-in'}
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
                            {r.lines.length} unit(s) · {returnedCount} returned · due{' '}
                            {new Date(`${r.dueDate}T00:00:00`).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {late && <Badge variant="danger">Late</Badge>}
                          <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                          <strong className="typography-money-sm">{formatPaise(Number(r.depositRefundablePaise))}</strong>
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Button variant="ghost" size="sm" onClick={goBack}>&larr; All rentals</Button>
              <h1 className="typography-heading mb-1">
                {activeRental.agreementNumber} · {activeRental.customerName || 'Walk-in'}
              </h1>
              <p className="typography-body-sm text-[var(--ink-muted)]">
                {activeRental.startDate} → due {activeRental.dueDate}
                {activeRental.customer && (activeRental.customer.phone || activeRental.customer.email) ? (
                  <>
                    {' · '}
                    {activeRental.customer.phone}
                    {activeRental.customer.phone && activeRental.customer.email ? ' · ' : ''}
                    {activeRental.customer.email}
                  </>
                ) : null}
              </p>
            </div>
            {activeRental.status === 'active' && (
              <div className="flex flex-wrap gap-2">
                {canReturn && (
                  <Button
                    onClick={() => {
                      returnKeyRef.current = createRequestKey();
                      setReturnOpen(true);
                    }}
                  >
                    Process return
                  </Button>
                )}
                {canCancel && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      cancelKeyRef.current = createRequestKey();
                      setCancelOpen(true);
                    }}
                  >
                    Cancel agreement
                  </Button>
                )}
              </div>
            )}
          </div>

          {detailLoading && (
            <div className="flex flex-col gap-2">
              <div className="h-20 animate-pulse rounded-md bg-[var(--surface-sunken)]" />
            </div>
          )}
          {error && (
            <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                Status <Badge variant={statusBadgeVariant(activeRental.status)}>{activeRental.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {activeRental.notes && <p className="mb-2 text-sm text-[var(--ink-muted)]">{activeRental.notes}</p>}
              <div className="mt-2 flex flex-col gap-1">
                <div className="flex items-center justify-between border-b border-[var(--border)] py-2 text-sm last:border-b-0">
                  <span className="text-[var(--ink-muted)]">Total deposit collected</span>
                  <strong className="typography-money">{formatPaise(Number(activeRental.depositRefundablePaise))}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Units</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ul className="flex flex-col gap-2">
                {activeRental.lines.map((line) => (
                  <li
                    key={line.uuid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold">
                        {line.barcode} ·{' '}
                        <span className="typography-money-sm">{formatPaise(Number(line.rentPerDayPaise))}/day</span>
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
                        Deposit <span className="typography-money-sm">{formatPaise(Number(line.depositPaise))}</span> · overdue{' '}
                        <span className="typography-money-sm">{formatPaise(Number(line.overduePerDayPaise))}/day</span> · status:{' '}
                        <Badge variant={unitStatusBadgeVariant(line.unitStatus)}>{line.unitStatus}</Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {activeRental.status === 'completed' && (
            <ReceiptSection
              entityType="RENTAL"
              entityUuid={activeRental.uuid}
              printTitle={`Print receipt — ${activeRental.agreementNumber}`}
            />
          )}

          {activeRental.returns && activeRental.returns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Returns</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ul className="flex flex-col gap-2">
                  {activeRental.returns.map((ret) => (
                    <li
                      key={ret.uuid}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm"
                    >
                      <div className="font-semibold">
                        Unit · returned{' '}
                        {new Date(`${ret.actualReturnDate}T00:00:00`).toLocaleDateString()}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
                        {ret.damageGradeName ? `Grade: ${ret.damageGradeName}` : 'No damage grade'}
                        {ret.damageGradeOutcome ? ` · ${ret.damageGradeOutcome}` : ''}
                        {' · '}late {ret.lateDays} day(s)
                        {' · '}overdue <span className="typography-money-sm">{formatPaise(Number(ret.overdueChargePaise))}</span>
                        {' · '}damage <span className="typography-money-sm">{formatPaise(Number(ret.damageChargePaise))}</span>
                        {' · '}refunded <span className="typography-money-sm">{formatPaise(Number(ret.depositRefundedPaise))}</span>
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
              <CardContent className="p-4">
                <ul className="flex flex-col gap-2">
                  {activeRental.reversals.map((rev) => (
                    <li
                      key={rev.uuid}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-sm"
                    >
                      <div className="font-semibold">{rev.reversalType}</div>
                      <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
                        <span className="typography-money-sm">{formatPaise(Number(rev.amountPaise))}</span>
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
          onClose={() => { createKeyRef.current = null; setCreateOpen(false); }}
          onSave={handleCreate}
          saving={saving}
        />
      )}

      {returnOpen && activeRental && (
        <ReturnUnitsDialog
          open={returnOpen}
          onClose={() => { returnKeyRef.current = null; setReturnOpen(false); }}
          onSave={handleReturn}
          saving={saving}
          agreement={activeRental}
          damageGrades={damageGrades}
        />
      )}

      {cancelOpen && (
        <Dialog
          open={cancelOpen}
          onClose={() => { cancelKeyRef.current = null; setCancelOpen(false); }}
          title="Cancel agreement"
          footer={
            <>
              <Button variant="outline" onClick={() => { cancelKeyRef.current = null; setCancelOpen(false); }} disabled={saving}>
                Keep
              </Button>
              <Button variant="danger" onClick={handleCancel} loading={saving}>
                Cancel agreement
              </Button>
            </>
          }
        >
          <p className="mb-4 text-sm text-[var(--ink-muted)]">
            Cancelling returns any still-rented units to stock and records a reversal. This cannot be undone.
          </p>
          <form className="flex flex-col gap-4">
            <Input
              label="Reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Optional"
              maxLength={2000}
            />
          </form>
        </Dialog>
      )}
    </div>
  );
}

export default RentalsScreen;
