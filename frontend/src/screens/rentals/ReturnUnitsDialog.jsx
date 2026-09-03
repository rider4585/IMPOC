import React, { useState } from 'react';
import { Dialog, Button, Input, Select, Card, CardContent } from '../../components/ui';
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
      className="rentals-return-dialog"
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
        <CardContent>
          <form id="return-form" onSubmit={handleSubmit} className="admin-form">
            <Input
              label="Actual return date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
            />

            {rentableBackLines.length === 0 ? (
              <p className="admin-muted">All units in this agreement have already been returned.</p>
            ) : (
              <ul className="rentals-return-list">
                {rentableBackLines.map((line) => {
                  const selected = Boolean(selections[line.uuid]);
                  return (
                    <li key={line.uuid} className="rentals-return-item">
                      <div className="rentals-return-item__header">
                        <label className="rentals-line-title">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggle(line)}
                            style={{ marginRight: '8px' }}
                          />
                          {line.barcode}
                        </label>
                        <span className="rentals-line-meta">
                          {formatPaise(Number(line.rentPerDayPaise))}/day · deposit{' '}
                          {formatPaise(Number(line.depositPaise))}
                        </span>
                      </div>
                      {selected && (
                        <div className="rentals-return-item__body">
                          <Select
                            label="Damage grade (optional)"
                            value={selections[line.uuid]?.gradeUuid || ''}
                            onChange={(ev) => setGrade(line.uuid, ev.target.value)}
                          >
                            <option value="">No damage grade</option>
                            {(damageGrades || []).map((g) => (
                              <option key={g.uuid} value={g.uuid}>
                                {g.name}
                              </option>
                            ))}
                          </Select>
                          <Input
                            label="Damage charge (₹) — leave blank to use grade default"
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
              <div className="admin-error" role="alert">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export default ReturnUnitsDialog;
