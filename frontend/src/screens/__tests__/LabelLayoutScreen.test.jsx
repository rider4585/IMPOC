import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../components/ui/index.js';
import { DEFAULT_LAYOUT, computeSheetGeometry } from '../../platform/labelLayout.js';

vi.mock('../../services/barcodeLayoutApi.js', () => ({
  getBarcodeLayout: vi.fn(),
  saveBarcodeLayout: vi.fn(),
  fetchLayoutPreviewPdf: vi.fn(),
  getBarcodeLayoutTemplates: vi.fn(),
  createBarcodeLayoutTemplate: vi.fn(),
  deleteBarcodeLayoutTemplate: vi.fn(),
}));

const authState = { permissions: ['inventory.barcode_generate', 'inventory.barcode_layout_manage'] };
vi.mock('../../auth/useAuth.js', () => ({ useAuth: () => authState }));

import * as api from '../../services/barcodeLayoutApi.js';
import { LabelLayoutScreen } from '../LabelLayoutScreen.jsx';

const renderScreen = () => render(<ToastProvider><LabelLayoutScreen /></ToastProvider>);

// The screen sets the form values and then `loading=false` in separate renders
// (.then -> .finally), so wait for the *loaded* UI, not just the first value.
const waitLoaded = async () => {
  await waitFor(() => expect(screen.getByLabelText(/barcode width/i)).toHaveValue(35));
  await waitFor(() => expect(screen.getByRole('button', { name: /preview pdf/i })).not.toBeDisabled());
};

describe('LabelLayoutScreen (R-50)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.permissions = ['inventory.barcode_generate', 'inventory.barcode_layout_manage'];
    api.getBarcodeLayout.mockResolvedValue({ ...DEFAULT_LAYOUT, updatedAt: '2026-09-13T00:00:00Z' });
    api.getBarcodeLayoutTemplates.mockResolvedValue([]);
    api.createBarcodeLayoutTemplate.mockImplementation(async ({ name, layout }) => ({ uuid: 't-new', name, layout }));
    api.deleteBarcodeLayoutTemplate.mockResolvedValue({ uuid: 't1' });
    try { localStorage.clear(); } catch { /* ignore */ }
    api.saveBarcodeLayout.mockImplementation(async (layout) => ({ ...layout, updatedAt: 'later' }));
  });

  it('loads the saved layout into the form and previews it', async () => {
    renderScreen();
    await waitLoaded();
    expect(screen.getByTestId('per-page')).toHaveTextContent('15 labels');
    expect(screen.getByTestId('label-preview')).toBeInTheDocument();
    expect(screen.getByTestId('page-preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save layout/i })).toBeDisabled();
  });

  it('recomputes the preview as fields change', async () => {
    renderScreen();
    await waitLoaded();

    fireEvent.change(screen.getByLabelText(/^columns$/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/^rows$/i), { target: { value: '4' } });

    expect(screen.getByTestId('per-page')).toHaveTextContent('8 labels');
    const expected = computeSheetGeometry({ ...DEFAULT_LAYOUT, columns: 2, rows: 4 });
    expect(screen.getByTestId('label-size')).toHaveTextContent(`${(expected.label.width / (72 / 25.4)).toFixed(1)} mm`);
    expect(screen.getByRole('button', { name: /save layout/i })).not.toBeDisabled();
  });

  it('warns when the layout cannot be printed and refuses to save it', async () => {
    renderScreen();
    await waitLoaded();

    fireEvent.change(screen.getByLabelText(/barcode width/i), { target: { value: '190' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/wider than the label/i);

    fireEvent.click(screen.getByRole('button', { name: /save layout/i }));
    await waitFor(() => expect(screen.getByText(/layout does not fit/i)).toBeInTheDocument());
    expect(api.saveBarcodeLayout).not.toHaveBeenCalled();
  });

  it('saves a valid edited layout as numbers and shows a toast', async () => {
    renderScreen();
    await waitLoaded();

    fireEvent.change(screen.getByLabelText(/barcode width/i), { target: { value: '40' } });
    fireEvent.click(screen.getByLabelText(/draw divider line/i));
    fireEvent.click(screen.getByRole('button', { name: /save layout/i }));

    await waitFor(() => expect(api.saveBarcodeLayout).toHaveBeenCalledTimes(1));
    expect(api.saveBarcodeLayout).toHaveBeenCalledWith(
      expect.objectContaining({ barcodeWidthMm: 40, showDivider: false, columns: 3 })
    );
    await waitFor(() => expect(screen.getByText(/label layout saved/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /save layout/i })).toBeDisabled();
  });

  it('discard restores the saved values', async () => {
    renderScreen();
    await waitLoaded();
    fireEvent.change(screen.getByLabelText(/^rows$/i), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /discard changes/i }));
    expect(screen.getByLabelText(/^rows$/i)).toHaveValue(5);
  });

  it('is read-only without the manage permission', async () => {
    authState.permissions = ['inventory.barcode_generate'];
    renderScreen();
    await waitLoaded();
    expect(await screen.findByText(/need the/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/barcode width/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /save layout/i })).toBeDisabled();
  });

  it('opens the backend-rendered preview PDF', async () => {
    api.fetchLayoutPreviewPdf.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
    global.URL.createObjectURL = vi.fn(() => 'blob:preview');
    global.URL.revokeObjectURL = vi.fn();
    window.URL.createObjectURL = global.URL.createObjectURL;
    window.URL.revokeObjectURL = global.URL.revokeObjectURL;
    window.open = vi.fn(() => ({}));

    renderScreen();
    await waitLoaded();
    fireEvent.click(screen.getByRole('button', { name: /preview pdf/i }));

    // blob creation + window.open run after an awaited fetch; allow headroom under full-suite load
    await waitFor(() => expect(window.open).toHaveBeenCalledWith('blob:preview', '_blank', 'noopener'));
  });

  describe('R-56: page sizes + templates', () => {
    const pickPageSize = async (label) => {
      fireEvent.click(screen.getByRole('button', { name: /page size/i }));
      fireEvent.click(await screen.findByRole('option', { name: label }));
    };

    it('offers A3 as a standard page size', async () => {
      renderScreen();
      await waitLoaded();
      await pickPageSize(/^A3/);
      expect(screen.getByTestId('per-page')).toHaveTextContent('15 labels');
      expect(screen.getByText(/Page — A3 portrait/)).toBeInTheDocument();
    });

    it('accepts a custom size entered in inches and stores it as mm', async () => {
      renderScreen();
      await waitLoaded();

      await pickPageSize(/custom size/i);
      const custom = await screen.findByTestId('custom-page-size');
      expect(custom).toBeInTheDocument();
      // default custom = 4 x 6 inch shown in mm first
      expect(screen.getByLabelText(/page width \(mm\)/i)).toHaveValue(101.6);

      // switch to inches and type 4 x 6 -> stored 101.6 x 152.4 mm
      fireEvent.click(screen.getByRole('button', { name: /^unit$/i }));
      fireEvent.click(await screen.findByRole('option', { name: /inch/i }));
      expect(screen.getByLabelText(/page width \(inch\)/i)).toHaveValue(4);
      fireEvent.change(screen.getByLabelText(/page width \(inch\)/i), { target: { value: '5' } });
      fireEvent.change(screen.getByLabelText(/page height \(inch\)/i), { target: { value: '7' } });
      expect(screen.getByText(/Stored as 127 × 177.8 mm/)).toBeInTheDocument();
      expect(screen.getByText(/Page — Custom 127 × 177.8 mm portrait/)).toBeInTheDocument();
      expect(localStorage.getItem('label-layout:custom-unit')).toBe('in');

      fireEvent.change(screen.getByLabelText(/^columns$/i), { target: { value: '2' } });
      fireEvent.change(screen.getByLabelText(/^rows$/i), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: /save layout/i }));
      await waitFor(() => expect(api.saveBarcodeLayout).toHaveBeenCalledTimes(1));
      expect(api.saveBarcodeLayout).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 'CUSTOM', pageCustomWidthMm: 127, pageCustomHeightMm: 177.8, columns: 2, rows: 3 }));
    });

    it('saves the current draft as a template, applies a template into the form, deletes one', async () => {
      const roll = { uuid: 't1', name: 'Roll 4x6', layout: { ...DEFAULT_LAYOUT, pageSize: 'CUSTOM', pageCustomWidthMm: 101.6, pageCustomHeightMm: 152.4, columns: 2, rows: 3, marginTopMm: 4, marginRightMm: 4, marginBottomMm: 4, marginLeftMm: 4, gapHorizontalMm: 3, gapVerticalMm: 3 } };
      api.getBarcodeLayoutTemplates.mockResolvedValueOnce([]).mockResolvedValue([roll]);

      renderScreen();
      await waitLoaded();

      // save current (A4 3x5) as a template
      fireEvent.change(screen.getByLabelText(/save the current settings as a template/i), { target: { value: 'Default A4' } });
      fireEvent.click(screen.getByTestId('save-template'));
      await waitFor(() => expect(api.createBarcodeLayoutTemplate).toHaveBeenCalledWith({ name: 'Default A4', layout: expect.objectContaining({ pageSize: 'A4', columns: 3 }) }));
      await screen.findByText(/template saved/i);

      // templates reloaded -> pick + apply the roll template
      await waitFor(() => expect(api.getBarcodeLayoutTemplates).toHaveBeenCalledTimes(2));
      fireEvent.click(await screen.findByRole('button', { name: /saved templates/i }));
      fireEvent.click(await screen.findByRole('option', { name: /roll 4x6/i }));
      fireEvent.click(screen.getByTestId('apply-template'));

      await waitFor(() => expect(screen.getByLabelText(/^columns$/i)).toHaveValue(2));
      expect(screen.getByTestId('per-page')).toHaveTextContent('6 labels');
      expect(screen.getByTestId('custom-page-size')).toBeInTheDocument();
      expect(api.saveBarcodeLayout).not.toHaveBeenCalled(); // apply only fills the form
      expect(screen.getByRole('button', { name: /save layout/i })).not.toBeDisabled();

      fireEvent.click(screen.getByTestId('delete-template'));
      await waitFor(() => expect(api.deleteBarcodeLayoutTemplate).toHaveBeenCalledWith('t1'));
    });
  });
});
