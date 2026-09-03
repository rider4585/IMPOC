import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/index.js';
import * as authModule from '../../auth/useAuth.js';
import * as unitsService from '../../services/unitsApi.js';
import * as salesService from '../../services/salesApi.js';
import * as intakeService from '../../services/intakeApi.js';
import * as vendorsService from '../../services/vendorsApi.js';

vi.mock('../../auth/useAuth.js');
vi.mock('../../services/unitsApi.js');
vi.mock('../../services/salesApi.js');
vi.mock('../../services/intakeApi.js');
vi.mock('../../services/vendorsApi.js');
vi.mock('../../services/picklistsApi.js', () => ({
  getProductTypes: vi.fn().mockResolvedValue([]),
  getColours: vi.fn().mockResolvedValue([]),
  getSizes: vi.fn().mockResolvedValue([]),
}));

import { POSScreen } from '../pos/POSScreen.jsx';
import { TripsScreen } from '../inventory/TripsScreen.jsx';

const FULL = {
  INVENTORY: { VIEW: 'inventory.view', CREATE: 'inventory.create', UPDATE: 'inventory.update' },
  SALES: { VIEW: 'sales.view', CREATE: 'sales.create', CANCEL: 'sales.cancel', REFUND: 'sales.refund' },
};

function renderWithToast(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('POSScreen (T-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: [FULL.SALES.CREATE, FULL.SALES.VIEW] });
  });

  it('renders empty cart state', () => {
    renderWithToast(<POSScreen />);
    expect(screen.getByRole('heading', { name: /point of sale/i })).toBeInTheDocument();
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });

  it('adds a sellable unit by barcode and updates the total', async () => {
    unitsService.getUnitByBarcode.mockResolvedValue({
      uuid: 'u1',
      barcode: 'B-100',
      status: 'in_stock',
      channel: 'RETAIL',
      sellingPricePaise: '25000',
    });
    renderWithToast(<POSScreen />);
    fireEvent.change(screen.getByLabelText(/barcode/), { target: { value: 'B-100' } });
    fireEvent.keyDown(screen.getByLabelText(/barcode/), { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('B-100')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pos-total').textContent).toBe('₹250.00');
  });

  it('rejects rental and out-of-stock units', async () => {
    unitsService.getUnitByBarcode.mockResolvedValue({
      uuid: 'u2',
      barcode: 'R-900',
      status: 'in_stock',
      channel: 'RENTAL',
      sellingPricePaise: '10000',
    });
    renderWithToast(<POSScreen />);
    const input = screen.getByLabelText(/barcode/);
    fireEvent.change(input, { target: { value: 'R-900' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText(/rental item/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('R-900')).not.toBeInTheDocument();
  });

  it('checks out and calls createSale with cart items', async () => {
    unitsService.getUnitByBarcode.mockResolvedValue({
      uuid: 'u1',
      barcode: 'B-100',
      status: 'in_stock',
      channel: 'RETAIL',
      sellingPricePaise: '25000',
    });
    salesService.createSale.mockResolvedValue({
      uuid: 's1',
      saleNumber: 'SALE-001',
      customerName: null,
      soldAt: '2026-01-01T00:00:00.000Z',
      totalPaise: '25000',
      status: 'completed',
      lines: [{ uuid: 'l1', barcode: 'B-100', sellingPricePaise: '25000', unitStatus: 'sold' }],
      reversals: [],
    });
    renderWithToast(<POSScreen />);
    const input = screen.getByLabelText(/barcode/);
    fireEvent.change(input, { target: { value: 'B-100' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('B-100')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('pos-checkout'));
    await waitFor(() => {
      expect(salesService.createSale).toHaveBeenCalledWith({
        customerName: undefined,
        items: [{ unitUuid: 'u1' }],
      });
      expect(screen.getByRole('heading', { name: /Receipt — SALE-001/ })).toBeInTheDocument();
    });
  });
});

describe('TripsScreen (R-07 rewrite of T-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: [FULL.INVENTORY.VIEW, FULL.INVENTORY.CREATE] });
    vendorsService.getVendors.mockResolvedValue([{ uuid: 'v1', name: 'Sharma Fabrics' }]);
    intakeService.getStockIntakes.mockResolvedValue([
      {
        uuid: 't1',
        vendorUuid: 'v1',
        purchasedOn: '2026-08-01',
        billReference: 'INV-01',
        totalPaidPaise: 5000000,
        variancePaise: 0,
      },
    ]);
  });

  it('renders trips list with vendor and paid amount', async () => {
    renderWithToast(<MemoryRouter><TripsScreen /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/Sharma Fabrics/)).toBeInTheDocument();
    });
    expect(screen.getByText(/₹50,000.00/)).toBeInTheDocument();
  });

  it('opens the create-trip dialog', async () => {
    renderWithToast(<MemoryRouter><TripsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('trips-create'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /create trip/i })).toBeInTheDocument();
  });
});
