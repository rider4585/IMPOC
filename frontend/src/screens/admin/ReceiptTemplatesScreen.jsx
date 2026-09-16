import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Dialog,
  useToast,
} from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { receiptTemplateApi } from '../../services/receiptTemplateApi.js';
import { TemplateBuilder } from '../../components/TemplateBuilder.jsx';

export function ReceiptTemplatesScreen() {
  const { permissions } = useAuth();
  const toast = useToast();

  const canManage = permissions?.includes('branding.manage');

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [builderEntityType, setBuilderEntityType] = useState('SALE');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await receiptTemplateApi.listTemplates();
      setTemplates(Array.isArray(data) ? data : data?.templates || []);
    } catch (err) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return templates;
    return templates.filter((t) => t.entityType === filter);
  }, [templates, filter]);

  const openCreate = (entityType) => {
    setEditingTemplate(null);
    setBuilderEntityType(entityType);
    setBuilderOpen(true);
  };

  const openEdit = (template) => {
    setEditingTemplate(template);
    setBuilderEntityType(template.entityType);
    setBuilderOpen(true);
  };

  const handleActivate = useCallback(
    async (template) => {
      try {
        await receiptTemplateApi.activateTemplate(template.uuid);
        toast.success({ title: 'Template activated' });
        await load();
      } catch (err) {
        toast.error({ title: 'Activation failed', description: err.message });
      }
    },
    [toast, load]
  );

  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        size: 250,
        filter: { type: 'text' },
      },
      {
        accessorKey: 'entityType',
        header: 'Type',
        size: 100,
        cell: (info) => (
          <Badge variant={info.getValue() === 'SALE' ? 'default' : 'secondary'}>
            {info.getValue()}
          </Badge>
        ),
      },
      {
        accessorKey: 'version',
        header: 'Version',
        size: 80,
        cell: (info) => `v${info.getValue() ?? 1}`,
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        size: 100,
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="muted">Draft</Badge>
          ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        size: 160,
        cell: (info) => {
          const val = info.getValue();
          return val ? new Date(val).toLocaleDateString() : '—';
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 200,
        cell: (info) => {
          const t = info.row.original;
          return (
            <div className="flex flex-wrap gap-2">
              {canManage && !t.isActive && (
                <Button variant="outline" size="sm" onClick={() => handleActivate(t)}>
                  Set as active
                </Button>
              )}
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                  Edit
                </Button>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [canManage, handleActivate]
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px] flex-col gap-5 p-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Receipt Templates</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Design and manage branded receipt templates for sales and rentals.
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button onClick={() => openCreate('SALE')} data-testid="template-create-sale">
              New sale template
            </Button>
            <Button onClick={() => openCreate('RENTAL')} data-testid="template-create-rental">
              New rental template
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {['all', 'SALE', 'RENTAL'].map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface-sunken)] text-[var(--ink-muted)] hover:bg-[var(--border)]'
            }`}
            onClick={() => setFilter(key)}
          >
            {key === 'all' ? 'All' : key.charAt(0) + key.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
        <DataGrid
          data={filtered}
          columns={columns}
          isLoading={loading}
          isEmpty={filtered.length === 0}
          emptyMessage="No templates yet. Create one to get started."
          loadingMessage="Loading templates..."
        />
      </div>

      {builderOpen && (
        <Dialog
          open={builderOpen}
          onClose={() => setBuilderOpen(false)}
          title={editingTemplate ? 'Edit template' : 'New template'}
          fullScreen
        >
          <TemplateBuilder
            template={editingTemplate}
            entityType={builderEntityType}
            onSave={() => {
              setBuilderOpen(false);
              load();
            }}
            onCancel={() => setBuilderOpen(false)}
          />
        </Dialog>
      )}
    </div>
  );
}

export default ReceiptTemplatesScreen;
