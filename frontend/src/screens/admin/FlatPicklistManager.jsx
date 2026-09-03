import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  Dialog,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Badge,
  useToast,
} from '../../components/ui';
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
 * @param {Array<{key, label, type?, options?, required?, min?}>} props.fields - create/edit form fields
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

        {error && <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>}

        {loading ? (
          <p className="text-sm text-[var(--ink-muted)]">Loading {singular.toLowerCase()}s…</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((c) => (
                  <TableHeaderCell key={c.key}>{c.label}</TableHeaderCell>
                ))}
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.uuid}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>{item[c.key] != null ? String(item[c.key]) : '—'}</TableCell>
                  ))}
                  <TableCell>
                    <Badge variant={item.isActive ? 'success' : 'neutral'}>
                      {item.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {canUpdate && (
                        <Button variant="outline" size="sm" onClick={() => { setEditing(item); setFormOpen(true); }}>
                          Edit
                        </Button>
                      )}
                      {canUpdate && (
                        <Button variant="ghost" size="sm" onClick={() => handleToggleActive(item)}>
                          {item.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 2} className="text-sm text-[var(--ink-muted)]">
                    No {singular.toLowerCase()}s found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
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
      initial[f.key] = item && item[f.key] != null ? String(item[f.key]) : (f.defaultValue || '');
    });
    return initial;
  });
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const payload = {};
    for (const f of fields) {
      const raw = form[f.key];
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
        <Select key={f.key} label={f.label} value={form[f.key]} onChange={set(f.key)}>
          <option value="" disabled>
            Select {f.label.toLowerCase()}…
          </option>
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
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
              <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
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

export default FlatPicklistManager;
