import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  Button,
  Input,
  Dialog,
  Badge,
  useToast,
} from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  getAdminSessions,
  revokeSession,
  revokeUserSessions,
} from '../../services/sessionsApi.js';
import {
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  RotateCw,
  Search,
  AlertTriangle,
  Users,
  ShieldCheck,
} from 'lucide-react';

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function getDeviceIcon(deviceType) {
  const dt = (deviceType || '').toLowerCase();
  if (dt === 'mobile') {
    return <Smartphone className="h-4 w-4 text-[var(--ink-muted)] shrink-0" aria-label="Mobile" />;
  }
  if (dt === 'tablet') {
    return <Tablet className="h-4 w-4 text-[var(--ink-muted)] shrink-0" aria-label="Tablet" />;
  }
  if (dt === 'desktop') {
    return <Monitor className="h-4 w-4 text-[var(--ink-muted)] shrink-0" aria-label="Desktop" />;
  }
  return <Laptop className="h-4 w-4 text-[var(--ink-muted)] shrink-0" aria-label="Unknown Device" />;
}

export function SessionsScreen() {
  const { permissions, currentUser, signOut } = useAuth();
  const toast = useToast();

  const can = useCallback(
    (p) => Boolean(permissions && permissions.includes(p)),
    [permissions]
  );
  const canUpdate = can(PERMISSIONS.USERS.UPDATE);

  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    activeSessions: 0,
    uniqueUsersCount: 0,
    deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0, unknown: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Revoke Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState(null);
  const [revokeAllForUser, setRevokeAllForUser] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminSessions({ activeOnly });
      setSessions(data.sessions || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      setError(err.message || 'Failed to load sessions');
      toast.error(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [activeOnly, toast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const parts = [
        s.user?.username,
        s.user?.email,
        s.user?.firstName,
        s.user?.lastName,
        s.user?.fullName,
        s.ipAddress,
        s.browser,
        s.os,
        s.deviceType,
      ];
      return parts.some((p) => p && String(p).toLowerCase().includes(q));
    });
  }, [sessions, search]);

  const openRevokeDialog = (session) => {
    setSessionToRevoke(session);
    setRevokeAllForUser(false);
    setDialogOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!sessionToRevoke) return;
    setRevoking(true);
    try {
      const willRevokeSelf = Boolean(
        sessionToRevoke.isCurrent ||
        (revokeAllForUser && sessionToRevoke.user?.uuid === currentUser?.uuid)
      );

      if (revokeAllForUser) {
        await revokeUserSessions(sessionToRevoke.user.uuid);
        toast.success('All user sessions revoked');
      } else {
        await revokeSession(sessionToRevoke.uuid);
        toast.success('Session revoked');
      }

      setDialogOpen(false);

      if (willRevokeSelf) {
        await signOut();
      } else {
        await loadSessions();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to revoke session');
    } finally {
      setRevoking(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        id: 'user',
        header: 'User',
        accessorFn: (row) => row.user?.fullName || row.user?.username || '',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-xs text-[var(--ink)]">
                {row.user?.fullName || row.user?.username || 'Unknown User'}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[var(--ink-muted)] font-mono">
                  @{row.user?.username}
                </span>
                {row.user?.email && (
                  <span className="text-[11px] text-[var(--ink-faint)] truncate max-w-[150px]">
                    &middot; {row.user.email}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: 'device',
        header: 'Device',
        accessorFn: (row) => `${row.browser} ${row.os}`,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center gap-2.5">
              {getDeviceIcon(row.deviceType)}
              <div className="flex flex-col">
                <span className="text-xs font-medium text-[var(--ink)]">
                  {row.browser || 'Unknown'}
                </span>
                <span className="text-[11px] text-[var(--ink-muted)]">
                  {row.os || 'Unknown'} &middot; {row.deviceType || 'unknown'}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'ipAddress',
        header: 'IP Address',
        accessorKey: 'ipAddress',
        cell: (info) => (
          <span className="inline-block font-mono text-xs px-2 py-0.5 rounded bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--ink)]">
            {info.getValue() || '127.0.0.1'}
          </span>
        ),
      },
      {
        id: 'activity',
        header: 'Signed In & Last Active',
        accessorFn: (row) => row.lastUsedAt || row.createdAt,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex flex-col text-xs">
              <span className="text-[var(--ink)] font-medium">
                Last: {formatDateTime(row.lastUsedAt || row.createdAt)}
              </span>
              <span className="text-[11px] text-[var(--ink-muted)]">
                Signed in: {formatDateTime(row.createdAt)}
              </span>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: (info) => {
          const row = info.row.original;
          const status = row.status || 'ACTIVE';
          const badgeVariant =
            status === 'ACTIVE'
              ? 'success'
              : status === 'EXPIRED'
              ? 'warning'
              : 'neutral';

          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant={badgeVariant}>{status}</Badge>
              {row.isCurrent && (
                <span
                  data-testid="current-session-badge"
                  className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                >
                  Current Session
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (!canUpdate) return null;
          const isRevoked = row.status === 'REVOKED';

          return (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 h-8 px-2.5 text-xs"
              disabled={isRevoked}
              onClick={() => openRevokeDialog(row)}
            >
              Revoke
            </Button>
          );
        },
      },
    ],
    [canUpdate]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            Active Sessions & Devices
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Monitor signed-in accounts, inspect device telemetry, and revoke unauthorized sessions.
          </p>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider">
                Active Sessions
              </p>
              <p className="text-2xl font-semibold text-[var(--ink)] mt-1" data-testid="metric-active-sessions">
                {stats?.activeSessions ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--status-in-stock)]/10 text-[var(--status-in-stock)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider">
                Unique Active Users
              </p>
              <p className="text-2xl font-semibold text-[var(--ink)] mt-1" data-testid="metric-unique-users">
                {stats?.uniqueUsersCount ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex flex-col justify-between">
            <p className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider mb-2">
              Device Breakdown
            </p>
            <div className="flex items-center gap-4 text-xs text-[var(--ink)]">
              <div className="flex items-center gap-1.5" title="Desktop">
                <Monitor className="h-4 w-4 text-[var(--ink-muted)]" />
                <span className="font-semibold" data-testid="metric-device-desktop">
                  {stats?.deviceBreakdown?.desktop ?? 0}
                </span>
                <span className="text-[var(--ink-muted)] text-[11px]">desktop</span>
              </div>
              <div className="flex items-center gap-1.5" title="Mobile">
                <Smartphone className="h-4 w-4 text-[var(--ink-muted)]" />
                <span className="font-semibold" data-testid="metric-device-mobile">
                  {stats?.deviceBreakdown?.mobile ?? 0}
                </span>
                <span className="text-[var(--ink-muted)] text-[11px]">mobile</span>
              </div>
              <div className="flex items-center gap-1.5" title="Tablet">
                <Tablet className="h-4 w-4 text-[var(--ink-muted)]" />
                <span className="font-semibold" data-testid="metric-device-tablet">
                  {stats?.deviceBreakdown?.tablet ?? 0}
                </span>
                <span className="text-[var(--ink-muted)] text-[11px]">tablet</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-muted)]" />
              <Input
                placeholder="Search by user, email, IP, browser, OS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-[var(--focus-ring)] cursor-pointer"
                />
                <span>Active only</span>
              </label>

              <Button
                variant="outline"
                size="sm"
                onClick={loadSessions}
                disabled={loading}
                className="gap-2 h-9"
              >
                <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Sessions DataGrid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            data={filteredSessions}
            columns={columns}
            isLoading={loading}
            isEmpty={filteredSessions.length === 0}
            emptyMessage={search ? 'No sessions matching your filter.' : 'No sessions recorded.'}
          />
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => !revoking && setDialogOpen(false)}
        title="Revoke Session?"
      >
        <div className="space-y-4 text-sm text-[var(--ink)]">
          <p>
            Revoke Session? The user on this device will be signed out immediately.
          </p>

          {(sessionToRevoke?.isCurrent || (revokeAllForUser && sessionToRevoke?.user?.uuid === currentUser?.uuid)) && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> {sessionToRevoke?.isCurrent ? 'This is your current session. You will be signed out.' : 'This will also revoke your current session. You will be signed out.'}
              </span>
            </div>
          )}

          {sessionToRevoke && (
            <div className="rounded border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-xs space-y-1">
              <p>
                <strong>User:</strong> {sessionToRevoke.user?.fullName || sessionToRevoke.user?.username} (@{sessionToRevoke.user?.username})
              </p>
              <p>
                <strong>Device:</strong> {sessionToRevoke.browser} on {sessionToRevoke.os} ({sessionToRevoke.deviceType})
              </p>
              <p>
                <strong>IP:</strong> {sessionToRevoke.ipAddress}
              </p>
            </div>
          )}

          <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer pt-1">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-[var(--focus-ring)] cursor-pointer"
              checked={revokeAllForUser}
              onChange={(e) => setRevokeAllForUser(e.target.checked)}
            />
            <span>Revoke all sessions for this user</span>
          </label>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={revoking}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={revoking}
              loading={revoking}
              onClick={handleConfirmRevoke}
            >
              {revokeAllForUser ? 'Revoke All Sessions' : 'Revoke Session'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default SessionsScreen;
