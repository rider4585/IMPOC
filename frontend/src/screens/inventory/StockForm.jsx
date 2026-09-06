import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, Button, Input, SearchableSelect, useToast } from '../../components/ui';
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
    subTypeUuid: prefill?.subTypeUuid || '',
    name: prefill?.name || '',
    quantity: prefill?.quantity != null ? String(prefill.quantity) : '1',
    buyingPricePaise: rupeeOrEmpty(prefill?.buyingPricePaise),
    wholeBuyingPricePaise: rupeeOrEmpty(prefill?.wholeBuyingPricePaise),
    sellingPricePaise: rupeeOrEmpty(prefill?.sellingPricePaise),
    floorPricePaise: rupeeOrEmpty(prefill?.floorPricePaise),
    channel: prefill?.channel || CHANNEL.RETAIL,
    rentPerDayPaise: rupeeOrEmpty(prefill?.rentPerDayPaise),
    depositPaise: rupeeOrEmpty(prefill?.depositPaise),
    overduePerDayPaise: rupeeOrEmpty(prefill?.overduePerDayPaise),
    sizeRunEnabled: false,
    sizeRun: [],
  }));

  const productTypeRows = Array.isArray(productTypes) ? productTypes : [];
  const parentTypes = productTypeRows.filter((t) => !t.parentUuid && t.isActive !== false);
  const subtypeRows = productTypeRows.filter((t) => t.parentUuid === form.productTypeUuid && t.isActive !== false);

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

  const handleVendorChange = async (vendorUuid) => {
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

  const applyTemplate = (uuid) => {
    const tpl = vendorTemplates.find((t) => t.uuid === uuid);
    if (!tpl) return;
    setForm((f) => {
      const next = {
        ...f,
        productTypeUuid: tpl.productTypeUuid || f.productTypeUuid,
        subTypeUuid: tpl.subTypeUuid || '',
        name: tpl.name || f.name,
        quantity: tpl.defaultQuantity != null ? String(tpl.defaultQuantity) : f.quantity,
        buyingPricePaise: rupeeOrEmpty(tpl.buyingPricePaise),
        wholeBuyingPricePaise: rupeeOrEmpty(tpl.wholeBuyingPricePaise),
        sellingPricePaise: rupeeOrEmpty(tpl.defaultSellingPricePaise),
        floorPricePaise: rupeeOrEmpty(tpl.defaultFloorPricePaise),
      };
      if (next.subTypeUuid && !next.productTypeUuid) {
        const sub = productTypes.find((t) => t.uuid === next.subTypeUuid);
        if (sub?.parentUuid) next.productTypeUuid = sub.parentUuid;
      }
      return next;
    });
  };

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e && e.target ? e.target.value : e }));

  const handleTypeChange = (typeUuid) => {
    setForm((f) => ({ ...f, productTypeUuid: typeUuid, subTypeUuid: '' }));
  };

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

    const wholeRaw = String(form.wholeBuyingPricePaise || '').trim();
    let wholeBuying = null;
    if (wholeRaw !== '') {
      wholeBuying = parseRupeesToPaise(wholeRaw);
      if (Number.isNaN(wholeBuying)) { setError('Whole stock buying price must be a valid rupee amount.'); return; }
    }

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
        subTypeUuid: form.subTypeUuid || null,
        name: form.name.trim() || undefined,
        quantity,
        buyingPricePaise: buying,
        wholeBuyingPricePaise: wholeBuying,
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
        subTypeUuid: form.subTypeUuid || null,
        name: form.name.trim() || undefined,
        quantity,
        buyingPricePaise: buying,
        wholeBuyingPricePaise: wholeBuying,
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
        <SearchableSelect
          label="Vendor (on this trip)"
          value={form.vendorUuid}
          onChange={handleVendorChange}
          placeholder="Select a vendor…"
          searchPlaceholder="Search vendors…"
          emptyMessage="No vendors on this trip."
          options={tripVendors.map((tv) => ({
            value: tv.vendor?.uuid || tv.uuid,
            label: tv.vendor?.name || 'Vendor',
          }))}
        />
        <p className="text-xs text-[var(--ink-faint)]">The stock's vendor must be one of the trip's vendors.</p>

        {form.vendorUuid && vendorTemplates.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <p className="mb-2 text-sm font-medium text-[var(--ink)]">
              Pre-fill from a buying template
            </p>
            <div className="flex flex-col gap-3">
              <SearchableSelect
                label="Template"
                value=""
                onChange={applyTemplate}
                placeholder="-- Select template --"
                searchPlaceholder="Search templates…"
                emptyMessage="No templates."
                options={vendorTemplates.map((t) => ({
                  value: t.uuid,
                  label: t.name || 'Untitled template',
                }))}
              />
              <p className="text-xs text-[var(--ink-faint)]">Applying a template pre-fills type and prices below (still editable).</p>
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

        {form.vendorUuid && (
          <button
            type="button"
            className="self-start text-xs font-medium text-[var(--accent)] underline-offset-2 hover:underline"
            onClick={() => navigate(`/trips/${tripUuid}/templates`, { state: { vendorUuid: form.vendorUuid } })}
            data-testid="manage-templates"
          >
            Manage buying templates
          </button>
        )}

        <SearchableSelect
          label="Type"
          value={form.productTypeUuid}
          onChange={handleTypeChange}
          placeholder="Select a type…"
          searchPlaceholder="Search types…"
          emptyMessage="No types available."
          options={parentTypes.map((t) => ({ value: t.uuid, label: t.name }))}
        />

        <SearchableSelect
          label="Subtype (optional)"
          value={form.subTypeUuid}
          onChange={set('subTypeUuid')}
          disabled={!form.productTypeUuid}
          searchPlaceholder="Search subtypes…"
          emptyMessage="No subtypes for this type."
          options={[
            { value: '', label: 'No subtype' },
            ...subtypeRows.map((t) => ({ value: t.uuid, label: t.name })),
          ]}
        />
        {!form.productTypeUuid && (
          <p className="text-xs text-[var(--ink-faint)]">Choose a type first.</p>
        )}

        <Input label="Stock name (optional)" value={form.name} onChange={set('name')} placeholder="e.g. Round-neck kurti" maxLength={200} />

        <Input label="Quantity" type="number" min={1} step={1} value={form.quantity} onChange={set('quantity')} required />

        <Input label="Buying price (₹)" value={form.buyingPricePaise} onChange={set('buyingPricePaise')} inputMode="decimal" required />
        <Input label="Whole stock buying price (₹)" value={form.wholeBuyingPricePaise} onChange={set('wholeBuyingPricePaise')} inputMode="decimal" hint="Optional total for the whole stock, if you bought it as a lot." />
        <Input label="Selling price (₹)" value={form.sellingPricePaise} onChange={set('sellingPricePaise')} inputMode="decimal" required />
        <Input label="Floor price (₹)" value={form.floorPricePaise} onChange={set('floorPricePaise')} inputMode="decimal" required hint="Cannot exceed selling price." />

        <SearchableSelect
          label="Channel"
          value={form.channel}
          onChange={set('channel')}
          options={[
            { value: CHANNEL.RETAIL, label: 'Retail' },
            { value: CHANNEL.RENTAL, label: 'Rental' },
          ]}
        />

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