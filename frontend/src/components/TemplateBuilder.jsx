import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button, Dialog, useToast } from './ui';
import { receiptTemplateApi } from '../services/receiptTemplateApi.js';

/**
 * Placeholders must match the server-side template engine
 * (backend/src/modules/receipt-templates/receipt-template-engine.js).
 * item.* keys only resolve inside a {{#each items}}…{{/each}} loop.
 */
const PLACEHOLDERS = [
  { label: 'Store name', value: '{{store.name}}' },
  { label: 'Store wordmark', value: '{{store.wordmark}}' },
  { label: 'Store address', value: '{{store.address}}' },
  { label: 'Store phone', value: '{{store.phone}}' },
  { label: 'Transaction number', value: '{{transaction.number}}' },
  { label: 'Transaction date', value: '{{transaction.date}}' },
  { label: 'Transaction time', value: '{{transaction.time}}' },
  { label: 'Transaction type', value: '{{transaction.type}}' },
  { label: 'Payment method', value: '{{transaction.paymentMethod}}' },
  { label: 'Transaction status', value: '{{transaction.status}}' },
  { label: 'Customer name', value: '{{customer.name}}' },
  { label: 'Customer phone', value: '{{customer.phone}}' },
  { label: 'Customer email', value: '{{customer.email}}' },
  { label: 'Subtotal', value: '{{totals.subtotal}}' },
  { label: 'Discount', value: '{{totals.discount}}' },
  { label: 'Total', value: '{{totals.total}}' },
  { label: 'Amount paid', value: '{{totals.amountPaid}}' },
  { label: 'Balance', value: '{{totals.balance}}' },
  { label: 'Item count', value: '{{totals.itemsCount}}' },
  { label: 'Amount in words', value: '{{amountInWords}}' },
  { label: 'Footer text', value: '{{footer.text}}' },
];

const LOOP_START = '{{#each items}}\n';
const LOOP_END = '\n{{/each}}';

const IMAGE_SLOT_SNIPPET = `<!-- IMAGE SLOT: replace this whole div with your image later, e.g. <img src="your-image.png" style="width:100%" />. Delete the div to leave no gap. Hidden on printed receipts until you add a real image. -->
<div class="receipt-image-slot" data-label="IMAGE SLOT - add your image here later">IMAGE SLOT - add your image here later</div>`;

/**
 * TemplateBuilder — edit a receipt template's HTML source directly and preview
 * it rendered with sample data through the backend engine.
 *
 * Saving always creates a NEW VERSION (a draft). It never replaces the
 * published receipt — use the "Publish" action on the templates screen to make
 * a draft the live receipt.
 *
 * Props: template, entityType, onSave, onCancel
 */
export function TemplateBuilder({ template, entityType, onSave, onCancel }) {
  const textareaRef = useRef(null);
  const toast = useToast();

  const [html, setHtml] = useState(template?.htmlContent || '');
  const [templateName, setTemplateName] = useState(template?.name || '');
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [placeholderOpen, setPlaceholderOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  useEffect(() => {
    if (template) {
      setTemplateName(template.name || '');
      setHtml(template.htmlContent || '');
    }
  }, [template]);

  const insertAtCursor = useCallback((value) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + value + el.value.slice(end);
    setHtml(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + value.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  const insertPlaceholder = useCallback(
    (placeholder) => {
      insertAtCursor(placeholder.value);
      setPlaceholderOpen(false);
    },
    [insertAtCursor]
  );

  const insertItemLoop = useCallback(() => {
    insertAtCursor(LOOP_START + '  <tr>\n    <td>{{item.sno}}</td>\n    <td>{{item.description}}</td>\n    <td>{{item.quantity}}</td>\n    <td>{{item.rate}}</td>\n    <td>{{item.amount}}</td>\n  </tr>\n' + LOOP_END.trimStart());
    setPlaceholderOpen(false);
  }, [insertAtCursor]);

  const insertImageSlot = useCallback(() => {
    insertAtCursor(IMAGE_SLOT_SNIPPET);
    setPlaceholderOpen(false);
  }, [insertAtCursor]);

  const handlePreview = useCallback(async () => {
    if (!html.trim()) {
      toast.error({ title: 'Preview failed', description: 'Template HTML is empty.' });
      return;
    }
    setPreviewing(true);
    try {
      const result = await receiptTemplateApi.previewTemplate({
        entityType,
        htmlContent: html,
      });
      setPreviewHtml(result.renderedHtml);
      setShowPreview(true);
    } catch (err) {
      toast.error({ title: 'Preview failed', description: err.message });
    } finally {
      setPreviewing(false);
    }
  }, [html, entityType, toast]);

  const doSave = useCallback(async () => {
    if (!template?.uuid) return;
    if (!html.trim()) {
      toast.error({ title: 'Save failed', description: 'Template HTML is empty.' });
      return;
    }
    setSaving(true);
    try {
      const saved = await receiptTemplateApi.updateTemplate(template.uuid, {
        name: templateName || template.name,
        htmlContent: html,
        editorState: null,
      });
      toast.success({
        title: `Saved as v${saved.version}`,
        description: saved.isActive
          ? 'This version is published and live.'
          : 'This is a draft. Publish it on the templates screen to make it the live receipt.',
      });
      onSave?.();
    } catch (err) {
      toast.error({ title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  }, [template, templateName, html, toast, onSave]);

  const handleCancelClick = useCallback(() => {
    if (html !== (template?.htmlContent || '')) {
      setConfirmExit(true);
    } else {
      onCancel?.();
    }
  }, [html, template, onCancel]);

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
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            template?.isActive
              ? 'bg-[var(--success)]/15 text-[var(--success)]'
              : 'bg-[var(--surface-sunken)] text-[var(--ink-muted)]'
          }`}
        >
          {template?.isActive ? 'Published' : 'Draft'}
        </span>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPlaceholderOpen((p) => !p)}
          >
            Insert placeholder
          </Button>
          {placeholderOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setPlaceholderOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 max-h-80 w-72 overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface-raised)] shadow-lg">
                <p className="px-3 py-2 text-xs text-[var(--ink-muted)]">
                  Item rows render inside a loop — click "Item row" below or wrap
                  your <code className="font-mono">{'{{#each items}}'}</code> section yourself.
                </p>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-[var(--surface-sunken)]"
                  onClick={insertItemLoop}
                >
                  <span>Item row (table loop)</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-[var(--surface-sunken)]"
                  onClick={insertImageSlot}
                >
                  <span>Image slot (add a picture later)</span>
                </button>
                {PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph.value}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--surface-sunken)]"
                    onClick={() => insertPlaceholder(ph)}
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
        <Button size="sm" onClick={doSave} loading={saving} disabled={!template?.uuid}>
          Save as new version
        </Button>
        <Button variant="ghost" size="sm" onClick={handleCancelClick}>
          Cancel
        </Button>
      </div>

      {!template?.uuid && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
          New templates cannot be created — only the Sale and Rental receipt can be edited.
        </div>
      )}

      {template?.isActive && (
        <div className="border-b border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-2 text-xs text-[var(--ink-muted)]">
          This is the published receipt. Saving creates a new draft version — the published one
          stays live until you Publish the draft.
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        spellCheck={false}
        aria-label="Template HTML source"
        className="min-h-0 flex-1 resize-none bg-[var(--surface)] p-4 font-mono text-xs leading-relaxed text-[var(--ink)] focus:outline-none"
      />

      {showPreview && (
        <Dialog
          open={showPreview}
          onClose={() => setShowPreview(false)}
          title="Template preview (sample data)"
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
        open={confirmExit}
        onClose={() => setConfirmExit(false)}
        title="Discard unsaved changes?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmExit(false)}>
              Keep editing
            </Button>
            <Button onClick={onCancel}>Discard</Button>
          </>
        }
      >
        <p className="text-sm">Your changes have not been saved as a new version.</p>
      </Dialog>
    </div>
  );
}

export default TemplateBuilder;