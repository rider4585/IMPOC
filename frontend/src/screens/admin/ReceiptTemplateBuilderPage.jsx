import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, useToast } from '../../components/ui';
import { receiptTemplateApi } from '../../services/receiptTemplateApi.js';
import { TemplateBuilder } from '../../components/TemplateBuilder.jsx';

export function ReceiptTemplateBuilderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const templateUuid = searchParams.get('template');
  const entityType = searchParams.get('type') || 'SALE';

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(!!templateUuid);
  const [error, setError] = useState('');

  const loadTemplate = useCallback(async () => {
    if (!templateUuid) return;
    setLoading(true);
    setError('');
    try {
      const data = await receiptTemplateApi.getTemplate(templateUuid);
      setTemplate(data);
    } catch (err) {
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateUuid]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <p className="text-sm text-[var(--ink-muted)]">Loading template...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-10">
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
          {error}
        </div>
        <Button variant="outline" onClick={() => navigate('/receipt-templates')}>
          Back to templates
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TemplateBuilder
        template={template}
        entityType={template?.entityType || entityType}
        onSave={() => navigate('/receipt-templates')}
        onCancel={() => navigate('/receipt-templates')}
      />
    </div>
  );
}

export default ReceiptTemplateBuilderPage;
