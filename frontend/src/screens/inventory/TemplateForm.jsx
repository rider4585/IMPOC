import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, Button, Input, Select, Dialog, useToast } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../../services/templatesApi.js';
import { getProductTypes } from '../../services/picklistsApi.js';
import { getVendors } from '../../services/vendorsApi.js';
import { formatPaiseForInput, parseRupeesToPaise } from '../../platform/moneyInput.js';
import { formatPaise } from '../../platform/money.js';

function emptyForm() {
  return {
    name: '',
    productTypeUuid: '',
    subTypeUuid: '',
    buyingPricePaise: '',
    wholeBuyingPricePaise: '',
    defaultQuantity: '',
    defaultSellingPricePaise: '',
    defaultFloorPricePaise: '',
  };
}

function rupeeOrEmpty(paise) {
  if (paise == null || Number.isNaN(Number(paise))) return '';
  return formatPaiseForInput(Number(paise));
}

function typeNameOf(tpl, rows) {
  if (tpl?.productType?.name) return tpl.productType.name;
  const t = rows.find((r) => r.uuid === tpl?.productTypeUuid);
  return t?.name || '';
}

function subTypeNameOf(tpl, rows) {
  if (tpl?.subType?.name) return tpl.subType.name;
  const t = rows.find((r) => r.uuid === tpl?.subTypeUuid);
  return t?.name || '';
}

export function TemplateForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);
  const canManage = can(PERMISSIONS.INVENTORY.CREATE);

  const navVendorUuid = location.state?.vendorUuid || '';
  const [vendorUuid, setVendorUuid] = useState(navVendorUuid);
  const [vendors, setVendors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const productTypeRows = Array.isArray(productTypes) ? productTypes : [];
  const parentTypes = productTypeRows.filter((t) => !t.parentUuid && t.isActive !== false);
  const subtypeRows = productTypeRows.filter((t) => t.parentUuid === form.productTypeUuid && t.isActive !== false);

  useEffect(() => {
    getProductTypes().then(setProductTypes).catch(() => {});
    if (navVendorUuid) return;
    getVendors()
      .then((list) => setVendors(Array.isArray(list) ? list : []))
      .catch(() => setVendors([]));
  }, [navVendorUuid]);

  const loadTemplates = useCallback(async (vuuid) => {
    if (!vuuid) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    try {
      const list = await getTemplates(vuuid);
      setTemplates(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!vendorUuid) return;
    let cancelled = false;
    getTemplates(vendorUuid)
      .then((list) => {
        if (cancelled) return;
        setTemplates(Array.isArray(list) ? list : []);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [vendorUuid]);

  const changeVendor = (e) => {
    const vuuid = e.target.value;
    setVendorUuid(vuuid);
    setEditing(null);
    setError('');
  };

  const startCreate = () => {
    setForm(emptyForm());
    setFormError('');
    setEditing({});
  };

  const startEdit = (tpl) => {
    setForm({
      name: tpl.name || '',
      productTypeUuid: tpl.productTypeUuid || '',
      subTypeUuid: tpl.subTypeUuid || '',
      buyingPricePaise: rupeeOrEmpty(tpl.buyingPricePaise),
      wholeBuyingPricePaise: rupeeOrEmpty(tpl.wholeBuyingPricePaise),
      defaultQuantity: tpl.defaultQuantity != null ? String(tpl.defaultQuantity) : '',
      defaultSellingPricePaise: rupeeOrEmpty(tpl.defaultSellingPricePaise),
      defaultFloorPricePaise: rupeeOrEmpty(tpl.defaultFloorPricePaise),
    });
    setFormError('');
    setEditing(tpl);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleTypeChange = (e) => {
    const typeUuid = e.target.value;
    setForm((f) => ({ ...f, productTypeUuid: typeUuid, subTypeUuid: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!vendorUuid) { setFormError('Please select a vendor.'); return; }
    if (!form.productTypeUuid) { setFormError('Please select a product type.'); return; }

    const buying = parseRupeesToPaise(form.buyingPricePaise);
    if (Number.isNaN(buying)) { setFormError('Buying price per unit must be a valid rupee amount.'); return; }

    const wholeRaw = String(form.wholeBuyingPricePaise || '').trim();
    let whole = null;
    if (wholeRaw !== '') {
      whole = parseRupeesToPaise(wholeRaw);
      if (Number.isNaN(whole)) { setFormError('Whole stock buying price must be a valid rupee amount.'); return; }
    }

    const sellRaw = String(form.defaultSellingPricePaise || '').trim();
    let sell;
    if (sellRaw !== '') {
      sell = parseRupeesToPaise(sellRaw);
      if (Number.isNaN(sell)) { setFormError('Default selling price must be a valid rupee amount.'); return; }
    }

    const floorRaw = String(form.defaultFloorPricePaise || '').trim();
    let floor;
    if (floorRaw !== '') {
      floor = parseRupeesToPaise(floorRaw);
      if (Number.isNaN(floor)) { setFormError('Default floor price must be a valid rupee amount.'); return; }
    }

    const qtyRaw = String(form.defaultQuantity || '').trim();
    let qty;
    if (qtyRaw !== '') {
      qty = Number(qtyRaw);
      if (!Number.isInteger(qty) || qty < 1) { setFormError('Default quantity must be a whole number of at least 1.'); return; }
    }

    const payload = {
      vendorUuid,
      productTypeUuid: form.productTypeUuid,
      subTypeUuid: form.subTypeUuid || null,
      name: form.name.trim() || undefined,
      buyingPricePaise: buying,
      wholeBuyingPricePaise: whole,
      defaultQuantity: qty,
      defaultSellingPricePaise: sell,
      defaultFloorPricePaise: floor,
    };

    if (editing?.uuid) {
      doSave('Template updated', updateTemplate(editing.uuid, payload));
    } else {
      doSave('Template created', createTemplate(payload));
    }
  };

  const doSave = async (title, promise) => {
    setSaving(true);
    try {
      await promise;
      toast.success({ title });
      setEditing(null);
      await loadTemplates(vendorUuid);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.uuid);
      toast.success({ title: 'Template deleted' });
      setDeleteTarget(null);
      await loadTemplates(vendorUuid);
    } catch (err) {
      toast.error({ title: 'Delete failed', description: err.message });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to manage buying templates.</p>
      </div>
    );
  }

  const selectedVendor = vendors.find((v) => v.uuid === vendorUuid);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>&larr; Back</Button>
          <h1 className="typography-heading mb-1 mt-1">Buying templates</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            {selectedVendor ? `For ${selectedVendor.name}` : 'Per-vendor buying templates that pre-fill stock intake.'}
          </p>
        </div>
      </div>

      {!navVendorUuid && (
        <Select label="Vendor" value={vendorUuid} onChange={changeVendor} required>
          <option value="">Select a vendor…</option>
          {vendors.map((v) => (
            <option key={v.uuid} value={v.uuid}>{v.name}</option>
          ))}
        </Select>
      )}

      {editing !== null ? (
        <Card>
          <CardContent>
            <h2 className="mb-3 text-base font-semibold text-[var(--ink)]">
              {editing?.uuid ? 'Edit template' : 'New template'}
            </h2>
            <form id="template-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Select label="Type" value={form.productTypeUuid} onChange={handleTypeChange} required>
                <option value="">Select a type…</option>
                {parentTypes.map((t) => (
                  <option key={t.uuid} value={t.uuid}>{t.name}</option>
                ))}
              </Select>

              <Select
                label="Subtype (optional)"
                value={form.subTypeUuid}
                onChange={set('subTypeUuid')}
                disabled={!form.productTypeUuid}
                hint={!form.productTypeUuid ? 'Choose a type first.' : undefined}
              >
                <option value="">No subtype</option>
                {subtypeRows.map((t) => (
                  <option key={t.uuid} value={t.uuid}>{t.name}</option>
                ))}
              </Select>

              <Input label="Template name (optional)" value={form.name} onChange={set('name')} placeholder="e.g. Paithani weekly" maxLength={200} />

              <Input label="Buying price per unit (₹)" value={form.buyingPricePaise} onChange={set('buyingPricePaise')} inputMode="decimal" required />
              <Input label="Whole stock buying price (₹)" value={form.wholeBuyingPricePaise} onChange={set('wholeBuyingPricePaise')} inputMode="decimal" hint="Optional total for the whole stock, if you bought it as a lot." />

              <Input label="Default quantity" type="number" min={1} step={1} value={form.defaultQuantity} onChange={set('defaultQuantity')} hint="Optional" />
              <Input label="Default selling price (₹)" value={form.defaultSellingPricePaise} onChange={set('defaultSellingPricePaise')} inputMode="decimal" />
              <Input label="Default floor price (₹)" value={form.defaultFloorPricePaise} onChange={set('defaultFloorPricePaise')} inputMode="decimal" hint="Cannot exceed selling price." />

              {formError && (
                <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{formError}</div>
              )}
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={startCreate} data-testid="new-template" disabled={!vendorUuid}>
              New template
            </Button>
          </div>

          {error && (
            <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
          )}

          {loading && <p className="text-xs text-[var(--ink-muted)]">Loading templates…</p>}

          {!loading && !error && templates.length === 0 && vendorUuid && (
            <p className="text-sm text-[var(--ink-muted)]">No buying templates saved for this vendor yet.</p>
          )}

          {!vendorUuid && (
            <p className="text-sm text-[var(--ink-muted)]">Select a vendor to see its buying templates.</p>
          )}

          <div className="flex flex-col gap-3">
            {templates.map((tpl) => {
              const typeName = typeNameOf(tpl, productTypeRows);
              const subName = subTypeNameOf(tpl, productTypeRows);
              return (
                <Card key={tpl.uuid}>
                  <CardContent>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--ink)]">{tpl.name || 'Untitled template'}</p>
                        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                          {typeName || 'Type'}
                          {subName ? ` · ${subName}` : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                          Buy {formatPaise(Number(tpl.buyingPricePaise))}/unit
                          {tpl.wholeBuyingPricePaise != null && (
                            <> · Whole {formatPaise(Number(tpl.wholeBuyingPricePaise))}</>
                          )}
                          {tpl.defaultQuantity != null && (
                            <> · Qty {tpl.defaultQuantity}</>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(tpl)}>Edit</Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleteTarget(tpl)}>Delete</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {editing !== null && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
          <Button type="submit" form="template-form" loading={saving}>
            {editing?.uuid ? 'Save changes' : 'Create template'}
          </Button>
        </div>
      )}

      {deleteTarget && (
        <Dialog
          open
          onClose={() => setDeleteTarget(null)}
          title="Delete template"
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
            </>
          }
        >
          <p className="text-sm text-[var(--ink-muted)]">
            Delete “{deleteTarget.name || 'Untitled template'}”? Stocks already created from this template are not affected.
          </p>
        </Dialog>
      )}
    </div>
  );
}

export default TemplateForm;