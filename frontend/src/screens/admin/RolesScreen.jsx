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
import './admin.css';

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
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1 className="typography-heading">Roles</h1>
          <p className="typography-body-sm admin-page__subtitle">
            Create and manage roles and their permission sets.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} data-testid="role-create">
            Create role
          </Button>
        )}
      </div>

      {error && <div className="admin-error" role="alert">{error}</div>}

      {can(PERMISSIONS.ROLES.VIEW) && (
        <Card>
          <CardHeader>
            <CardTitle>All roles</CardTitle>
          </CardHeader>
          <CardContent className="admin-card__content">
            {loading ? (
              <p className="admin-muted">Loading roles…</p>
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
                        <div className="admin-actions">
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
                      <TableCell colSpan={3} className="admin-muted">
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
                <p className="admin-muted">Loading permissions…</p>
              ) : (
                <>
                  <h3 className="typography-label">Assigned permissions</h3>
                  {assignedPerms.length === 0 ? (
                    <p className="admin-muted">No permissions assigned.</p>
                  ) : (
                    <ul className="admin-chip-list">
                      {assignedPerms.map((p) => (
                        <li key={p.uuid} className="admin-chip">
                          <span title={p.description || undefined}>{p.name}</span>
                          {canManage && (
                            <button
                              type="button"
                              className="admin-chip__remove"
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
                    <form onSubmit={handleAssign} className="admin-inline-form">
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
                      <Button type="submit" size="sm">
                        Assign
                      </Button>
                    </form>
                  )}
                  {canManage && availablePerms.length === 0 && (
                    <p className="admin-muted">All permissions are already assigned.</p>
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
