import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Input,
  SearchableSelect,
  Badge,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DataGrid,
  useToast,
  ActionMenu,
} from '../../components/ui/index.js';
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

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [rolesOpen, setRolesOpen] = useState(false);
  const [rolesTarget, setRolesTarget] = useState(null);
  const [assignedRoles, setAssignedRoles] = useState([]);
  const [roleSaveLoading, setRoleSaveLoading] = useState(false);
  const [roleUuid, setRoleUuid] = useState('');

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
    return users.filter((u) => {
      const roleNames = (u.roles || []).map((r) => (typeof r === 'string' ? r : r.name));
      return [u.username, u.email, u.firstName, u.lastName, u.phone, ...roleNames]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q));
    });
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

  const requestDelete = (user) => {
    if (!canDelete) return;
    setConfirmDelete(user);
  };

  const handleDelete = async () => {
    const user = confirmDelete;
    if (!user) return;
    setDeleting(true);
    try {
      await deleteUser(user.uuid);
      toast.success({ title: 'User deleted' });
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast.error({ title: 'Delete failed', description: err.message });
    } finally {
      setDeleting(false);
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
    const assignedUuid = roleUuid;
    try {
      const assigned = await assignRoleToUser(rolesTarget.uuid, assignedUuid);
      setAssignedRoles((prev) => [...prev, assigned]);
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.uuid === rolesTarget.uuid
            ? { ...u, roles: [...(u.roles || []), assigned] }
            : u
        )
      );
      setRoleUuid('');
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
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.uuid === rolesTarget.uuid
            ? { ...u, roles: (u.roles || []).filter((r) => r.uuid !== role.uuid) }
            : u
        )
      );
      toast.success({ title: 'Role removed' });
    } catch (err) {
      toast.error({ title: 'Remove failed', description: err.message });
    }
  };

  const availableRoles = roles.filter(
    (r) => !assignedRoles.some((a) => a.uuid === r.uuid)
  );

  const dgColumns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 160,
      filter: { type: 'text' },
      cell: (info) => {
        const user = info.row.original;
        return [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
      },
    },
    {
      accessorKey: 'username',
      header: 'Username',
      size: 140,
      filter: { type: 'text' },
    },
    {
      id: 'roles',
      header: 'Role',
      size: 160,
      accessorFn: (row) =>
        (row.roles || []).map((r) => (typeof r === 'string' ? r : r.name)).join(', '),
      filter: {
        type: 'picklist',
        options: roles.map((r) => ({ value: r.name, label: r.name })),
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const userRoles = row.original?.roles || [];
        return userRoles.some((r) => {
          const name = typeof r === 'string' ? r : r.name;
          return name === filterValue;
        });
      },
      cell: (info) => {
        const user = info.row.original;
        const userRoles = user.roles || [];
        if (!userRoles.length) {
          return <span className="text-[var(--ink-muted)] text-xs">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1" data-testid={`user-roles-${user.uuid}`}>
            {userRoles.map((r) => {
              const roleName = typeof r === 'string' ? r : r.name;
              const isPrivileged = roleName === 'ADMIN' || r.isPrivileged;
              return (
                <Badge
                  key={r.uuid || roleName}
                  variant={isPrivileged ? 'brand' : 'neutral'}
                  className="font-medium text-[11px]"
                >
                  {roleName}
                </Badge>
              );
            })}
          </div>
        );
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      size: 180,
      filter: { type: 'text' },
      cell: (info) => info.getValue() || '—',
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      size: 140,
      filter: { type: 'text' },
      cell: (info) => info.getValue() || '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 120,
      filter: { type: 'picklist', options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'suspended', label: 'Suspended' },
      ]},
      cell: (info) => (
        <Badge variant={USER_STATUS_BADGE[info.getValue()] || 'neutral'}>
          {info.getValue()}
        </Badge>
      ),
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Last login',
      size: 140,
      cell: (info) => {
        const val = info.getValue();
        return val ? new Date(val).toLocaleDateString() : 'Never';
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 130,
      cell: (info) => {
        const user = info.row.original;
        return (
          <ActionMenu
            primary={
              canUpdate
                ? {
                    label: 'Edit',
                    onClick: () => openEdit(user),
                    dataTestid: `user-edit-${user.uuid}`,
                  }
                : null
            }
            items={[
              canUpdate && {
                label: 'Roles',
                onClick: () => openRoleDialog(user),
                dataTestid: `user-roles-btn-${user.uuid}`,
              },
              canUpdate && {
                label: user.status === 'active' ? 'Deactivate' : 'Activate',
                onClick: () => handleStatusToggle(user),
                danger: user.status === 'active',
                dataTestid: `user-status-${user.uuid}`,
              },
              canDelete && {
                label: 'Delete',
                onClick: () => requestDelete(user),
                danger: true,
                divider: true,
                dataTestid: `user-delete-${user.uuid}`,
              },
            ]}
            dataTestid={`user-actions-${user.uuid}`}
          />
        );
      },
      enableSorting: false,
    },
  ], [roles, canUpdate, canDelete]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Users</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Manage user accounts, status, and role assignments.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} data-testid="user-create">
            Create user
          </Button>
        )}
      </div>

      {error && <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>}

      {can(PERMISSIONS.USERS.VIEW) && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="max-w-[360px]">
            <Input
              type="search"
              placeholder="Search by name, username, role, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
            <DataGrid
              data={filteredUsers}
              columns={dgColumns}
              isLoading={loading}
              isEmpty={filteredUsers.length === 0}
              emptyMessage="No users found."
              loadingMessage="Loading users…"
              className="flex-1"
            />
          </div>
        </div>
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
          onClose={() => {
            setRolesOpen(false);
            setRolesTarget(null);
            load();
          }}
          title={`Roles — ${rolesTarget?.username || ''}`}
          footer={
            <Button
              variant="outline"
              onClick={() => {
                setRolesOpen(false);
                setRolesTarget(null);
                load();
              }}
            >
              Close
            </Button>
          }
        >
          <Card>
            <CardContent>
              <h3 className="typography-label">Assigned roles</h3>
              {assignedRoles.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted)]">No roles assigned.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {assignedRoles.map((role) => (
                    <li
                      key={role.uuid}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-sunken)] px-2 py-0.5 text-[13px] text-[var(--ink)]"
                    >
                      <span>{role.name}</span>
                      <button
                        type="button"
                        className="cursor-pointer border-none bg-transparent text-[16px] leading-none text-[var(--ink-muted)] hover:text-[var(--danger)]"
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
                <form onSubmit={handleAssignRole} className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="flex-1">
                    <SearchableSelect
                      label="Add role"
                      value={roleUuid}
                      onChange={setRoleUuid}
                      placeholder="Select a role…"
                      searchPlaceholder="Search roles…"
                      emptyMessage="No matching roles."
                      options={availableRoles.map((role) => ({ value: role.uuid, label: role.name }))}
                    />
                  </div>
                  <Button type="submit" size="sm" loading={roleSaveLoading}>
                    Assign
                  </Button>
                </form>
              )}
              {canUpdate && availableRoles.length === 0 && (
                <p className="text-sm text-[var(--ink-muted)]">All roles are already assigned.</p>
              )}
            </CardContent>
          </Card>
        </Dialog>
      )}

      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete user?"
        role="alertdialog"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Delete user
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Delete user{' '}
          <span className="font-semibold">{confirmDelete?.username || ''}</span>? This permanently
          removes the account and cannot be undone.
        </p>
      </Dialog>
    </div>
  );
}

export default UsersScreen;
