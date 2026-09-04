import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, Button, Input, Select, useToast } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { createStockIntakeLine } from '../../services/intakeApi.js';
import { getIntakeRecords, getIntakeRecord } from '../../services/intakeRecordsApi.js';
import { getProductTypes, getSizes } from '../../services/picklistsApi.js';
import { CHANNEL } from '../../constants/channel.js';
import { formatPaiseForInput, parseRupeesToPaise } from '../../platform/moneyInput.js';

export function LotForm() {
  const { tripUuid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);
  const canCreate = can(PERMISSIONS.INVENTORY.CREATE);

  const prefill = location.state?.prefill || null;

  const [productTypes, setProductTypes] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [intakeRecords, setIntakeRecords] = useState([]);
  const [selectedIntakeUuid, setSelectedIntakeUuid] = useState('');
  const [intakeTemplates, setIntakeTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [form, setForm] = useState(() => ({
    productTypeUuid: prefill?.productTypeUuid || '',
    name: prefill?.name || '',
    quantity: prefill?.quantity != null ? String(prefill.quantity) : '1',
    buyingPricePaise: rupeeOrEmpty(prefill?.buyingPricePaise),
    sellingPricePaise: rupeeOrEmpty(prefill?.sellingPricePaise),
    floorPricePaise: rupeeOrEmpty(prefill?.floorPricePaise),
    channel: prefill?.channel || CHANNEL.RETAIL,
    rentPerDayPaise: rupeeOrEmpty(prefill?.rentPerDayPaise),
    depositPaise: rupeeOrEmpty(prefill?.depositPaise),
    overduePerDayPaise: rupeeOrEmpty(prefill?.overduePerDayPaise),
    sizeRunEnabled: false,
    sizeRun: [],
  }));

  useEffect(() => {
    getProductTypes().then(setProductTypes).catch(() => {});
    getSizes().then(setSizes).catch(() => {});
    getIntakeRecords().then(setIntakeRecords).catch(() => {});
  }, []);

  const handleIntakeChange = async (e) => {
    const intakeUuid = e.target.value;
    setSelectedIntakeUuid(intakeUuid);
    setIntakeTemplates([]);
    if (!intakeUuid) return;
    setLoadingTemplates(true);
    try {
      const record = await getIntakeRecord(intakeUuid);
      setIntakeTemplates(Array.isArray(record?.templates) ? record.templates : []);
    } catch {
      setIntakeTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const applyTemplate = (e) => {
    const uuid = e.target.value;
    const tpl = intakeTemplates.find((t) => t.uuid === uuid);
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      productTypeUuid: tpl.productTypeUuid || f.productTypeUuid,
      quantity: tpl.defaultQuantity != null ? String(tpl.defaultQuantity) : f.quantity,
      buyingPricePaise: rupeeOrEmpty(tpl.buyingPricePaise),
      sellingPricePaise: rupeeOrEmpty(tpl.defaultSellingPricePaise),
      floorPricePaise: rupeeOrEmpty(tpl.defaultFloorPricePaise),
    }));
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleSizeInRun = (sizeUuid) => {
    setForm((f) => {
      const run = f.sizeRun.includes(sizeUuid)
        ? f.sizeRun.filter((s) => s !== sizeUuid)
        : [...f.sizeRun, sizeUuid];
      return { ...f, sizeRun: run };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!form.productTypeUuid) { setError('Please select a product type.'); return; }
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) { setError('Quantity must be a whole number of at least 1.'); return; }
    const buying = parseRupeesToPaise(form.buyingPricePaise);
    const selling = parseRupeesToPaise(form.sellingPricePaise);
    const floor = parseRupeesToPaise(form.floorPricePaise);
    if ([buying, selling, floor].some(Number.isNaN)) { setError('Buying, selling and floor prices must be valid rupee amounts.'); return; }
    if (floor > selling) { setError('Floor price cannot exceed selling price.'); return; }

    const isRental = form.channel === CHANNEL.RENTAL;
    if (isRental) {
      const rent = parseRupeesToPaise(form.rentPerDayPaise);
      const deposit = parseRupeesToPaise(form.depositPaise);
      const overdue = parseRupeesToPaise(form.overduePerDayPaise);
      if ([rent, deposit, overdue].some(Number.isNaN)) { setError('Rent per day, deposit and overdue per day are required for RENTAL.'); return; }
      if (overdue <= rent) { setError('Overdue per day must be greater than rent per day.'); return; }
      doCreate({
        productTypeUuid: form.productTypeUuid,
        name: form.name.trim() || undefined,
        quantity,
        buyingPricePaise: buying,
        sellingPricePaise: selling,
        floorPricePaise: floor,
        channel: form.channel,
        rentPerDayPaise: rent,
        depositPaise: deposit,
        overduePerDayPaise: overdue,
      });
    } else {
      doCreate({
        productTypeUuid: form.productTypeUuid,
        name: form.name.trim() || undefined,
        quantity,
        buyingPricePaise: buying,
        sellingPricePaise: selling,
        floorPricePaise: floor,
        channel: form.channel,
      });
    }
  };

  const doCreate = async (payload) => {
    setSaving(true);
    try {
      const created = await createStockIntakeLine(tripUuid, payload);
      toast.success({ title: 'Lot added' });
      navigate(`/trips/${tripUuid}`, { state: { sizeRun: form.sizeRunEnabled ? form.sizeRun : null } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to create lots.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-5 p-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>&larr; Back</Button>
        <h1 className="typography-heading mb-1 mt-1">{prefill ? 'Add lot (cloned)' : 'Add lot'}</h1>
        <p className="typography-body-sm text-[var(--ink-muted)]">
          Define the attributes every unit in this lot will inherit.
        </p>
      </div>

      <form id="lot-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {intakeRecords.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-white p-4">
            <p className="mb-2 text-sm font-medium text-[var(--ink)]">
              Pre-fill from an intake template
            </p>
            <div className="flex flex-col gap-3">
              <Select
                label="Intake record"
                value={selectedIntakeUuid}
                onChange={handleIntakeChange}
                hint="Pick the buying day whose template you used for this stock."
              >
                <option value="">-- Select intake record --</option>
                {intakeRecords
                  .filter((r) => r.status !== 'closed')
                  .map((r) => (
                    <option key={r.uuid} value={r.uuid}>
                      {r.name} · {new Date(r.purchasedOn + 'T00:00:00').toLocaleDateString()}
                    </option>
                  ))}
              </Select>
              <Select
                label="Template"
                value=""
                onChange={applyTemplate}
                hint="Applying a template pre-fills type and prices below (still editable)."
              >
                <option value="">-- Select template --</option>
                {intakeTemplates.map((t) => (
                  <option key={t.uuid} value={t.uuid}>
                    {t.name || 'Untitled template'}
                  </option>
                ))}
              </Select>
              {loadingTemplates && (
                <p className="text-xs text-[var(--ink-muted)]">Loading templates…</p>
              )}
              {selectedIntakeUuid && !loadingTemplates && intakeTemplates.length === 0 && (
                <p className="text-xs text-[var(--ink-muted)]">
                  This intake record has no templates yet.
                </p>
              )}
            </div>
          </div>
        )}

        <Select label="Product type" value={form.productTypeUuid} onChange={set('productTypeUuid')} required>
          <option value="">Select a product type…</option>
          {productTypes.filter((t) => t.isActive !== false).map((t) => (
            <option key={t.uuid} value={t.uuid}>{t.name}</option>
          ))}
        </Select>

        <Input label="Lot name (optional)" value={form.name} onChange={set('name')} placeholder="e.g. Round-neck kurti" maxLength={200} />

        <Input label="Quantity" type="number" min={1} step={1} value={form.quantity} onChange={set('quantity')} required />

        <Input label="Buying price (₹)" value={form.buyingPricePaise} onChange={set('buyingPricePaise')} inputMode="decimal" required />
        <Input label="Selling price (₹)" value={form.sellingPricePaise} onChange={set('sellingPricePaise')} inputMode="decimal" required />
        <Input label="Floor price (₹)" value={form.floorPricePaise} onChange={set('floorPricePaise')} inputMode="decimal" required hint="Cannot exceed selling price." />

        <Select label="Channel" value={form.channel} onChange={set('channel')} required>
          <option value={CHANNEL.RETAIL}>Retail</option>
          <option value={CHANNEL.RENTAL}>Rental</option>
        </Select>

        {form.channel === CHANNEL.RENTAL && (
          <>
            <Input label="Rent per day (₹)" value={form.rentPerDayPaise} onChange={set('rentPerDayPaise')} inputMode="decimal" required />
            <Input label="Deposit (₹)" value={form.depositPaise} onChange={set('depositPaise')} inputMode="decimal" required />
            <Input label="Overdue per day (₹)" value={form.overduePerDayPaise} onChange={set('overduePerDayPaise')} inputMode="decimal" required hint="Must be greater than rent per day." />
          </>
        )}

        {/* Size-run mode */}
        {sizes.filter((s) => s.isActive !== false).length > 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-white p-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.sizeRunEnabled}
                onChange={(e) => setForm((f) => ({ ...f, sizeRunEnabled: e.target.checked, sizeRun: e.target.checked ? f.sizeRun : [] }))}
                className="h-4 w-4 rounded border-[var(--border-strong)] text-primary focus:ring-[var(--focus-ring)]"
              />
              <span className="text-sm font-medium text-[var(--ink)]">Size-run mode</span>
            </label>
            {form.sizeRunEnabled && (
              <p className="mt-1 mb-2 text-xs text-[var(--ink-muted)]">
                Pick sizes in order. During intake, the size field auto-advances through this sequence.
              </p>
            )}
            {form.sizeRunEnabled && (
              <div className="flex flex-wrap gap-2">
                {sizes.filter((s) => s.isActive !== false).map((s) => (
                  <button
                    key={s.uuid}
                    type="button"
                    className={
                      'rounded-full border px-3 py-1 text-xs font-semibold transition-colors ' +
                      (form.sizeRun.includes(s.uuid)
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]'
                        : 'border-[var(--border-strong)] bg-white text-[var(--ink)] hover:bg-[var(--surface-sunken)]')
                    }
                    onClick={() => toggleSizeInRun(s.uuid)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
        )}
      </form>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
        <Button type="submit" form="lot-form" loading={saving}>Save lot</Button>
      </div>
    </div>
  );
}

function rupeeOrEmpty(paise) {
  if (paise == null || Number.isNaN(Number(paise))) return '';
  return formatPaiseForInput(Number(paise));
}

export default LotForm;
