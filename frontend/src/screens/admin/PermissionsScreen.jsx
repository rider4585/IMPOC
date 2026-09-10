import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getPermissions } from '../../services/permissionsApi.js';
import { DataGrid } from '../../components/ui/DataGrid.jsx';

export function PermissionsScreen() {
  const { permissions } = useAuth();
  const [flatPermissions, setFlatPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canView = useCallback(
    (p) => permissions && permissions.includes(p),
    [permissions]
  );

  useEffect(() => {
    if (!canView(PERMISSIONS.ROLES.VIEW)) {
      setLoading(false);
      setFlatPermissions([]);
      return;
    }
    getPermissions()
      .then((data) => {
        setFlatPermissions(data);
        setError('');
      })
      .catch((err) => setError(err.message || 'Failed to load permissions'))
      .finally(() => setLoading(false));
  }, [canView]);

  const columns = useMemo(() => [
    {
      accessorKey: 'module',
      header: 'Module',
      size: 180,
      filter: { type: 'text' },
    },
    {
      accessorKey: 'name',
      header: 'Permission',
      size: 200,
      filter: { type: 'text' },
      cell: (info) => (
        <code className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 font-[inherit] text-[13px] text-[var(--primary)]">
          {info.getValue()}
        </code>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      size: 400,
      filter: { type: 'text' },
      cell: (info) => info.getValue() || '—',
    },
  ], []);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px] flex-col gap-5 p-6 overflow-hidden">
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
          <DataGrid
            data={flatPermissions}
            columns={columns}
            isLoading={loading}
            isEmpty={flatPermissions.length === 0}
            emptyMessage="No permissions found."
            loadingMessage="Loading permissions…"
          />
        </div>
      )}
    </div>
  );
}

export default PermissionsScreen;
