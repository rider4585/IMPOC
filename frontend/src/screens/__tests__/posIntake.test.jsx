import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/index.js';
import * as authModule from '../../auth/useAuth.js';
import * as unitsService from '../../services/unitsApi.js';
import * as salesService from '../../services/salesApi.js';
import * as tripsService from '../../services/tripsApi.js';
import * as vendorsService from '../../services/vendorsApi.js';
import * as customersApi from '../../services/customersApi.js';

vi.mock('../../auth/useAuth.js');
vi.mock('../../services/unitsApi.js');
vi.mock('../../services/salesApi.js');
vi.mock('../../services/tripsApi.js');
vi.mock('../../services/vendorsApi.js');
vi.mock('../../services/customersApi.js', () => ({
  searchCustomers: vi.fn().mockResolvedValue([]),
  createCustomer: vi.fn(),
}));
vi.mock('../../services/picklistsApi.js', () => ({
  getProductTypes: vi.fn().mockResolvedValue([]),
  getColours: vi.fn().mockResolvedValue([]),
  getSizes: vi.fn().mockResolvedValue([]),
  getPaymentMethods: vi.fn().mockResolvedValue([
    { uuid: 'pm-1', name: 'Cash', isActive: true },
    { uuid: 'pm-2', name: 'UPI', isActive: true },
  ]),
  getCustomerSources: vi.fn().mockResolvedValue([
    { uuid: 'cs-1', name: 'Instagram', isActive: true },
    { uuid: 'cs-2', name: 'WhatsApp group', isActive: true },
    { uuid: 'cs-3', name: 'Pamphlet', isActive: true },
  ]),
}));

vi.mock('../../components/BarcodeScanner.jsx', () => ({
  default: ({ onDetected }) => (
    <div data-testid="pos-barcode-scanner">
      <button type="button" onClick={() => onDetected('SCANNED-1')}>
        Simulate scan
      </button>
    </div>
  ),
}));

import { POSScreen } from '../pos/POSScreen.jsx';
import { TripsScreen } from '../inventory/TripsScreen.jsx';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('adds a sellable unit by barcode showing product name + details and updates the total', async () => {
    unitsService.getUnitByBarcode.mockResolvedValue({
      uuid: 'u1',
      barcode: 'B-100',
      status: 'in_stock',
      channel: 'RETAIL',
      sellingPricePaise: '25000',
      stockName: 'Sari Paithani',
      colourName: 'Red',
      sizeName: 'XL',
    });
    renderWithToast(<POSScreen />);
    fireEvent.change(screen.getByLabelText(/barcode/), { target: { value: 'B-100' } });
    fireEvent.keyDown(screen.getByLabelText(/barcode/), { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Sari Paithani')).toBeInTheDocument();
    });
    const row = screen.getByText('Sari Paithani').closest('li');
    expect(row).toHaveTextContent('B-100');
    expect(row).toHaveTextContent('Red');
    expect(row).toHaveTextContent('XL');
    expect(screen.getByTestId('pos-total').textContent).toBe('₹250.00');
  });

  it('falls back to the barcode when the unit has no stock name', async () => {
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
      expect(screen.getByText('Item B-100')).toBeInTheDocument();
    });
    expect(screen.getByText('B-100')).toBeInTheDocument();
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
      expect(salesService.createSale).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: undefined,
          customerUuid: undefined,
          paymentMethod: 'Cash',
          items: [{ unitUuid: 'u1', sellingPricePaise: 25000 }],
          requestUuid: expect.stringMatching(UUID_V4_REGEX),
        })
      );
      expect(screen.getByRole('heading', { name: /Receipt — SALE-001/ })).toBeInTheDocument();
    });
  });

  it('does not crash when CustomerPicker search returns results', async () => {
    customersApi.searchCustomers.mockResolvedValue([
      { uuid: 'cust-1', name: 'Priya Sharma', phone: '9876543210' },
    ]);
    renderWithToast(<POSScreen />);
    const input = screen.getByLabelText(/^customer$/i);
    fireEvent.change(input, { target: { value: 'Priya' } });
    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });
  });

  it('checks out a sale with a picked customer and sends customerUuid', async () => {
    customersApi.searchCustomers.mockResolvedValue([
      { uuid: 'cust-1', name: 'Priya Sharma', phone: '9876543210', customerCount: 3 },
    ]);
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
      customerName: 'Priya Sharma',
      customer: { name: 'Priya Sharma', phone: '9876543210', email: null },
      soldAt: '2026-01-01T00:00:00.000Z',
      totalPaise: '25000',
      status: 'completed',
      lines: [{ uuid: 'l1', barcode: 'B-100', sellingPricePaise: '25000', unitStatus: 'sold' }],
      reversals: [],
    });
    renderWithToast(<POSScreen />);

    const barcodeInput = screen.getByLabelText(/barcode/);
    fireEvent.change(barcodeInput, { target: { value: 'B-100' } });
    fireEvent.keyDown(barcodeInput, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('B-100')).toBeInTheDocument());

    const pickerInput = screen.getByLabelText(/^customer$/i);
    fireEvent.change(pickerInput, { target: { value: 'Priya' } });
    fireEvent.click(await screen.findByRole('button', { name: /priya sharma/i }));

    fireEvent.click(screen.getByTestId('pos-checkout'));
    await waitFor(() => {
      expect(salesService.createSale).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: 'Priya Sharma',
          customerUuid: 'cust-1',
          paymentMethod: 'Cash',
          items: [{ unitUuid: 'u1', sellingPricePaise: 25000 }],
          requestUuid: expect.stringMatching(UUID_V4_REGEX),
        })
      );
      expect(screen.getByRole('heading', { name: /Receipt — SALE-001/ })).toBeInTheDocument();
    });
  });

  it('edits a cart line selling price and sends the edited amount (R-30)', async () => {
    unitsService.getUnitByBarcode.mockResolvedValue({
      uuid: 'u1',
      barcode: 'B-100',
      status: 'in_stock',
      channel: 'RETAIL',
      sellingPricePaise: '25000',
      floorPricePaise: '20000',
    });
    salesService.createSale.mockResolvedValue({
      uuid: 's1',
      saleNumber: 'SALE-001',
      customerName: null,
      soldAt: '2026-01-01T00:00:00.000Z',
      totalPaise: '30000',
      status: 'completed',
      lines: [{ uuid: 'l1', barcode: 'B-100', sellingPricePaise: '30000', unitStatus: 'sold' }],
      reversals: [],
    });
    renderWithToast(<POSScreen />);
    const barcodeInput = screen.getByLabelText(/barcode/);
    fireEvent.change(barcodeInput, { target: { value: 'B-100' } });
    fireEvent.keyDown(barcodeInput, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('B-100')).toBeInTheDocument());

    const priceInput = screen.getByLabelText('Selling price for B-100');
    fireEvent.change(priceInput, { target: { value: '300.00' } });
    fireEvent.keyDown(priceInput, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByTestId('pos-total').textContent).toBe('₹300.00');
    });

    fireEvent.click(screen.getByTestId('pos-checkout'));
    await waitFor(() => {
      expect(salesService.createSale).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ unitUuid: 'u1', sellingPricePaise: 30000 }],
        })
      );
    });
  });

  it('refuses a selling price below the floor price at checkout (R-30)', async () => {
    unitsService.getUnitByBarcode.mockResolvedValue({
      uuid: 'u1',
      barcode: 'B-100',
      status: 'in_stock',
      channel: 'RETAIL',
      sellingPricePaise: '25000',
      floorPricePaise: '30000',
    });
    renderWithToast(<POSScreen />);
    const barcodeInput = screen.getByLabelText(/barcode/);
    fireEvent.change(barcodeInput, { target: { value: 'B-100' } });
    fireEvent.keyDown(barcodeInput, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('B-100')).toBeInTheDocument());

    const priceInput = screen.getByLabelText(/^Selling price for B-100/);
    fireEvent.change(priceInput, { target: { value: '100' } });
    fireEvent.keyDown(priceInput, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Price cannot be below floor price')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pos-checkout'));
    await waitFor(() => {
      expect(salesService.createSale).not.toHaveBeenCalled();
    });
  });
});

describe('POS scanner feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: [FULL.SALES.CREATE, FULL.SALES.VIEW] });
  });

  it('opens the camera scanner and adds a scanned unit to the cart', async () => {
    unitsService.getUnitByBarcode.mockResolvedValue({
      uuid: 'u1',
      barcode: 'SCANNED-1',
      status: 'in_stock',
      channel: 'RETAIL',
      sellingPricePaise: '10000',
      stockName: 'Sari Kanchi',
      colourName: 'Blue',
      sizeName: 'M',
    });
    renderWithToast(<POSScreen />);
    fireEvent.click(screen.getByTestId('pos-scan-open'));
    await waitFor(() => {
      expect(screen.getByTestId('pos-barcode-scanner')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Simulate scan'));
    await waitFor(() => {
      expect(screen.getByText('Sari Kanchi')).toBeInTheDocument();
      expect(screen.queryByTestId('pos-barcode-scanner')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('pos-total').textContent).toBe('₹100.00');
  });

  it('sends the picked customer source to checkout', async () => {
    unitsService.getUnitByBarcode.mockResolvedValue({
      uuid: 'u1',
      barcode: 'B-100',
      status: 'in_stock',
      channel: 'RETAIL',
      sellingPricePaise: '25000',
      stockName: 'Sari Paithani',
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

    fireEvent.click(screen.getByTestId('pos-customer-source'));
    fireEvent.click(await screen.findByRole('option', { name: /instagram/i }));

    fireEvent.click(screen.getByTestId('pos-checkout'));
    await waitFor(() => {
      expect(salesService.createSale).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: undefined,
          customerUuid: undefined,
          paymentMethod: 'Cash',
          customerSource: 'Instagram',
          items: [{ unitUuid: 'u1', sellingPricePaise: 25000 }],
          requestUuid: expect.stringMatching(UUID_V4_REGEX),
        })
      );
    });
  });
});

describe('TripsScreen (R-07 rewrite of T-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: [FULL.INVENTORY.VIEW, FULL.INVENTORY.CREATE] });
    vendorsService.getVendors.mockResolvedValue([{ uuid: 'v1', name: 'Sharma Fabrics' }]);
    tripsService.getTrips.mockResolvedValue([
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
