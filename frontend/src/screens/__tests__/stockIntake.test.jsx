import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/index.js';
import * as authModule from '../../auth/useAuth.js';
import * as tripsService from '../../services/tripsApi.js';
import * as picklistsService from '../../services/picklistsApi.js';

vi.mock('../../auth/useAuth.js');
vi.mock('../../services/tripsApi.js');
vi.mock('../../services/picklistsApi.js');
vi.mock('../../platform/wakingRequest.js', () => ({
  wakingRequest: (fn) => fn(),
}));
vi.mock('../../components/BarcodeScanner.jsx', () => ({
  default: ({ onDetected }) => <div data-testid="camera-stub" />,
}));

import { StockIntake } from '../inventory/StockIntake.jsx';

const CREATOR = ['inventory.create', 'inventory.view'];

const COLOURS = [
  { uuid: 'c1', name: 'Red', isActive: true },
  { uuid: 'c2', name: 'Blue', isActive: true },
];
const SIZES = [
  { uuid: 's1', name: 'M', isActive: true },
  { uuid: 's2', name: 'L', isActive: true },
];

let stockState = {};

function makeStock(scannedCount = 0, quantity = 3) {
  return {
    uuid: 'S1',
    name: 'Kurti A',
    quantity,
    unitsScannedCount: scannedCount,
    buyingPricePaise: 50000,
    sellingPricePaise: 120000,
    rentPerDayPaise: null,
    channel: 'RETAIL',
  };
}

function setup({ initialStock } = {}) {
  if (initialStock) stockState = { ...initialStock };
  stockState = stockState.uuid ? stockState : makeStock();
  tripsService.getStock.mockImplementation(async () => stockState);
  tripsService.scanBarcodeIntoStock.mockImplementation(async (tripUuid, stockUuid, payload) => {
    stockState = { ...stockState, unitsScannedCount: stockState.unitsScannedCount + 1 };
    return { ok: true };
  });
  picklistsService.getColours.mockResolvedValue(COLOURS);
  picklistsService.getSizes.mockResolvedValue(SIZES);
  authModule.useAuth.mockReturnValue({ permissions: CREATOR });
}

function renderIntake() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/trips/t1/stocks/S1/scan']}>
        <Routes>
          <Route path="/trips/:tripUuid/stocks/:stockUuid/scan" element={<StockIntake />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

async function enterDecodedState(barcode = '100001') {
  fireEvent.click(screen.getByText(/type the number instead/i));
  await waitFor(() => expect(screen.getByPlaceholderText(/barcode number/i)).toBeInTheDocument());
  fireEvent.change(screen.getByPlaceholderText(/barcode number/i), { target: { value: barcode } });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));
  await waitFor(() => expect(screen.getByTestId('save-unit')).toBeInTheDocument());
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Drive a SearchableSelect combobox: click the trigger, type into the search
// input, then click the matching option row. (Modeled on tripsFlow.test.jsx.)
async function selectCombo(label, optionName, queryText) {
  fireEvent.click(screen.getByLabelText(label));
  const search = await screen.findByRole('combobox', { name: new RegExp(`^${escapeRegExp(label)}$`, 'i') });
  if (queryText != null) fireEvent.change(search, { target: { value: queryText } });
  fireEvent.click(await screen.findByRole('option', { name: optionName }));
}

async function pickColourSize(colourName, sizeName) {
  await selectCombo('Colour', colourName, colourName);
  await selectCombo('Size', sizeName, sizeName);
}

describe('StockIntake — Scan Primitive (Schema V2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stockState = makeStock();
    if (global.navigator && !global.navigator.vibrate) {
      global.navigator.vibrate = () => true;
    }
  });

  it('renders the N-of-M idle counter and a scan action', async () => {
    setup();
    renderIntake();
    await waitFor(() => expect(screen.getByText(/0 of 3/)).toBeInTheDocument());
    expect(screen.getByTestId('scan-barcode')).toBeInTheDocument();
  });

  it('does NOT commit on decode alone — commits automatically once colour + size are picked (UX-H5)', async () => {
    setup();
    renderIntake();
    await waitFor(() => expect(screen.getByText(/0 of 3/)).toBeInTheDocument());

    await enterDecodedState('100001');

    // Decoded but no colour/size yet: counter must still read 0 of 3 and nothing
    // may be written (no pick, no tap).
    expect(screen.getByText(/0 of 3/)).toBeInTheDocument();
    expect(tripsService.scanBarcodeIntoStock).not.toHaveBeenCalled();

    // Picking the last required field is the commit (auto commit-repeat loop).
    await pickColourSize('Red', 'M');

    await waitFor(() => expect(screen.getByText(/1 of 3/)).toBeInTheDocument());
    expect(tripsService.scanBarcodeIntoStock).toHaveBeenCalledTimes(1);
    expect(tripsService.scanBarcodeIntoStock).toHaveBeenCalledWith(
      't1',
      'S1',
      { barcode: '100001', colourUuid: 'c1', sizeUuid: 's1' }
    );
  });

  it('handles a refusal (already-bound barcode) without incrementing and re-arms on dismiss', async () => {
    setup();
    tripsService.scanBarcodeIntoStock.mockRejectedValue(new Error('Barcode 100001 already bound'));
    renderIntake();
    await waitFor(() => expect(screen.getByText(/0 of 3/)).toBeInTheDocument());

    await enterDecodedState('100001');
    await pickColourSize('Red', 'M');

    await waitFor(() => expect(screen.getByText(/already used/i)).toBeInTheDocument());
    // Counter unchanged on refusal (nothing written, no increment).
    expect(screen.getByText(/0 of 3/)).toBeInTheDocument();
    expect(tripsService.scanBarcodeIntoStock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('dismiss-refusal'));
    // Dismiss re-arms the camera (ARMED state) so the operator can rescan immediately.
    await waitFor(() => expect(screen.getByTestId('camera-stub')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /stop camera/i })).toBeInTheDocument();
  });

  it('disables saving when the stock is full and offers Close stock', async () => {
    setup({ initialStock: makeStock(3, 3) });
    renderIntake();
    await waitFor(() => expect(screen.getByText(/3 of 3 — stock complete/i)).toBeInTheDocument());
    expect(screen.getByTestId('close-stock')).toBeInTheDocument();
    // No save affordance available when full from the start.
    expect(screen.queryByTestId('save-unit')).not.toBeInTheDocument();
  });

  it('starts each unit blank (no carry-over) and auto-commits once both colour + size are picked', async () => {
    setup();
    renderIntake();
    await waitFor(() => expect(screen.getByText(/0 of 3/)).toBeInTheDocument());

    // Save a first unit with Red/M — picking both commits it.
    await enterDecodedState('100001');
    await pickColourSize('Red', 'M');
    await waitFor(() => expect(screen.getByText(/1 of 3/)).toBeInTheDocument());

    // Second unit: dropdowns are BLANK (the previous unit's pick does not carry
    // over) and nothing is auto-saved. Save stays disabled until both chosen.
    await enterDecodedState('100002');
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument();
    expect(tripsService.scanBarcodeIntoStock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('save-unit')).toBeDisabled();

    // Picking both commits (picking the second field is the commit) — and a
    // fresh, different pick proves nothing was pre-selected.
    await pickColourSize('Blue', 'L');
    await waitFor(() => expect(screen.getByText(/2 of 3/)).toBeInTheDocument());
    expect(tripsService.scanBarcodeIntoStock).toHaveBeenLastCalledWith(
      't1',
      'S1',
      { barcode: '100002', colourUuid: 'c2', sizeUuid: 's2' }
    );
  });

  describe('R-57: add a colour / size inline from the dropdown', () => {
    it('with picklists.create, typing an unknown colour offers "+ Add colour", creates it, selects it and commits', async () => {
      setup();
      authModule.useAuth.mockReturnValue({ permissions: [...CREATOR, 'picklists.create'] });
      picklistsService.createPicklistItem.mockResolvedValue({ uuid: 'c-new', name: 'Maroon', isActive: true });
      renderIntake();
      await waitFor(() => expect(screen.getByText(/0 of 3/)).toBeInTheDocument());
      await enterDecodedState('100001');

      // Search is built in: typing filters; an unknown name shows the create row
      await selectCombo('Colour', /\+ Add colour "Maroon"/, 'Maroon');
      await waitFor(() => expect(picklistsService.createPicklistItem).toHaveBeenCalledWith('colours', { name: 'Maroon' }));
      await waitFor(() => expect(screen.getByLabelText('Colour')).toHaveTextContent('Maroon'));

      await selectCombo('Size', 'M', 'M');
      await waitFor(() => expect(tripsService.scanBarcodeIntoStock).toHaveBeenCalledWith('t1', 'S1', { barcode: '100001', colourUuid: 'c-new', sizeUuid: 's1' }));
    });

    it('without picklists.create there is no create row (search still works)', async () => {
      setup();
      renderIntake();
      await waitFor(() => expect(screen.getByText(/0 of 3/)).toBeInTheDocument());
      await enterDecodedState('100001');

      fireEvent.click(screen.getByLabelText('Colour'));
      const search = await screen.findByRole('combobox', { name: /^colour$/i });
      fireEvent.change(search, { target: { value: 'Maroon' } });
      expect(screen.queryByRole('option', { name: /add colour/i })).not.toBeInTheDocument();
      fireEvent.change(search, { target: { value: 'Blu' } });
      expect(await screen.findByRole('option', { name: 'Blue' })).toBeInTheDocument();
    });
  });
});
