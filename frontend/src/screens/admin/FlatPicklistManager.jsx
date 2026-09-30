import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  SearchableSelect,
  Dialog,
  Badge,
  useToast,
  ActionMenu,
} from '../../components/ui/index.js';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { createPicklistItem, updatePicklistItem } from '../../services/picklistsApi.js';

/**
 * Generic manager for the flat picklists (colours, sizes, damage-grades).
 *
 * @param {Object} props
 * @param {string} props.resource - key used by picklistsApi ('colours' | 'sizes' | 'damageGrades')
 * @param {string} props.singular - human-readable singular label (e.g. "colour")
 * @param {Array<{list}>} props.source - load function returning the list
 * @param {Array<{key, label, type?, options?, required?}>} props.columns - table display columns
 *   (`type: 'boolean'` renders a Yes/No badge instead of the raw value)
 * @param {Array<{key, label, type?, options?, required?, min?}>} props.fields - create/edit form fields
 *   (`type: 'checkbox'` is a boolean toggle; it always sends true/false)
 */
export function FlatPicklistManager({
  resource,
  singular,
  source,
  columns,
  fields,
}) {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canUpdate = can(PERMISSIONS.PICKLISTS.UPDATE);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await source();
      setItems(data);
    } catch (err) {
      setError(err.message || `Failed to load ${singular}s`);
    } finally {
      setLoading(false);
    }
  }, [source, singular]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        await updatePicklistItem(resource, editing.uuid, payload);
        toast.success({ title: `${singular} updated` });
      } else {
        await createPicklistItem(resource, payload);
        toast.success({ title: `${singular} created` });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error({ title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item) => {
    if (!canUpdate) return;
    try {
      await updatePicklistItem(resource, item.uuid, { isActive: !item.isActive });
      toast.success({ title: `${singular} ${item.isActive ? 'deactivated' : 'activated'}` });
      await load();
    } catch (err) {
      toast.error({ title: 'Update failed', description: err.message });
    }
  };

  const dgColumns = useMemo(() => {
    const cols = columns.map((c) => ({
      accessorKey: c.key,
      header: c.label,
      size: 150,
      filter: { type: 'text' },
      cell: (info) => {
        if (c.type === 'boolean') {
          return (
            <Badge variant={info.getValue() ? 'success' : 'neutral'}>
              {info.getValue() ? 'Yes' : 'No'}
            </Badge>
          );
        }
        return info.getValue() != null ? String(info.getValue()) : '—';
      },
    }));
    cols.push({
      accessorKey: 'isActive',
      header: 'Status',
      size: 120,
      cell: (info) => (
        <Badge variant={info.getValue() ? 'success' : 'neutral'}>
          {info.getValue() ? 'active' : 'inactive'}
        </Badge>
      ),
      enableSorting: false,
    });
    cols.push({
      id: 'actions',
      header: 'Actions',
      size: 130,
      cell: (info) => {
        const item = info.row.original;
        return (
          <ActionMenu
            primary={
              canUpdate
                ? {
                    label: 'Edit',
                    onClick: () => {
                      setEditing(item);
                      setFormOpen(true);
                    },
                    dataTestid: `picklist-edit-${item.uuid}`,
                  }
                : null
            }
            items={[
              canUpdate && {
                label: item.isActive ? 'Deactivate' : 'Activate',
                onClick: () => handleToggleActive(item),
                danger: item.isActive,
                dataTestid: `picklist-status-${item.uuid}`,
              },
            ]}
            dataTestid={`picklist-actions-${item.uuid}`}
          />
        );
      },
      enableSorting: false,
    });
    return cols;
  }, [columns, canUpdate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{singular}s</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Manage {singular.toLowerCase()} picklist values.
          </p>
          {can(PERMISSIONS.PICKLISTS.CREATE) && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              Add {singular.toLowerCase()}
            </Button>
          )}
        </div>

        {error && <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)] max-md:min-h-[360px] max-md:min-h-[45vh]">
          <DataGrid
            data={items}
            columns={dgColumns}
            isLoading={loading}
            isEmpty={items.length === 0}
            emptyMessage={`No ${singular.toLowerCase()}s found.`}
            loadingMessage={`Loading ${singular.toLowerCase()}s…`}
          />
        </div>
      </CardContent>

      {formOpen && (
        <FlatPicklistFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          saving={saving}
          item={editing}
          singular={singular}
          fields={fields}
        />
      )}
    </Card>
  );
}

function FlatPicklistFormDialog({ open, onClose, onSave, saving, item, singular, fields }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState(() => {
    const initial = {};
    fields.forEach((f) => {
      if (f.type === 'checkbox') {
        initial[f.key] = toBool(item ? item[f.key] : undefined, f.defaultValue);
        return;
      }
      initial[f.key] = item && item[f.key] != null ? String(item[f.key]) : (f.defaultValue || '');
    });
    return initial;
  });
  const [error, setError] = useState('');

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e && e.target ? e.target.value : e }));

  const setChecked = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: Boolean(e && e.target && e.target.checked) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const payload = {};
    for (const f of fields) {
      const raw = form[f.key];
      if (f.type === 'checkbox') {
        // A checkbox is a real boolean flag: always sent, even when false.
        payload[f.key] = toBool(raw, f.defaultValue);
        continue;
      }
      if (f.type === 'number') {
        if (raw === '') {
          if (f.required) {
            setError(`${f.label} is required.`);
            return;
          }
          continue;
        }
        const num = Number(raw);
        if (!Number.isInteger(num) || num < 0) {
          setError(`${f.label} must be a non-negative integer.`);
          return;
        }
        payload[f.key] = num;
      } else {
        if (f.required && (!raw || !String(raw).trim())) {
          setError(`${f.label} is required.`);
          return;
        }
        const value = String(raw).trim();
        if (value === '') continue;
        payload[f.key] = value;
      }
    }
    onSave(payload);
  };

  const renderControl = (f) => {
    if (f.type === 'checkbox') {
      return (
        <label
          key={f.key}
          className="flex cursor-pointer items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2"
        >
          <input
            type="checkbox"
            checked={toBool(form[f.key], f.defaultValue)}
            onChange={setChecked(f.key)}
            data-testid={`flat-field-${f.key}`}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span className="text-sm font-medium text-[var(--ink)]">{f.label}</span>
          {f.hint && <span className="text-xs text-[var(--ink-muted)]">{f.hint}</span>}
        </label>
      );
    }
    if (f.type === 'number') {
      return (
        <Input
          key={f.key}
          label={f.label}
          type="number"
          min="0"
          step="1"
          value={form[f.key]}
          onChange={set(f.key)}
          hint={f.hint}
        />
      );
    }
    if (f.options) {
      return (
        <SearchableSelect
          key={f.key}
          label={f.label}
          value={form[f.key]}
          onChange={set(f.key)}
          placeholder={`Select ${f.label.toLowerCase()}…`}
          options={f.options.map((o) => ({ value: o, label: o }))}
        />
      );
    }
    return (
      <Input key={f.key} label={f.label} value={form[f.key]} onChange={set(f.key)} />
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'Add'} ${singular.toLowerCase()}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={`flat-form-${resourceName(singular)}`} loading={saving}>
            {isEdit ? 'Save changes' : 'Add'}
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id={`flat-form-${resourceName(singular)}`} onSubmit={handleSubmit} className="flex flex-col gap-4">
            {fields.map(renderControl)}
            {error && (
              <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

function resourceName(singular) {
  return singular.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * Coerce a checkbox field value to a real boolean. The API sends booleans, but a
 * form default or a hand-edited payload can arrive as the string "true"/"false",
 * and a bare "" must fall back to the field default rather than false-y noise.
 */
function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return Boolean(fallback);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
}

export default FlatPicklistManager;
