import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Card, CardHeader, CardContent, CardTitle, useToast } from '../components/ui';
import { useAuth } from '../auth/useAuth.js';
import { PERMISSIONS } from '../constants/permissions';
import { getBarcodeLayout, saveBarcodeLayout, fetchLayoutPreviewPdf } from '../services/barcodeLayoutApi.js';
import {
  DEFAULT_LAYOUT,
  PAGE_SIZE_OPTIONS,
  ORIENTATION_OPTIONS,
  computeSheetGeometry,
} from '../platform/labelLayout.js';

/**
 * Label layout configurator (R-50)
 *
 * Lives on the Print labels screen behind "Configure barcode sheet" (user
 * preference: no separate tab). Configures every dimension of the label sheet. The form
 * edits a draft; the preview on the right re-runs the SAME geometry math the
 * backend uses (platform/labelLayout.js) on every keystroke:
 * - one label drawn to scale (SVG) — barcode strip, code text, divider, price box
 * - a page thumbnail showing how the grid fills the sheet
 * Save writes the single barcode_layouts row (Admin permission); Preview PDF
 * opens the real backend-rendered sample sheet for the SAVED layout.
 */

const SAMPLE_VALUE = 'SHREE0000000001';

// Field groups drive both the form and the order it renders in.
const GROUPS = [
  {
    title: 'Page',
    fields: [
      { key: 'pageSize', label: 'Page size', type: 'select', options: PAGE_SIZE_OPTIONS.map((v) => ({ value: v, label: v })) },
      { key: 'orientation', label: 'Orientation', type: 'select', options: ORIENTATION_OPTIONS.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
      { key: 'marginTopMm', label: 'Top margin (mm)', step: 0.5 },
      { key: 'marginBottomMm', label: 'Bottom margin (mm)', step: 0.5 },
      { key: 'marginLeftMm', label: 'Left margin (mm)', step: 0.5 },
      { key: 'marginRightMm', label: 'Right margin (mm)', step: 0.5 },
    ],
  },
  {
    title: 'Grid',
    fields: [
      { key: 'columns', label: 'Columns', step: 1, min: 1, max: 10 },
      { key: 'rows', label: 'Rows', step: 1, min: 1, max: 10 },
      { key: 'gapHorizontalMm', label: 'Gap between columns (mm)', step: 0.5 },
      { key: 'gapVerticalMm', label: 'Gap between rows (mm)', step: 0.5 },
    ],
  },
  {
    title: 'Label',
    fields: [
      { key: 'labelPaddingTopMm', label: 'Space above barcode (mm)', step: 0.1 },
      { key: 'labelPaddingBottomMm', label: 'Space below code text (mm)', step: 0.1 },
      { key: 'labelPaddingXMm', label: 'Side padding (mm)', step: 0.1 },
      { key: 'infoBoxMinHeightMm', label: 'Price box minimum height (mm)', step: 0.5 },
      { key: 'borderWidthPt', label: 'Border width (pt)', step: 0.25, min: 0 },
      { key: 'borderRadiusMm', label: 'Corner radius (mm)', step: 0.5 },
      { key: 'showDivider', label: 'Draw divider line above price box', type: 'checkbox' },
    ],
  },
  {
    title: 'Barcode',
    fields: [
      { key: 'barcodeWidthMm', label: 'Barcode width (mm)', step: 1, min: 10 },
      { key: 'barcodeHeightMm', label: 'Barcode height (mm)', step: 0.5, min: 3 },
    ],
  },
  {
    title: 'Code text',
    fields: [
      { key: 'showText', label: 'Print the code under the barcode', type: 'checkbox' },
      { key: 'textFontSizePt', label: 'Text size (pt)', step: 0.5, min: 3 },
      { key: 'textMarginTopMm', label: 'Gap between barcode and text (mm)', step: 0.1 },
    ],
  },
];

const NUMBER_KEYS = GROUPS.flatMap((g) => g.fields).filter((f) => !f.type).map((f) => f.key);

/** Form state keeps strings for number inputs so the user can clear/retype. */
const toForm = (layout) => {
  const form = {};
  for (const key of Object.keys(DEFAULT_LAYOUT)) {
    const value = layout[key] ?? DEFAULT_LAYOUT[key];
    form[key] = NUMBER_KEYS.includes(key) ? String(value) : value;
  }
  return form;
};

/** Form -> layout numbers; empty/invalid numbers fall back to 0 (flagged by fit check). */
const toLayout = (form) => {
  const layout = {};
  for (const key of Object.keys(DEFAULT_LAYOUT)) {
    layout[key] = NUMBER_KEYS.includes(key) ? Number(form[key]) || 0 : form[key];
  }
  return layout;
};

const fmtMm = (pt) => `${(pt / (72 / 25.4)).toFixed(1)} mm`;

/**
 * One label at scale. Coordinates are points; the SVG viewBox is the label
 * itself so it scales to the card width.
 */
function LabelPreview({ geometry }) {
  const { label, barcode, text, divider, codeAreaHeight } = geometry;
  const w = Math.max(label.width, 1);
  const h = Math.max(label.height, 1);
  const barcodeX = (w - barcode.width) / 2;
  const barcodeY = label.paddingTop;

  // A fake but plausible Code128 pattern (varying bar widths) for the mock-up.
  const bars = useMemo(() => {
    const out = [];
    let x = 0;
    const pattern = [2, 1, 1, 2, 3, 1, 1, 1, 2, 1, 3, 2, 1, 1, 1, 2, 2, 1, 1, 3];
    const unit = barcode.width / 120;
    let i = 0;
    while (x < barcode.width) {
      const bw = pattern[i % pattern.length] * unit;
      if (i % 2 === 0) out.push({ x, w: bw });
      x += bw;
      i += 1;
    }
    return out;
  }, [barcode.width]);

  return (
    <svg
      viewBox={`-2 -2 ${w + 4} ${h + 4}`}
      className="w-full max-w-[420px] rounded bg-white"
      role="img"
      aria-label="Label preview"
      data-testid="label-preview"
    >
      <rect
        x="0"
        y="0"
        width={w}
        height={h}
        rx={label.borderRadius}
        fill="#fff"
        stroke="#111"
        strokeWidth={label.borderWidth}
      />
      {divider.show && (
        <line x1="0" y1={codeAreaHeight} x2={w} y2={codeAreaHeight} stroke="#111" strokeWidth={Math.max(label.borderWidth, 0.5)} />
      )}
      <g transform={`translate(${barcodeX} ${barcodeY})`}>
        <rect x="0" y="0" width={barcode.width} height={barcode.height} fill="#fff" />
        {bars.map((b) => (
          <rect key={b.x} x={b.x} y="0" width={b.w} height={barcode.height} fill="#111" />
        ))}
      </g>
      {text.show && (
        <text
          x={w / 2}
          y={barcodeY + barcode.height + text.marginTop + text.fontSize * 0.85}
          fontSize={text.fontSize}
          fontFamily="Helvetica, Arial, sans-serif"
          textAnchor="middle"
          fill="#111"
        >
          {SAMPLE_VALUE}
        </text>
      )}
      <text
        x={w / 2}
        y={codeAreaHeight + (h - codeAreaHeight) / 2}
        fontSize={Math.min(9, (h - codeAreaHeight) / 3)}
        fontFamily="Helvetica, Arial, sans-serif"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#9a9a9a"
      >
        price / size written by hand
      </text>
    </svg>
  );
}

/** Whole page thumbnail: margins + grid of label rectangles. */
function PagePreview({ geometry }) {
  const { page, columns, rows, margin, gap, label } = geometry;
  const cells = [];
  if (label.width > 0 && label.height > 0) {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < columns; c += 1) {
        cells.push({
          key: `${r}-${c}`,
          x: margin.left + c * (label.width + gap.horizontal),
          y: margin.top + r * (label.height + gap.vertical),
        });
      }
    }
  }
  return (
    <svg
      viewBox={`0 0 ${page.width} ${page.height}`}
      className="h-[260px] rounded border border-[var(--border)] bg-white"
      role="img"
      aria-label="Page preview"
      data-testid="page-preview"
    >
      <rect x="0" y="0" width={page.width} height={page.height} fill="#fff" />
      {cells.map((cell) => (
        <rect
          key={cell.key}
          x={cell.x}
          y={cell.y}
          width={label.width}
          height={label.height}
          rx={label.borderRadius}
          fill="#f4efe6"
          stroke="#111"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

export function LabelLayoutScreen() {
  const toast = useToast();
  const { permissions } = useAuth();
  const canEdit = Boolean(permissions && permissions.includes(PERMISSIONS.INVENTORY.BARCODE_LAYOUT_MANAGE));

  const [form, setForm] = useState(() => toForm(DEFAULT_LAYOUT));
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getBarcodeLayout()
      .then((layout) => {
        if (cancelled) return;
        setSaved(layout);
        setForm(toForm(layout));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load label layout');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const draft = useMemo(() => toLayout(form), [form]);
  const geometry = useMemo(() => computeSheetGeometry(draft), [draft]);
  const isDirty = useMemo(
    () => (saved ? JSON.stringify(toLayout(toForm(saved))) !== JSON.stringify(draft) : false),
    [saved, draft]
  );

  const setField = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (geometry.problems.length > 0) {
      toast.error({ title: 'Layout does not fit', description: geometry.problems[0] });
      return;
    }
    setSaving(true);
    setError('');
    try {
      const layout = await saveBarcodeLayout(draft);
      setSaved(layout);
      setForm(toForm(layout));
      toast.success({ title: 'Label layout saved', description: 'New sheets will use this layout.' });
    } catch (err) {
      toast.error({ title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(toForm(saved || DEFAULT_LAYOUT));
  };

  const handleDefaults = () => {
    setForm(toForm(DEFAULT_LAYOUT));
  };

  const handlePreviewPdf = async () => {
    setPreviewing(true);
    try {
      const blob = await fetchLayoutPreviewPdf();
      const url = window.URL.createObjectURL(blob);
      const opened = window.open(url, '_blank', 'noopener');
      if (!opened) {
        // Popup blocked: fall back to a download
        const link = document.createElement('a');
        link.href = url;
        link.download = 'label-layout-preview.pdf';
        link.click();
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error({ title: 'Preview failed', description: err.message });
    } finally {
      setPreviewing(false);
    }
  };

  const renderField = (field) => {
    if (field.type === 'select') {
      return (
        <Select
          key={field.key}
          label={field.label}
          value={form[field.key]}
          options={field.options}
          onChange={(v) => setField(field.key, v)}
          disabled={!canEdit}
        />
      );
    }
    if (field.type === 'checkbox') {
      return (
        <label key={field.key} className="flex items-center gap-3 pt-1 text-sm font-medium text-[var(--ink)]">
          <input
            type="checkbox"
            checked={Boolean(form[field.key])}
            onChange={(e) => setField(field.key, e.target.checked)}
            disabled={!canEdit}
            className="h-4 w-4 rounded border-[var(--border-strong)] text-primary focus:ring-[var(--focus-ring)]"
          />
          {field.label}
        </label>
      );
    }
    return (
      <Input
        key={field.key}
        id={`layout-${field.key}`}
        label={field.label}
        type="number"
        inputMode="decimal"
        step={field.step}
        min={field.min ?? 0}
        max={field.max}
        value={form[field.key]}
        onChange={(e) => setField(field.key, e.target.value)}
        disabled={!canEdit}
      />
    );
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="label-layout-heading" data-testid="label-layout">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="label-layout-heading" className="typography-heading mb-1">Configure barcode sheet</h2>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Every size on the printed barcode sheet. The preview updates as you type; Save applies it to the next sheet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handleDefaults} disabled={!canEdit || loading}>
            Load defaults
          </Button>
          <Button type="button" variant="secondary" onClick={handleReset} disabled={!isDirty || loading}>
            Discard changes
          </Button>
          <Button type="button" variant="secondary" onClick={handlePreviewPdf} disabled={previewing || loading}>
            {previewing ? 'Rendering…' : 'Preview PDF (saved layout)'}
          </Button>
          <Button type="submit" form="label-layout-form" disabled={!canEdit || saving || loading || !isDirty}>
            {saving ? 'Saving…' : 'Save layout'}
          </Button>
        </div>
      </div>

      {!canEdit && !loading && (
        <div className="rounded-md border-l-4 border-[var(--waking)] bg-[rgba(138,90,31,0.1)] p-3 text-sm text-[var(--ink)]">
          You can view the layout but need the <code>inventory.barcode_layout_manage</code> permission to change it.
        </div>
      )}

      {error && (
        <div className="rounded-md border-l-4 border-[var(--danger)] bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">{error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Form */}
        <form id="label-layout-form" onSubmit={handleSave} className="flex flex-col gap-4">
          {GROUPS.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">{group.fields.map(renderField)}</CardContent>
            </Card>
          ))}
        </form>

        {/* Preview */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          {geometry.problems.length > 0 && (
            <div
              role="alert"
              className="rounded-md border-l-4 border-[var(--danger)] bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]"
            >
              {geometry.problems[0]}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>One label</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <LabelPreview geometry={geometry} />
              <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-1 text-sm text-[var(--ink-muted)] sm:grid-cols-4">
                <dt>Label</dt>
                <dd className="text-[var(--ink)]" data-testid="label-size">
                  {fmtMm(geometry.label.width)} × {fmtMm(geometry.label.height)}
                </dd>
                <dt>Barcode</dt>
                <dd className="text-[var(--ink)]">
                  {fmtMm(geometry.barcode.width)} × {fmtMm(geometry.barcode.height)}
                </dd>
                <dt>Price box</dt>
                <dd className="text-[var(--ink)]" data-testid="info-box-height">
                  {fmtMm(geometry.infoBox.height)} tall
                </dd>
                <dt>Per page</dt>
                <dd className="text-[var(--ink)]" data-testid="per-page">
                  {geometry.perPage} labels
                </dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Page — {draft.pageSize} {draft.orientation}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <PagePreview geometry={geometry} />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

export default LabelLayoutScreen;
