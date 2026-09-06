import React, { useState } from 'react';
import { Dialog, Button, Input, SearchableSelect, Card, CardContent } from '../../components/ui';
import { formatPaise } from '../../platform/money.js';
import { parseRupeesToPaise } from '../../platform/moneyInput.js';

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedLines = rentableBackLines.filter((l) => selections[l.uuid]);
    if (selectedLines.length === 0) {
      setError('Select at least one unit to return.');
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
            Process return
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
                        <span className="text-xs text-[var(--ink-muted)]">
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
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
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
