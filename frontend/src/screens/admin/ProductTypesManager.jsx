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
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  getProductTypes,
  createProductType,
  updateProductType,
  deactivateProductType,
} from '../../services/picklistsApi.js';
import { buildProductTypeTree, collectDescendantUuids } from '../../platform/adminHelpers.js';

function Tree({ nodes, onEdit, onDeactivate, canUpdate, depth = 0 }) {
  return (
    <ul className={`list-none m-0 p-0 ${depth > 0 ? 'pl-6' : ''}`} role="tree">
      {nodes.map((node) => (
        <li key={node.uuid} className="py-1" role="treeitem" aria-expanded={node.children.length > 0}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{node.name}</span>
            {!node.isActive && <Badge variant="neutral">inactive</Badge>}
            {canUpdate && (
              <Button variant="outline" size="sm" onClick={() => onEdit(node)}>
                Edit
              </Button>
            )}
            {canUpdate && node.isActive && (
              <Button variant="ghost" size="sm" onClick={() => onDeactivate(node)}>
                Deactivate
              </Button>
            )}
          </div>
          {node.children.length > 0 && <Tree nodes={node.children} onEdit={onEdit} onDeactivate={onDeactivate} canUpdate={canUpdate} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export function ProductTypesManager() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);
  const canUpdate = can(PERMISSIONS.PICKLISTS.UPDATE);

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // UX-M4: destructive deactivation goes through an app Dialog, never a native
  // window.confirm (consistent styling + focus handling).
  const [confirmNode, setConfirmNode] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getProductTypes();
      setTypes(data);
    } catch (err) {
      setError(err.message || 'Failed to load product types');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tree = useMemo(() => buildProductTypeTree(types), [types]);

  const handleSave = async ({ name, parentUuid }) => {
    setSaving(true);
    try {
      if (editing) {
        const payload = { name };
        if (parentUuid !== undefined) payload.parentUuid = parentUuid;
        await updateProductType(editing.uuid, payload);
        toast.success({ title: 'Product type updated' });
      } else {
        await createProductType({ name, parentUuid: parentUuid || null });
        toast.success({ title: 'Product type created' });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error({ title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    const node = confirmNode;
    if (!node) return;
    setDeactivating(true);
    try {
      await deactivateProductType(node.uuid);
      toast.success({ title: 'Product type deactivated' });
      setConfirmNode(null);
      await load();
    } catch (err) {
      toast.error({ title: 'Deactivate failed', description: err.message });
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product types</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Hierarchical categories. Editing a parent picker omits itself and its descendants
            to prevent cycles.
          </p>
          {can(PERMISSIONS.PICKLISTS.CREATE) && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="pt-create">
              Add product type
            </Button>
          )}
        </div>

        {error && <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>}

        {loading ? (
          <p className="text-sm text-[var(--ink-muted)]">Loading product types…</p>
        ) : tree.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No product types yet.</p>
        ) : (
          <Tree
            nodes={tree}
            onEdit={(node) => { setEditing(node); setFormOpen(true); }}
            onDeactivate={(node) => setConfirmNode(node)}
            canUpdate={canUpdate}
          />
        )}
      </CardContent>

      {formOpen && (
        <ProductTypeFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          saving={saving}
          type={editing}
          allTypes={types}
        />
      )}

      <Dialog
        open={!!confirmNode}
        onClose={() => setConfirmNode(null)}
        title="Deactivate product type?"
        role="alertdialog"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmNode(null)} disabled={deactivating}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeactivate} loading={deactivating} data-testid="confirm-deactivate">
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Deactivate <span className="font-semibold">{confirmNode?.name || ''}</span>? Existing
          references keep working; it will no longer appear when creating new stock.
        </p>
      </Dialog>
    </Card>
  );
}

function ProductTypeFormDialog({ open, onClose, onSave, saving, type, allTypes }) {
  const isEdit = Boolean(type);
  const [name, setName] = useState(type?.name || '');
  const [parentUuid, setParentUuid] = useState(
    isEdit ? type.parentUuid || '' : ''
  );
  const [error, setError] = useState('');

  const excluded = useMemo(
    () => (isEdit ? collectDescendantUuids(allTypes, type.uuid) : new Set()),
    [isEdit, type, allTypes]
  );
  const parentOptions = allTypes.filter((t) => !excluded.has(t.uuid));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    let payloadParent;
    if (isEdit) {
      payloadParent = parentUuid === '' ? null : parentUuid;
    } else {
      payloadParent = parentUuid === '' ? null : parentUuid;
    }
    onSave({ name: name.trim(), parentUuid: payloadParent });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit product type' : 'Add product type'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="pt-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Add'}
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id="pt-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <SearchableSelect
              label="Parent"
              value={parentUuid}
              onChange={setParentUuid}
              options={[
                { value: '', label: '— Top level —' },
                ...parentOptions.map((t) => ({ value: t.uuid, label: t.name })),
              ]}
              searchPlaceholder="Search types…"
              emptyMessage="No parent types available."
            />
            <p className="text-xs text-[var(--ink-faint)]">Leave empty for a top-level type.</p>
            {error && (
              <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export default ProductTypesManager;
