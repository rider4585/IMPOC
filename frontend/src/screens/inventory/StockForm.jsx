import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, Button, Input, Select, useToast } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getTrip, createStock } from '../../services/tripsApi.js';
import { getTemplates } from '../../services/templatesApi.js';
import { getProductTypes, getSizes } from '../../services/picklistsApi.js';
import { CHANNEL } from '../../constants/channel.js';
import { formatPaiseForInput, parseRupeesToPaise } from '../../platform/moneyInput.js';

export function StockForm() {
  const { tripUuid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);
  const canCreate = can(PERMISSIONS.INVENTORY.CREATE);

  const prefill = location.state?.prefill || null;

  const [tripVendors, setTripVendors] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [vendorTemplates, setVendorTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [form, setForm] = useState(() => ({
    vendorUuid: prefill?.vendorUuid || '',
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
    if (!tripUuid) return;
    getTrip(tripUuid)
      .then((trip) => {
        const vendors = Array.isArray(trip?.trip_vendors) ? trip.trip_vendors : [];
        setTripVendors(vendors);
        if (vendors.length === 1 && !form.vendorUuid) {
          setForm((f) => ({ ...f, vendorUuid: vendors[0].vendor?.uuid || '' }));
        }
      })
      .catch(() => setTripVendors([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripUuid]);

  const handleVendorChange = async (e) => {
    const vendorUuid = e.target.value;
    setForm((f) => ({ ...f, vendorUuid }));
    setVendorTemplates([]);
    if (!vendorUuid) return;
    setLoadingTemplates(true);
    try {
      const templates = await getTemplates(vendorUuid);
      setVendorTemplates(Array.isArray(templates) ? templates : []);
    } catch {
      setVendorTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const applyTemplate = (e) => {
    const uuid = e.target.value;
    const tpl = vendorTemplates.find((t) => t.uuid === uuid);
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      productTypeUuid: tpl.productTypeUuid || f.productTypeUuid,
      name: tpl.name || f.name,
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

    if (!form.vendorUuid) { setError('Please select a vendor on this trip.'); return; }
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
        vendorUuid: form.vendorUuid,
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
        vendorUuid: form.vendorUuid,
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
      await createStock(tripUuid, payload);
      toast.success({ title: 'Stock added' });
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
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to create stocks.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-5 p-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>&larr; Back</Button>
        <h1 className="typography-heading mb-1 mt-1">{prefill ? 'Add stock (cloned)' : 'Add stock'}</h1>
        <p className="typography-body-sm text-[var(--ink-muted)]">
          Define the attributes every unit in this stock will inherit.
        </p>
      </div>

      <form id="stock-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Vendor (on this trip)"
          value={form.vendorUuid}
          onChange={handleVendorChange}
          required
          hint="The stock's vendor must be one of the trip's vendors."
        >
          <option value="">Select a vendor…</option>
          {tripVendors.map((tv) => (
            <option key={tv.vendor?.uuid || tv.uuid} value={tv.vendor?.uuid || tv.uuid}>
              {tv.vendor?.name || 'Vendor'}
            </option>
          ))}
        </Select>

        {form.vendorUuid && vendorTemplates.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <p className="mb-2 text-sm font-medium text-[var(--ink)]">
              Pre-fill from a buying template
            </p>
            <div className="flex flex-col gap-3">
              <Select
                label="Template"
                value=""
                onChange={applyTemplate}
                hint="Applying a template pre-fills type and prices below (still editable)."
              >
                <option value="">-- Select template --</option>
                {vendorTemplates.map((t) => (
                  <option key={t.uuid} value={t.uuid}>
                    {t.name || 'Untitled template'}
                  </option>
                ))}
              </Select>
              {loadingTemplates && (
                <p className="text-xs text-[var(--ink-muted)]">Loading templates…</p>
              )}
            </div>
          </div>
        )}

        {form.vendorUuid && !loadingTemplates && vendorTemplates.length === 0 && (
          <p className="text-xs text-[var(--ink-muted)]">
            No buying templates saved for this vendor yet.
          </p>
        )}

        <Select label="Product type" value={form.productTypeUuid} onChange={set('productTypeUuid')} required>
          <option value="">Select a product type…</option>
          {productTypes.filter((t) => t.isActive !== false).map((t) => (
            <option key={t.uuid} value={t.uuid}>{t.name}</option>
          ))}
        </Select>

        <Input label="Stock name (optional)" value={form.name} onChange={set('name')} placeholder="e.g. Round-neck kurti" maxLength={200} />

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
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
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
                        : 'border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--ink)] hover:bg-[var(--surface-sunken)]')
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
          <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
        )}
      </form>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
        <Button type="submit" form="stock-form" loading={saving}>Save stock</Button>
      </div>
    </div>
  );
}

function rupeeOrEmpty(paise) {
  if (paise == null || Number.isNaN(Number(paise))) return '';
  return formatPaiseForInput(Number(paise));
}

export default StockForm;