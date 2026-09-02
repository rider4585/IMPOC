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
import './admin.css';

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
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1 className="typography-heading">Permissions</h1>
          <p className="typography-body-sm admin-page__subtitle">
            Read-only list of all system permissions, grouped by module.
          </p>
        </div>
      </div>

      {error && <div className="admin-error" role="alert">{error}</div>}

      {canView(PERMISSIONS.ROLES.VIEW) && (
        <div className="admin-permission-groups">
          {loading ? (
            <p className="admin-muted">Loading permissions…</p>
          ) : groups.length === 0 ? (
            <p className="admin-muted">No permissions found.</p>
          ) : (
            groups.map((group) => (
              <Card key={group.module}>
                <CardHeader>
                  <CardTitle>{group.module}</CardTitle>
                </CardHeader>
                <CardContent className="admin-card__content">
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
                            <code className="admin-code">{p.name}</code>
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
