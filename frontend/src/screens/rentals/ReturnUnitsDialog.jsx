import React, { useMemo, useState } from 'react';
import { Dialog, Button, Input, SearchableSelect, Card, CardContent } from '../../components/ui';
import { formatPaise } from '../../platform/money.js';
import { parseRupeesToPaise } from '../../platform/moneyInput.js';

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * UX-C3: the return dialog previews exactly what the backend will
 * commit before any money moves. Mirrors the server maths:
 * lateDays = max(0, daysBetween(dueDate, returnDate));
 * overdue = lateDays * line.overduePerDayPaise;
 * damage = entered damage charge (0 when blank);
 * refund  = max(0, depositPaise - overdue - damage).
 */
function daysBetween(later, earlier) {
  return Math.round(
    (new Date(`${later}T00:00:00`).getTime() - new Date(`${earlier}T00:00:00`).getTime()) / 86400000
  );
}

function computeLineRefund(line, dueDate, returnDate, damageChargePaise) {
  const deposit = Number(line.depositPaise) || 0;
  const overduePerDay = Number(line.overduePerDayPaise) || 0;
  const lateDays = Math.max(0, daysBetween(returnDate, dueDate));
  const overdueChargePaise = lateDays * overduePerDay;
  const damage = Number.isNaN(damageChargePaise) || damageChargePaise == null ? 0 : damageChargePaise;
  const refundable = deposit - overdueChargePaise - damage;
  return {
    lateDays,
    overdueChargePaise,
    damageChargePaise: damage,
    depositRefundedPaise: Math.max(0, refundable),
  };
}

export function ReturnUnitsDialog({ open, onClose, onSave, saving, agreement, damageGrades }) {
  const [returnDate, setReturnDate] = useState(todayISO());
  const [selections, setSelections] = useState({});
  const [charges, setCharges] = useState({});
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');

  const rentableBackLines = (agreement?.lines || []).filter(
    (l) => !l.returns || l.returns.length === 0
  );

  const toggle = (line) => {
    setSelections((prev) => ({
      ...prev,
      [line.uuid]: prev[line.uuid] ? undefined : { gradeUuid: '', damageChargePaise: '' },
    }));
  };

  const setGrade = (lineUuid, gradeUuid) => {
    setSelections((prev) => ({
      ...prev,
      [lineUuid]: { ...(prev[lineUuid] || {}), gradeUuid },
    }));
  };

  const setCharge = (lineUuid, value) => {
    setCharges((prev) => ({ ...prev, [lineUuid]: value }));
  };

  const setNote = (lineUuid, value) => {
    setNotes((prev) => ({ ...prev, [lineUuid]: value }));
  };

  const handleClose = () => {
    setSelections({});
    setCharges({});
    setNotes({});
    setError('');
    setReturnDate(todayISO());
    onClose();
  };

  // UX-C3: live preview of refunds before submit. NaN (blank/invalid) entries
  // count as 0 for the preview but still block submit with a clear error.
  const dueDate = agreement?.dueDate;
  const preview = useMemo(() => {
    const lines = rentableBackLines
      .filter((l) => selections[l.uuid])
      .map((l) => {
        const entered = parseRupeesToPaise(charges[l.uuid] || '');
        return {
          line: l,
          refund: computeLineRefund(l, dueDate, returnDate, entered),
          chargeValid: !Number.isNaN(entered),
        };
      });
    const totals = lines.reduce(
      (acc, { line, refund }) => ({
        lateDays: acc.lateDays + refund.lateDays,
        overdueChargePaise: acc.overdueChargePaise + refund.overdueChargePaise,
        damageChargePaise: acc.damageChargePaise + refund.damageChargePaise,
        depositPaise: acc.depositPaise + (Number(line.depositPaise) || 0),
        depositRefundedPaise: acc.depositRefundedPaise + refund.depositRefundedPaise,
      }),
      { lateDays: 0, overdueChargePaise: 0, damageChargePaise: 0, depositPaise: 0, depositRefundedPaise: 0 }
    );
    return { lines, totals };
  }, [rentableBackLines, selections, charges, returnDate, dueDate]);

  const hasInvalidCharge = preview.lines.some((l) => !l.chargeValid);

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedLines = rentableBackLines.filter((l) => selections[l.uuid]);
    if (selectedLines.length === 0) {
      setError('Select at least one unit to return.');
      return;
    }
    if (hasInvalidCharge) {
      setError('Damage charges must be valid rupee amounts.');
      return;
    }
    const items = selectedLines.map((l) => {
      const sel = selections[l.uuid];
      const chargePaise = parseRupeesToPaise(charges[l.uuid] || '');
      return {
        unitUuid: l.unitUuid,
        gradeUuid: sel.gradeUuid || undefined,
        damageChargePaise: Number.isNaN(chargePaise) ? undefined : chargePaise,
        notes: notes[l.uuid]?.trim() || undefined,
      };
    });
    onSave({
      actualReturnDate: returnDate || undefined,
      items,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Process returns"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="return-form" loading={saving}>
            {preview.totals.depositRefundedPaise > 0
              ? `Process return · refund ${formatPaise(preview.totals.depositRefundedPaise)}`
              : 'Process return'}
          </Button>
        </>
      }
    >
      <Card>
        <CardContent className="p-4">
          <form id="return-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Actual return date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
            />

            {rentableBackLines.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">All units in this agreement have already been returned.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {rentableBackLines.map((line) => {
                  const selected = Boolean(selections[line.uuid]);
                  const linePreview = preview.lines.find((p) => p.line.uuid === line.uuid);
                  return (
                    <li
                      key={line.uuid}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 font-semibold text-sm">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggle(line)}
                          />
                          {line.barcode}
                        </label>
                        <span className="typography-money-sm text-right text-[var(--ink-muted)]">
                          {formatPaise(Number(line.rentPerDayPaise))}/day · deposit{' '}
                          {formatPaise(Number(line.depositPaise))}
                        </span>
                      </div>
                      {selected && (
                        <div className="mt-3 flex flex-col gap-2">
                          <SearchableSelect
                            label="Damage grade (optional)"
                            value={selections[line.uuid]?.gradeUuid || ''}
                            onChange={(gradeUuid) => setGrade(line.uuid, gradeUuid)}
                            placeholder="No damage grade"
                            searchPlaceholder="Search damage grades…"
                            emptyMessage="No damage grades."
                            options={[
                              { value: '', label: 'No damage grade' },
                              ...(damageGrades || []).map((g) => ({ value: g.uuid, label: g.name })),
                            ]}
                          />
                          <Input
                            label="Damage charge (₹) — optional, defaults to 0"
                            value={charges[line.uuid] || ''}
                            onChange={(ev) => setCharge(line.uuid, ev.target.value)}
                            placeholder="e.g. 150.00"
                            inputMode="decimal"
                          />
                          <Input
                            label="Return notes"
                            value={notes[line.uuid] || ''}
                            onChange={(ev) => setNote(line.uuid, ev.target.value)}
                            placeholder="Optional"
                            maxLength={2000}
                          />
                          {linePreview && (
                            <div className="rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-xs text-[var(--ink-muted)]">
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <span>Deposit {formatPaise(Number(line.depositPaise) || 0)}</span>
                                <span>− late {linePreview.refund.lateDays}d · {formatPaise(linePreview.refund.overdueChargePaise)}</span>
                                <span>− damage {formatPaise(linePreview.refund.damageChargePaise)}</span>
                              </div>
                              <div className="mt-1 font-semibold text-[var(--ink)]">
                                Refund {formatPaise(linePreview.refund.depositRefundedPaise)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {preview.totals.depositRefundedPaise > 0 && (
              <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-muted)]">
                  <span>Late charge {formatPaise(preview.totals.overdueChargePaise)}</span>
                  <span>Damage charge {formatPaise(preview.totals.damageChargePaise)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm text-[var(--ink-muted)]">Total refund</span>
                  <span className="typography-money">{formatPaise(preview.totals.depositRefundedPaise)}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export default ReturnUnitsDialog;