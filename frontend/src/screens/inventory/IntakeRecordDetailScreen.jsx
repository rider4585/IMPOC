import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  Dialog,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  getIntakeRecord,
  createIntakeTemplate,
  updateIntakeTemplate,
  deleteIntakeTemplate,
} from '../../services/intakeRecordsApi.js';
import { getVendors } from '../../services/vendorsApi.js';
import { getProductTypes } from '../../services/picklistsApi.js';
import { buildProductTypeTree } from '../../platform/adminHelpers.js';
import { formatPaise } from '../../platform/money.js';
import { parseRupeesToPaise, formatPaiseForInput } from '../../platform/moneyInput.js';

const EMPTY_FORM = {
  name: '',
  productTypeUuid: '',
  buyingPrice: '',
  defaultQuantity: '',
  defaultSellingPrice: '',
  defaultFloorPrice: '',
};

function flattenTree(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ ...node, depth });
    if (node.children && node.children.length) {
      flattenTree(node.children, depth + 1, out);
    }
  }
  return out;
}

export function IntakeRecordDetailScreen() {
  const { intakeUuid } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { permissions } = useAuth();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const [record, setRecord] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tplOpen, setTplOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editUuid, setEditUuid] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tplError, setTplError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const typeOptions = useMemo(
    () => flattenTree(buildProductTypeTree(productTypes)),
    [productTypes]
  );

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const loadRecord = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getIntakeRecord(intakeUuid);
      setRecord(data);
    } catch (err) {
      setError(err.message || 'Failed to load intake record');
    } finally {
      setLoading(false);
    }
  }, [intakeUuid]);

  useEffect(() => {
    loadRecord();
    getVendors()
      .then((data) => setVendors(Array.isArray(data) ? data : []))
      .catch(() => {});
    getProductTypes()
      .then((data) => setProductTypes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [loadRecord]);

  if (!can(PERMISSIONS.INVENTORY.VIEW)) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">
          You do not have permission to view intake records.
        </p>
      </div>
    );
  }

  const vendor = vendors.find((v) => v.uuid === record?.vendorUuid);

  const openCreate = () => {
    setIsEdit(false);
    setEditUuid(null);
    setForm(EMPTY_FORM);
    setTplError('');
    setTplOpen(true);
  };

  const openEdit = (tpl) => {
    setIsEdit(true);
    setEditUuid(tpl.uuid);
    setForm({
      name: tpl.name || '',
      productTypeUuid: tpl.productTypeUuid || '',
      buyingPrice: tpl.buyingPricePaise != null ? formatPaiseForInput(Number(tpl.buyingPricePaise)) : '',
      defaultQuantity: tpl.defaultQuantity != null ? String(tpl.defaultQuantity) : '',
      defaultSellingPrice:
        tpl.defaultSellingPricePaise != null ? formatPaiseForInput(Number(tpl.defaultSellingPricePaise)) : '',
      defaultFloorPrice:
        tpl.defaultFloorPricePaise != null ? formatPaiseForInput(Number(tpl.defaultFloorPricePaise)) : '',
    });
    setTplError('');
    setTplOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTplError('');
    if (!form.productTypeUuid) {
      setTplError('Please select a type / subtype');
      return;
    }
    const buyingPrice = parseRupeesToPaise(form.buyingPrice);
    if (Number.isNaN(buyingPrice) || buyingPrice < 0) {
      setTplError('Enter a valid buying price');
      return;
    }
    let sellingPrice = null;
    if (form.defaultSellingPrice) {
      sellingPrice = parseRupeesToPaise(form.defaultSellingPrice);
      if (Number.isNaN(sellingPrice)) {
        setTplError('Enter a valid default selling price');
        return;
      }
    }
    let floorPrice = null;
    if (form.defaultFloorPrice) {
      floorPrice = parseRupeesToPaise(form.defaultFloorPrice);
      if (Number.isNaN(floorPrice)) {
        setTplError('Enter a valid default floor price');
        return;
      }
    }
    if (floorPrice != null && sellingPrice != null && floorPrice > sellingPrice) {
      setTplError('Floor price cannot exceed selling price');
      return;
    }
    let quantity = null;
    if (form.defaultQuantity) {
      quantity = Number(form.defaultQuantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setTplError('Default quantity must be a positive whole number');
        return;
      }
    }

    const payload = {
      name: form.name.trim() || null,
      productTypeUuid: form.productTypeUuid,
      buyingPricePaise: buyingPrice,
      defaultQuantity: quantity,
      defaultSellingPricePaise: sellingPrice,
      defaultFloorPricePaise: floorPrice,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateIntakeTemplate(intakeUuid, editUuid, payload);
        toast.success({ title: 'Template updated' });
      } else {
        await createIntakeTemplate(intakeUuid, payload);
        toast.success({ title: 'Template created' });
      }
      setTplOpen(false);
      await loadRecord();
    } catch (err) {
      setTplError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tpl) => {
    if (!window.confirm(`Delete template "${tpl.name || 'untitled'}"?`)) return;
    try {
      await deleteIntakeTemplate(intakeUuid, tpl.uuid);
      toast.success({ title: 'Template deleted' });
      await loadRecord();
    } catch (err) {
      toast.error({ title: 'Delete failed', description: err.message });
    }
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            className="mb-2 border-none bg-transparent p-0 text-sm text-[var(--ink-muted)] hover:text-primary"
            onClick={() => navigate('/intake-records')}
          >
            ← Back to intake records
          </button>
          <h1 className="typography-heading mb-1">{record?.name || 'Intake record'}</h1>
          {record && (
            <p className="typography-body-sm text-[var(--ink-muted)]">
              {new Date(record.purchasedOn + 'T00:00:00').toLocaleDateString()}
              {vendor ? ` · ${vendor.name}` : ''}
              {record.status === 'closed' ? ' · Closed' : ''}
            </p>
          )}
          {record?.notes ? (
            <p className="typography-body-sm mt-2 max-w-2xl text-[var(--ink-muted)]">
              {record.notes}
            </p>
          ) : null}
        </div>
        {can(PERMISSIONS.INVENTORY.CREATE) && (
          <Button onClick={openCreate} data-testid="template-create">
            New template
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-md bg-[var(--surface-sunken)]"
                />
              ))}
            </div>
          ) : !record ? (
            <p className="text-sm text-[var(--ink-muted)]">Record not found.</p>
          ) : record.templates.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">
              No templates yet. Add templates for each type/subtype bought on this day —
              their buying price will pre-fill when you scan stock.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {record.templates.map((t) => (
                <li
                  key={t.uuid}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-white p-3 text-sm"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-[var(--ink)]">
                      {t.name || 'Untitled template'}
                    </span>
                    {t.productTypeUuid && (
                      <span className="text-xs text-[var(--ink-muted)]">
                        {productTypeLabel(productTypes, t.productTypeUuid)}
                      </span>
                    )}
                    <span className="text-xs text-[var(--ink-muted)]">
                      Buy {formatPaise(Number(t.buyingPricePaise))}
                      {t.defaultSellingPricePaise != null
                        ? ` · Sell ${formatPaise(Number(t.defaultSellingPricePaise))}`
                        : ''}
                      {t.defaultFloorPricePaise != null
                        ? ` · Floor ${formatPaise(Number(t.defaultFloorPricePaise))}`
                        : ''}
                      {t.defaultQuantity != null ? ` · Qty ${t.defaultQuantity}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {can(PERMISSIONS.INVENTORY.UPDATE) && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                        Edit
                      </Button>
                    )}
                    {can(PERMISSIONS.INVENTORY.DELETE) && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(t)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        title={isEdit ? 'Edit template' : 'New template'}
        footer={
          <>
            <Button variant="outline" onClick={() => setTplOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="template-form" loading={saving}>
              {isEdit ? 'Save changes' : 'Create template'}
            </Button>
          </>
        }
      >
        <form id="template-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Name"
            placeholder="e.g. Paithani bulk"
            value={form.name}
            onChange={set('name')}
            maxLength={200}
          />
          <Select label="Type / subtype" value={form.productTypeUuid} onChange={set('productTypeUuid')}>
            <option value="">-- Select type --</option>
            {typeOptions.map((t) => (
              <option key={t.uuid} value={t.uuid}>
                {'— '.repeat(t.depth)}
                {t.name}
              </option>
            ))}
          </Select>
          <Input
            label="Buying price (₹)"
            placeholder="e.g. 450"
            inputMode="decimal"
            value={form.buyingPrice}
            onChange={set('buyingPrice')}
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Default qty"
              placeholder="e.g. 10"
              inputMode="numeric"
              value={form.defaultQuantity}
              onChange={set('defaultQuantity')}
            />
            <Input
              label="Default sell (₹)"
              placeholder="optional"
              inputMode="decimal"
              value={form.defaultSellingPrice}
              onChange={set('defaultSellingPrice')}
            />
            <Input
              label="Default floor (₹)"
              placeholder="optional"
              inputMode="decimal"
              value={form.defaultFloorPrice}
              onChange={set('defaultFloorPrice')}
            />
          </div>
          {tplError && (
            <div
              className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]"
              role="alert"
            >
              {tplError}
            </div>
          )}
        </form>
      </Dialog>
    </div>
  );
}

function productTypeLabel(allTypes, uuid) {
  const found = allTypes.find((t) => t.uuid === uuid);
  if (!found) return 'Type';
  const parent = found.parentUuid
    ? allTypes.find((t) => t.uuid === found.parentUuid)
    : null;
  return parent ? `${parent.name} → ${found.name}` : found.name;
}

export default IntakeRecordDetailScreen;
