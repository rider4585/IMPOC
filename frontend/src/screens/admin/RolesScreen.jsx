import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Select,
  Dialog,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  assignPermissionToRole,
  removePermissionFromRole,
} from '../../services/rolesApi.js';
import { getPermissions } from '../../services/permissionsApi.js';
import { RoleFormDialog } from './RoleFormDialog.jsx';

export function RolesScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canManage = can(PERMISSIONS.ROLES.MANAGE);

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [saving, setSaving] = useState(false);

  const [permsOpen, setPermsOpen] = useState(false);
  const [permsTarget, setPermsTarget] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]);
  const [assignedPerms, setAssignedPerms] = useState([]);
  const [permsLoading, setPermsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRoles();
      setRoles(data);
    } catch (err) {
      setError(err.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingRole(null);
    setFormOpen(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    setFormOpen(true);
  };

  const handleSave = async ({ name, description }) => {
    setSaving(true);
    try {
      if (editingRole) {
        await updateRole(editingRole.uuid, { name, description: description || null });
        toast.success({ title: 'Role updated' });
      } else {
        await createRole({ name, description: description || null });
        toast.success({ title: 'Role created' });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error({ title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (!canManage) return;
    if (!window.confirm(`Delete role ${role.name}?`)) return;
    try {
      await deleteRole(role.uuid);
      toast.success({ title: 'Role deleted' });
      await load();
    } catch (err) {
      toast.error({ title: 'Delete failed', description: err.message });
    }
  };

  const openPermsDialog = async (role) => {
    setPermsTarget(role);
    setPermsOpen(true);
    setPermsLoading(true);
    try {
      const [all, assigned] = await Promise.all([
        getPermissions(),
        getRolePermissions(role.uuid),
      ]);
      setAllPermissions(all);
      setAssignedPerms(assigned);
    } catch (err) {
      toast.error({ title: 'Failed to load permissions', description: err.message });
      setAllPermissions([]);
      setAssignedPerms([]);
    } finally {
      setPermsLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    const permissionUuid = e.target.elements.permission.value;
    try {
      const added = await assignPermissionToRole(permsTarget.uuid, permissionUuid);
      setAssignedPerms((prev) => [...prev, added]);
      toast.success({ title: 'Permission assigned' });
    } catch (err) {
      toast.error({ title: 'Assign failed', description: err.message });
    }
  };

  const handleRemovePerm = async (permission) => {
    try {
      await removePermissionFromRole(permsTarget.uuid, permission.uuid);
      setAssignedPerms((prev) => prev.filter((p) => p.uuid !== permission.uuid));
      toast.success({ title: 'Permission removed' });
    } catch (err) {
      toast.error({ title: 'Remove failed', description: err.message });
    }
  };

  const availablePerms = allPermissions.filter(
    (p) => !assignedPerms.some((a) => a.uuid === p.uuid)
  );

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Roles</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Create and manage roles and their permission sets.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} data-testid="role-create">
            Create role
          </Button>
        )}
      </div>

      {error && <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>}

      {can(PERMISSIONS.ROLES.VIEW) && (
        <Card>
          <CardHeader>
            <CardTitle>All roles</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <p className="text-sm text-[var(--ink-muted)]">Loading roles…</p>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Description</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.uuid}>
                      <TableCell>{role.name}</TableCell>
                      <TableCell>{role.description || '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {canManage && (
                            <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                              Edit
                            </Button>
                          )}
                          {canManage && (
                            <Button variant="outline" size="sm" onClick={() => openPermsDialog(role)}>
                              Permissions
                            </Button>
                          )}
                          {canManage && (
                            <Button variant="danger" size="sm" onClick={() => handleDelete(role)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {roles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-[var(--ink-muted)]">
                        No roles found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {formOpen && (
        <RoleFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          saving={saving}
          role={editingRole}
        />
      )}

      {permsOpen && (
        <Dialog
          open={permsOpen}
          onClose={() => setPermsOpen(false)}
          title={`Permissions — ${permsTarget?.name || ''}`}
          footer={
            <Button variant="outline" onClick={() => setPermsOpen(false)}>
              Close
            </Button>
          }
        >
          <Card>
            <CardContent>
              {permsLoading ? (
                <p className="text-sm text-[var(--ink-muted)]">Loading permissions…</p>
              ) : (
                <>
                  <h3 className="typography-label">Assigned permissions</h3>
                  {assignedPerms.length === 0 ? (
                    <p className="text-sm text-[var(--ink-muted)]">No permissions assigned.</p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {assignedPerms.map((p) => (
                        <li
                          key={p.uuid}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-sunken)] px-2 py-0.5 text-[13px] text-[var(--ink)]"
                        >
                          <span title={p.description || undefined}>{p.name}</span>
                          {canManage && (
                            <button
                              type="button"
                              className="cursor-pointer border-none bg-transparent text-[16px] leading-none text-[var(--ink-muted)] hover:text-[var(--danger)]"
                              aria-label={`Remove permission ${p.name}`}
                              onClick={() => handleRemovePerm(p)}
                            >
                              &times;
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {canManage && availablePerms.length > 0 && (
                    <form onSubmit={handleAssign} className="mt-4 flex flex-wrap items-end gap-3">
                      <div className="flex-1">
                        <Select name="permission" label="Add permission" defaultValue="">
                          <option value="" disabled>
                            Select a permission…
                          </option>
                          {availablePerms.map((p) => (
                            <option key={p.uuid} value={p.uuid}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button type="submit" size="sm">
                        Assign
                      </Button>
                    </form>
                  )}
                  {canManage && availablePerms.length === 0 && (
                    <p className="text-sm text-[var(--ink-muted)]">All permissions are already assigned.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Dialog>
      )}
    </div>
  );
}

export default RolesScreen;
