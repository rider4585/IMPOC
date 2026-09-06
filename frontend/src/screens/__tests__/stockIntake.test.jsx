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
  tripsService.scanBarcodeIntoStock.mockImplementation(async (stockUuid, payload) => {
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

  it('does NOT commit on decode alone — counter ticks only after Save unit', async () => {
    setup();
    renderIntake();
    await waitFor(() => expect(screen.getByText(/0 of 3/)).toBeInTheDocument());

    await enterDecodedState('100001');

    // Decoded but not yet saved: counter must still read 0 of 3 (nothing written).
    expect(screen.getByText(/0 of 3/)).toBeInTheDocument();
    expect(tripsService.scanBarcodeIntoStock).not.toHaveBeenCalled();

    await pickColourSize('Red', 'M');
    fireEvent.click(screen.getByTestId('save-unit'));

    await waitFor(() => expect(screen.getByText(/1 of 3/)).toBeInTheDocument());
    expect(tripsService.scanBarcodeIntoStock).toHaveBeenCalledTimes(1);
    expect(tripsService.scanBarcodeIntoStock).toHaveBeenCalledWith(
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
    fireEvent.click(screen.getByTestId('save-unit'));

    await waitFor(() => expect(screen.getByText(/already used/i)).toBeInTheDocument());
    // Counter unchanged on refusal (nothing written, no increment).
    expect(screen.getByText(/0 of 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dismiss-refusal'));
    // Dismiss re-arms the camera (ARMED state) so the operator can rescan immediately.
    await waitFor(() => expect(screen.getByTestId('camera-stub')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('disables saving when the stock is full and offers Close stock', async () => {
    setup({ initialStock: makeStock(3, 3) });
    renderIntake();
    await waitFor(() => expect(screen.getByText(/3 of 3 — stock complete/i)).toBeInTheDocument());
    expect(screen.getByTestId('close-stock')).toBeInTheDocument();
    // No save affordance available when full from the start.
    expect(screen.queryByTestId('save-unit')).not.toBeInTheDocument();
  });

  it('pre-fills colour + size from the previously saved unit on the next scan', async () => {
    setup();
    renderIntake();
    await waitFor(() => expect(screen.getByText(/0 of 3/)).toBeInTheDocument());

    // Save a first unit with Red/M.
    await enterDecodedState('100001');
    await pickColourSize('Red', 'M');
    fireEvent.click(screen.getByTestId('save-unit'));
    await waitFor(() => expect(screen.getByText(/1 of 3/)).toBeInTheDocument());

    // Second unit: colour+size should pre-fill from the last saved unit.
    await enterDecodedState('100002');
    expect(screen.getByLabelText(/colour/i)).toHaveTextContent('Red');
    expect(screen.getByLabelText(/size/i)).toHaveTextContent('M');
  });
});