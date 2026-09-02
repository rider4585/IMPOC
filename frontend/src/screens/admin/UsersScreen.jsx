import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  getUsers,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  getUserRoles,
  assignRoleToUser,
  removeRoleFromUser,
} from '../../services/usersApi.js';
import { getRoles } from '../../services/rolesApi.js';
import { UserFormDialog } from './UserFormDialog.jsx';
import './admin.css';

const USER_STATUS_BADGE = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'warning',
};

export function UsersScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback(
    (p) => permissions && permissions.includes(p),
    [permissions]
  );

  const canCreate = can(PERMISSIONS.USERS.CREATE);
  const canUpdate = can(PERMISSIONS.USERS.UPDATE);
  const canDelete = can(PERMISSIONS.USERS.DELETE);

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const [rolesOpen, setRolesOpen] = useState(false);
  const [rolesTarget, setRolesTarget] = useState(null);
  const [assignedRoles, setAssignedRoles] = useState([]);
  const [roleSaveLoading, setRoleSaveLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [userData, roleData] = await Promise.all([getUsers(), getRoles()]);
      setUsers(userData);
      setRoles(roleData);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.username, u.email, u.firstName, u.lastName, u.phone]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [users, search]);

  const openCreate = () => {
    if (!canCreate) return;
    setEditingUser(null);
    setFormOpen(true);
  };

  const openEdit = (user) => {
    if (!canUpdate) return;
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.uuid, payload);
        toast.success({ title: 'User updated' });
      } else {
        await createUser(payload);
        toast.success({ title: 'User created' });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error({ title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!canDelete) return;
    if (!window.confirm(`Delete user ${user.username}?`)) return;
    try {
      await deleteUser(user.uuid);
      toast.success({ title: 'User deleted' });
      await load();
    } catch (err) {
      toast.error({ title: 'Delete failed', description: err.message });
    }
  };

  const handleStatusToggle = async (user) => {
    if (!canUpdate) return;
    const next = user.status === 'active' ? 'inactive' : 'active';
    try {
      await updateUserStatus(user.uuid, next);
      toast.success({ title: `User ${next}` });
      await load();
    } catch (err) {
      toast.error({ title: 'Status update failed', description: err.message });
    }
  };

  const openRoleDialog = async (user) => {
    if (!canUpdate) return;
    setRolesTarget(user);
    setRolesOpen(true);
    try {
      const assigned = await getUserRoles(user.uuid);
      setAssignedRoles(assigned);
    } catch (err) {
      toast.error({ title: 'Failed to load roles', description: err.message });
      setAssignedRoles([]);
    }
  };

  const handleAssignRole = async (e) => {
    e.preventDefault();
    setRoleSaveLoading(true);
    const roleUuid = e.target.elements.role.value;
    try {
      const assigned = await assignRoleToUser(rolesTarget.uuid, roleUuid);
      setAssignedRoles((prev) => [...prev, assigned]);
      toast.success({ title: 'Role assigned' });
    } catch (err) {
      toast.error({ title: 'Assign failed', description: err.message });
    } finally {
      setRoleSaveLoading(false);
    }
  };

  const handleRemoveRole = async (role) => {
    try {
      await removeRoleFromUser(rolesTarget.uuid, role.uuid);
      setAssignedRoles((prev) => prev.filter((r) => r.uuid !== role.uuid));
      toast.success({ title: 'Role removed' });
    } catch (err) {
      toast.error({ title: 'Remove failed', description: err.message });
    }
  };

  const availableRoles = roles.filter(
    (r) => !assignedRoles.some((a) => a.uuid === r.uuid)
  );

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1 className="typography-heading">Users</h1>
          <p className="typography-body-sm admin-page__subtitle">
            Manage user accounts, status, and role assignments.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} data-testid="user-create">
            Create user
          </Button>
        )}
      </div>

      {error && <div className="admin-error" role="alert">{error}</div>}

      {can(PERMISSIONS.USERS.VIEW) && (
        <Card>
          <CardHeader>
            <CardTitle>All users</CardTitle>
          </CardHeader>
          <CardContent className="admin-card__content">
            <div className="admin-toolbar">
              <Input
                type="search"
                placeholder="Search by name, username, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search users"
              />
            </div>

            {loading ? (
              <p className="admin-muted">Loading users…</p>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Username</TableHeaderCell>
                    <TableHeaderCell>Email</TableHeaderCell>
                    <TableHeaderCell>Phone</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Last login</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.uuid}>
                      <TableCell>
                        {[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}
                      </TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email || '—'}</TableCell>
                      <TableCell>{user.phone || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={USER_STATUS_BADGE[user.status] || 'neutral'}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="admin-actions">
                          {canUpdate && (
                            <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                              Edit
                            </Button>
                          )}
                          {canUpdate && (
                            <Button variant="outline" size="sm" onClick={() => openRoleDialog(user)}>
                              Roles
                            </Button>
                          )}
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusToggle(user)}
                            >
                              {user.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="danger" size="sm" onClick={() => handleDelete(user)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="admin-muted">
                        No users found.
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
        <UserFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          saving={saving}
          user={editingUser}
          roles={roles}
        />
      )}

      {rolesOpen && (
        <Dialog
          open={rolesOpen}
          onClose={() => setRolesOpen(false)}
          title={`Roles — ${rolesTarget?.username || ''}`}
          footer={
            <Button variant="outline" onClick={() => setRolesOpen(false)}>
              Close
            </Button>
          }
        >
          <Card>
            <CardContent>
              <h3 className="typography-label">Assigned roles</h3>
              {assignedRoles.length === 0 ? (
                <p className="admin-muted">No roles assigned.</p>
              ) : (
                <ul className="admin-chip-list">
                  {assignedRoles.map((role) => (
                    <li key={role.uuid} className="admin-chip">
                      <span>{role.name}</span>
                      <button
                        type="button"
                        className="admin-chip__remove"
                        aria-label={`Remove role ${role.name}`}
                        onClick={() => handleRemoveRole(role)}
                      >
                        &times;
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {canUpdate && availableRoles.length > 0 && (
                <form onSubmit={handleAssignRole} className="admin-inline-form">
                  <Select name="role" label="Add role" defaultValue="">
                    <option value="" disabled>
                      Select a role…
                    </option>
                    {availableRoles.map((role) => (
                      <option key={role.uuid} value={role.uuid}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" size="sm" loading={roleSaveLoading}>
                    Assign
                  </Button>
                </form>
              )}
              {canUpdate && availableRoles.length === 0 && (
                <p className="admin-muted">All roles are already assigned.</p>
              )}
            </CardContent>
          </Card>
        </Dialog>
      )}
    </div>
  );
}

export default UsersScreen;
