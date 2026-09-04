import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getPermissions } from '../../services/permissionsApi.js';
import { groupPermissionsByModule } from '../../platform/adminHelpers.js';

export function PermissionsScreen() {
  const { permissions } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canView = useCallback(
    (p) => permissions && permissions.includes(p),
    [permissions]
  );

  useEffect(() => {
    if (!canView(PERMISSIONS.ROLES.VIEW)) {
      setLoading(false);
      setGroups([]);
      return;
    }
    getPermissions()
      .then((data) => {
        setGroups(groupPermissionsByModule(data));
        setError('');
      })
      .catch((err) => setError(err.message || 'Failed to load permissions'))
      .finally(() => setLoading(false));
  }, [canView]);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Permissions</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Read-only list of all system permissions, grouped by module.
          </p>
        </div>
      </div>

      {error && <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>}

      {canView(PERMISSIONS.ROLES.VIEW) && (
        <div className="flex flex-col gap-5">
          {loading ? (
            <p className="text-sm text-[var(--ink-muted)]">Loading permissions…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No permissions found.</p>
          ) : (
            groups.map((group) => (
              <Card key={group.module}>
                <CardHeader>
                  <CardTitle>{group.module}</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Permission</TableHeaderCell>
                        <TableHeaderCell>Description</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.permissions.map((p) => (
                        <TableRow key={p.uuid}>
                          <TableCell>
                            <code className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 font-[inherit] text-[13px] text-[var(--primary)]">{p.name}</code>
                          </TableCell>
                          <TableCell>{p.description || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default PermissionsScreen;
