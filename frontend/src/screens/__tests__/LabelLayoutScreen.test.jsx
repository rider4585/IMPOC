import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../components/ui/index.js';
import { DEFAULT_LAYOUT, computeSheetGeometry } from '../../platform/labelLayout.js';

vi.mock('../../services/barcodeLayoutApi.js', () => ({
  getBarcodeLayout: vi.fn(),
  saveBarcodeLayout: vi.fn(),
  fetchLayoutPreviewPdf: vi.fn(),
}));

const authState = { permissions: ['inventory.barcode_generate', 'inventory.barcode_layout_manage'] };
vi.mock('../../auth/useAuth.js', () => ({ useAuth: () => authState }));

import * as api from '../../services/barcodeLayoutApi.js';
import { LabelLayoutScreen } from '../LabelLayoutScreen.jsx';

const renderScreen = () => render(<ToastProvider><LabelLayoutScreen /></ToastProvider>);

describe('LabelLayoutScreen (R-50)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.permissions = ['inventory.barcode_generate', 'inventory.barcode_layout_manage'];
    api.getBarcodeLayout.mockResolvedValue({ ...DEFAULT_LAYOUT, updatedAt: '2026-09-13T00:00:00Z' });
    api.saveBarcodeLayout.mockImplementation(async (layout) => ({ ...layout, updatedAt: 'later' }));
  });

  it('loads the saved layout into the form and previews it', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText(/barcode width/i)).toHaveValue(35));
    expect(screen.getByTestId('per-page')).toHaveTextContent('15 labels');
    expect(screen.getByTestId('label-preview')).toBeInTheDocument();
    expect(screen.getByTestId('page-preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save layout/i })).toBeDisabled();
  });

  it('recomputes the preview as fields change', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText(/^columns$/i)).toHaveValue(3));

    fireEvent.change(screen.getByLabelText(/^columns$/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/^rows$/i), { target: { value: '4' } });

    expect(screen.getByTestId('per-page')).toHaveTextContent('8 labels');
    const expected = computeSheetGeometry({ ...DEFAULT_LAYOUT, columns: 2, rows: 4 });
    expect(screen.getByTestId('label-size')).toHaveTextContent(`${(expected.label.width / (72 / 25.4)).toFixed(1)} mm`);
    expect(screen.getByRole('button', { name: /save layout/i })).not.toBeDisabled();
  });

  it('warns when the layout cannot be printed and refuses to save it', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText(/barcode width/i)).toHaveValue(35));

    fireEvent.change(screen.getByLabelText(/barcode width/i), { target: { value: '190' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/wider than the label/i);

    fireEvent.click(screen.getByRole('button', { name: /save layout/i }));
    await waitFor(() => expect(screen.getByText(/layout does not fit/i)).toBeInTheDocument());
    expect(api.saveBarcodeLayout).not.toHaveBeenCalled();
  });

  it('saves a valid edited layout as numbers and shows a toast', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText(/barcode width/i)).toHaveValue(35));

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
    await waitFor(() => expect(screen.getByLabelText(/^rows$/i)).toHaveValue(5));
    fireEvent.change(screen.getByLabelText(/^rows$/i), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /discard changes/i }));
    expect(screen.getByLabelText(/^rows$/i)).toHaveValue(5);
  });

  it('is read-only without the manage permission', async () => {
    authState.permissions = ['inventory.barcode_generate'];
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText(/barcode width/i)).toHaveValue(35));
    expect(screen.getByLabelText(/barcode width/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /save layout/i })).toBeDisabled();
    expect(screen.getByText(/need the/i)).toBeInTheDocument();
  });

  it('opens the backend-rendered preview PDF', { timeout: 15000 }, async () => {
    api.fetchLayoutPreviewPdf.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
    global.URL.createObjectURL = vi.fn(() => 'blob:preview');
    global.URL.revokeObjectURL = vi.fn();
    window.open = vi.fn(() => ({}));

    renderScreen();
    await waitFor(() => expect(screen.getByLabelText(/barcode width/i)).toHaveValue(35));
    fireEvent.click(screen.getByRole('button', { name: /preview pdf/i }));

    // blob creation + window.open run after an awaited fetch; allow headroom under full-suite load
    await waitFor(() => expect(window.open).toHaveBeenCalledWith('blob:preview', '_blank', 'noopener'), { timeout: 10000 });
  });
});
