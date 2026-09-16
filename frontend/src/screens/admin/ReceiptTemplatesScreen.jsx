import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Badge, Dialog, useToast } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { receiptTemplateApi } from '../../services/receiptTemplateApi.js';
import { TemplateBuilder } from '../../components/TemplateBuilder.jsx';

const TEMPLATE_GROUPS = [
  { type: 'SALE', label: 'Sale receipt' },
  { type: 'RENTAL', label: 'Rental receipt' },
];

export function ReceiptTemplatesScreen() {
  const { permissions } = useAuth();
  const toast = useToast();

  const canManage = permissions?.includes(PERMISSIONS.RECEIPT_TEMPLATES.MANAGE);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

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

  const byType = useMemo(() => {
    const map = { SALE: [], RENTAL: [] };
    for (const t of templates) {
      if (map[t.entityType]) map[t.entityType].push(t);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
    }
    return map;
  }, [templates]);

  const publishedOf = (list) => list.find((t) => t.isActive) || null;

  const openEdit = useCallback((template) => {
    setEditingTemplate(template);
    setBuilderOpen(true);
  }, []);

  const handlePublish = useCallback(
    async (template) => {
      try {
        const published = await receiptTemplateApi.activateTemplate(template.uuid);
        toast.success({ title: `Published v${published.version}`, description: 'This version is now used for receipts.' });
        await load();
      } catch (err) {
        toast.error({ title: 'Publish failed', description: err.message });
      }
    },
    [toast, load]
  );

  const renderVersionRow = (t) => (
    <div
      key={t.uuid}
      className="flex flex-wrap items-center gap-4 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
    >
      <span className="w-12 shrink-0 font-mono text-sm font-medium text-[var(--ink)]">v{t.version}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--ink)]">{t.name}</div>
        <div className="text-xs text-[var(--ink-muted)]">
          {t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}
          {t.createdBy ? ` · by ${t.createdBy}` : ''}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {t.isActive ? (
          <Badge variant="success">Published</Badge>
        ) : (
          <Badge variant="muted">Draft</Badge>
        )}
        {canManage && (
          <>
            <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
              Edit
            </Button>
            {!t.isActive && (
              <Button size="sm" onClick={() => handlePublish(t)} data-testid={`publish-${t.entityType}-v${t.version}`}>
                Publish
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderGroup = ({ type, label }) => {
    const list = byType[type] || [];
    const published = publishedOf(list);
    return (
      <section key={type} className="flex flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
            {published ? (
              <Badge variant="success">v{published.version} in use</Badge>
            ) : (
              <Badge variant="muted">Not published</Badge>
            )}
          </div>
          {list.length > 0 && (
            <span className="text-xs text-[var(--ink-muted)]">
              {list.length} version{list.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {list.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-[var(--ink-muted)]">
            No template yet for {label}.
          </div>
        ) : (
          list.map(renderVersionRow)
        )}
      </section>
    );
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[900px] flex-col gap-5 overflow-hidden p-6">
      <div>
        <h1 className="typography-heading mb-1">Receipt templates</h1>
        <p className="typography-body-sm text-[var(--ink-muted)]">
          Two receipts — Sale and Rental. Each saved change creates a new version; the{" "}
          <strong>Published</strong> version is the one printed on POS invoices. Publish a
          draft to make it live.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </div>
      )}

      {loading && templates.length === 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-6 text-sm text-[var(--ink-muted)]">
          Loading templates...
        </div>
      ) : (
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
          {TEMPLATE_GROUPS.map(renderGroup)}
        </div>
      )}

      {builderOpen && (
        <Dialog
          open={builderOpen}
          onClose={() => setBuilderOpen(false)}
          title={`Edit ${editingTemplate?.entityType === 'RENTAL' ? 'rental' : 'sale'} receipt`}
          fullScreen
        >
          <TemplateBuilder
            template={editingTemplate}
            entityType={editingTemplate?.entityType || 'SALE'}
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