import React, { useRef, useState, useEffect, useCallback } from 'react';
import EmailEditor from 'react-email-editor';
import { Button, Dialog, useToast } from './ui';
import { receiptTemplateApi } from '../services/receiptTemplateApi.js';

const PLACEHOLDERS = [
  { label: 'Store Name', value: '{{store.name}}' },
  { label: 'Store Address', value: '{{store.address}}' },
  { label: 'Store Phone', value: '{{store.phone}}' },
  { label: 'Transaction Number', value: '{{transaction.number}}' },
  { label: 'Transaction Date', value: '{{transaction.date}}' },
  { label: 'Transaction Time', value: '{{transaction.time}}' },
  { label: 'Transaction Total', value: '{{transaction.total}}' },
  { label: 'Transaction Subtotal', value: '{{transaction.subtotal}}' },
  { label: 'Transaction Tax', value: '{{transaction.tax}}' },
  { label: 'Transaction Discount', value: '{{transaction.discount}}' },
  { label: 'Transaction Payment Method', value: '{{transaction.paymentMethod}}' },
  { label: 'Customer Name', value: '{{customer.name}}' },
  { label: 'Customer Phone', value: '{{customer.phone}}' },
  { label: 'Item Name', value: '{{item.name}}' },
  { label: 'Item Quantity', value: '{{item.quantity}}' },
  { label: 'Item Price', value: '{{item.price}}' },
  { label: 'Item Total', value: '{{item.total}}' },
  { label: 'Footer Text', value: '{{footer.text}}' },
];

export function TemplateBuilder({ template, entityType, onSave, onCancel }) {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const toast = useToast();

  const [editorHeight, setEditorHeight] = useState(600);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [templateName, setTemplateName] = useState(template?.name || '');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [placeholderDropdownOpen, setPlaceholderDropdownOpen] = useState(false);

  useEffect(() => {
    if (template) {
      setTemplateName(template.name || '');
    }
  }, [template]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        setEditorHeight(rect.height);
      }
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const insertPlaceholder = useCallback((placeholder) => {
    const editor = editorRef.current;
    if (editor?.editor) {
      editor.editor.insertText(placeholder);
      editor.editor.focus();
    }
    setPlaceholderDropdownOpen(false);
  }, []);

  const handlePreview = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    setPreviewing(true);
    try {
      const html = await new Promise((resolve) => {
        editor.exportHtml((data) => resolve(data.html));
      });

      const result = await receiptTemplateApi.previewTemplate({
        entityType,
        html,
        editorState: template?.editorState || null,
      });

      setPreviewHtml(result.html || html);
      setShowPreview(true);
    } catch (err) {
      toast.error({ title: 'Preview failed', description: err.message });
    } finally {
      setPreviewing(false);
    }
  }, [entityType, template, toast]);

  const doSave = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    setSaving(true);
    try {
      const { html, design } = await new Promise((resolve) => {
        editor.exportHtml((data) => resolve({ html: data.html, design: data.design }));
      });

      const payload = {
        name: templateName || `${entityType} Template`,
        entityType,
        html,
        editorState: design,
      };

      if (template?.uuid) {
        await receiptTemplateApi.updateTemplate(template.uuid, payload);
        toast.success({ title: 'Template updated' });
      } else {
        await receiptTemplateApi.createTemplate(payload);
        toast.success({ title: 'Template created' });
      }

      onSave?.();
    } catch (err) {
      toast.error({ title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
      setConfirmOverwrite(false);
    }
  }, [templateName, entityType, template, toast, onSave]);

  const handleSaveClick = useCallback(() => {
    if (template?.isActive) {
      setConfirmOverwrite(true);
    } else {
      doSave();
    }
  }, [template, doSave]);

  const handleEditorLoad = useCallback(() => {
    const editor = editorRef.current;
    if (editor && template?.editorState) {
      editor.loadEditor(template.editorState);
    }
  }, [template]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-2">
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Template name..."
          className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:outline-none"
        />
        <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs text-[var(--ink-muted)]">
          {entityType}
        </span>
        {template?.version != null && (
          <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs text-[var(--ink-muted)]">
            v{template.version}
          </span>
        )}

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPlaceholderDropdownOpen((p) => !p)}
          >
            Insert placeholder
          </Button>
          {placeholderDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setPlaceholderDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 max-h-60 w-56 overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface-raised)] shadow-lg">
                {PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph.value}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--surface-sunken)]"
                    onClick={() => insertPlaceholder(ph.value)}
                  >
                    <span>{ph.label}</span>
                    <span className="font-mono text-xs text-[var(--ink-muted)]">{ph.value}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={handlePreview} loading={previewing}>
          Preview
        </Button>
        <Button size="sm" onClick={handleSaveClick} loading={saving}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1">
        <EmailEditor
          ref={editorRef}
          onLoad={handleEditorLoad}
          options={{
            appearance: {
              theme: 'light',
            },
            features: {
              preview: false,
              imageEditor: false,
            },
          }}
          style={{ height: editorHeight }}
        />
      </div>

      {showPreview && (
        <Dialog
          open={showPreview}
          onClose={() => setShowPreview(false)}
          title="Template Preview"
          footer={
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          }
        >
          <div className="max-h-[60vh] overflow-auto">
            <iframe
              srcDoc={previewHtml}
              title="Template preview"
              className="w-full border-0"
              style={{ minHeight: 400 }}
            />
          </div>
        </Dialog>
      )}

      <Dialog
        open={confirmOverwrite}
        onClose={() => setConfirmOverwrite(false)}
        title="Overwrite active template?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOverwrite(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={doSave} loading={saving}>
              Yes, overwrite
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This template is currently active. Saving will overwrite it and affect all future
          receipts.
        </p>
      </Dialog>
    </div>
  );
}

export default TemplateBuilder;
