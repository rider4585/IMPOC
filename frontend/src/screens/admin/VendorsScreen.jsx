import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
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
  getVendors,
  createVendor,
  updateVendor,
  getVendorHistory,
} from '../../services/vendorsApi.js';
import { formatPaise } from '../../platform/money.js';
import { VendorFormDialog } from './VendorFormDialog.jsx';

function tripStocks(trip) {
  const tripVendors = Array.isArray(trip.trip_vendors) ? trip.trip_vendors : [];
  if (tripVendors.length > 0) {
    return tripVendors.flatMap((tv) => (Array.isArray(tv.stocks) ? tv.stocks : []));
  }
  // Legacy / mid-migration response shape: flat lines on the trip.
  return trip.lines || [];
}

export function VendorsScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canCreate = can(PERMISSIONS.INVENTORY.CREATE);
  const canUpdate = can(PERMISSIONS.INVENTORY.UPDATE);

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getVendors();
      setVendors(data);
    } catch (err) {
      setError(err.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 200,
      filter: { type: 'text' },
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      size: 150,
      filter: { type: 'text' },
    },
    {
      accessorKey: 'address',
      header: 'Address',
      size: 250,
      filter: { type: 'text' },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      size: 120,
      cell: (info) => (
        <Badge variant={info.getValue() ? 'success' : 'neutral'}>
          {info.getValue() ? 'active' : 'inactive'}
        </Badge>
      ),
      filter: { type: 'picklist', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 180,
      cell: (info) => {
        const v = info.row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openHistory(v)}>
              History
            </Button>
            {canUpdate && (
              <Button variant="outline" size="sm" onClick={() => { setEditing(v); setFormOpen(true); }}>
                Edit
              </Button>
            )}
            {canUpdate && (
              <Button variant="ghost" size="sm" onClick={() => handleToggleActive(v)}>
                {v.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
  ], [canUpdate]);

  const handleSave = async ({ name, phone, address, notes }) => {
    setSaving(true);
    try {
      const payload = {
        name,
        phone: phone || undefined,
        address: address || undefined,
        notes: notes || undefined,
      };
      if (editing) {
        await updateVendor(editing.uuid, payload);
        toast.success({ title: 'Vendor updated' });
      } else {
        await createVendor(payload);
        toast.success({ title: 'Vendor created' });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error({ title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (vendor) => {
    if (!canUpdate) return;
    try {
      await updateVendor(vendor.uuid, { isActive: !vendor.isActive });
      toast.success({ title: `Vendor ${vendor.isActive ? 'deactivated' : 'activated'}` });
      await load();
    } catch (err) {
      toast.error({ title: 'Update failed', description: err.message });
    }
  };

  const openHistory = async (vendor) => {
    setHistoryTarget(vendor);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const data = await getVendorHistory(vendor.uuid);
      setHistoryData(data);
    } catch (err) {
      toast.error({ title: 'Failed to load history', description: err.message });
      setHistoryData({ vendor, trips: [] });
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryData(null);
  };

  return (
    <div className="flex flex-col gap-5 p-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Vendors</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Manage suppliers and view their purchase history.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="vendor-create">
            Create vendor
          </Button>
        )}
      </div>

      {error && <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>}

      {can(PERMISSIONS.INVENTORY.VIEW) && (
        <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
          <DataGrid
            data={vendors}
            columns={columns}
            isLoading={loading}
            isEmpty={vendors.length === 0}
            emptyMessage="No vendors."
            loadingMessage="Loading vendors…"
            getRowTestId={(v) => `vendor-row-${v.uuid}`}
          />
        </div>
      )}

      {formOpen && (
        <VendorFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          saving={saving}
          vendor={editing}
        />
      )}

      {historyOpen && (
        <Dialog
          open={historyOpen}
          onClose={closeHistory}
          title={`Purchase history — ${historyTarget?.name || ''}`}
          footer={
            <Button variant="outline" onClick={closeHistory}>
              Close
            </Button>
          }
        >
          {historyLoading ? (
            <p className="text-sm text-[var(--ink-muted)]">Loading history…</p>
          ) : historyData && historyData.trips.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No purchase history yet.</p>
          ) : (
            historyData &&
            historyData.trips.map((trip) => (
              <Card key={trip.uuid} className="mb-4">
                <CardHeader>
                  <CardTitle>
                    Trip on {new Date(trip.purchasedOn).toLocaleDateString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="typography-body-sm text-[var(--ink-muted)]">
                    Paid {formatPaise(Number(trip.totalPaidPaise))} · Variance{' '}
                    {formatPaise(Number(trip.variancePaise))}
                  </p>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Product</TableHeaderCell>
                        <TableHeaderCell>Qty</TableHeaderCell>
                        <TableHeaderCell>Buying</TableHeaderCell>
                        <TableHeaderCell>Selling</TableHeaderCell>
                        <TableHeaderCell>Channel</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tripStocks(trip).map((stock) => (
                        <TableRow key={stock.uuid}>
                          <TableCell>{stock.stockName || '—'}</TableCell>
                          <TableCell>{stock.quantity}</TableCell>
                          <TableCell>{formatPaise(Number(stock.buyingPricePaise))}</TableCell>
                          <TableCell>{formatPaise(Number(stock.sellingPricePaise))}</TableCell>
                          <TableCell>{stock.channel || '—'}</TableCell>
                        </TableRow>
                      ))}
                      {tripStocks(trip).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-sm text-[var(--ink-muted)]">
                            No stocks in this trip.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </Dialog>
      )}
    </div>
  );
}

export default VendorsScreen;
