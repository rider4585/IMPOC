import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../components/ui/index.js';
import * as authModule from '../../auth/useAuth.js';
import * as unitsService from '../../services/unitsApi.js';
import * as salesService from '../../services/salesApi.js';
import * as rentalsService from '../../services/rentalsApi.js';
import * as picklistsApi from '../../services/picklistsApi.js';

vi.mock('../../auth/useAuth.js');
vi.mock('../../services/unitsApi.js');
vi.mock('../../services/salesApi.js');
vi.mock('../../services/rentalsApi.js');
vi.mock('../../services/customersApi.js', () => ({
  searchCustomers: vi.fn().mockResolvedValue([]),
  createCustomer: vi.fn(),
}));
vi.mock('../../services/posDisplayApi.js', () => ({
  publishPosDisplayState: vi.fn().mockResolvedValue({ status: 'idle' }),
}));

vi.mock('../../services/picklistsApi.js', () => ({
  getProductTypes: vi.fn().mockResolvedValue([]),
  getColours: vi.fn().mockResolvedValue([]),
  getSizes: vi.fn().mockResolvedValue([]),
  getPaymentMethods: vi.fn().mockResolvedValue([
    { uuid: 'pm-1', name: 'Cash', isActive: true },
    { uuid: 'pm-2', name: 'UPI', isActive: true },
  ]),
  getCustomerSources: vi.fn().mockResolvedValue([]),
  getUpiAccounts: vi.fn().mockResolvedValue([]),
  getReviewLinks: vi.fn().mockResolvedValue([]),
  getTransactionTags: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../components/BarcodeScanner.jsx', () => ({
  default: () => <div data-testid="pos-barcode-scanner" />,
}));

import { POSScreen } from '../pos/POSScreen.jsx';

/**
 * R-73b — the tagging input path at the till.
 *
 * A sale may carry SEVERAL tags. Only active tags flagged "show on POS" are
 * offered, EVERY active tag flagged "select by default" is pre-ticked, the
 * chosen uuids ride along in the createSale payload as tagUuids, and the default
 * set is re-applied after each completed sale and on cart clear. Rentals never
 * show or send tags.
 */

const SELLABLE = {
  uuid: 'u1',
  barcode: 'B-100',
  status: 'in_stock',
  channel: 'RETAIL',
  sellingPricePaise: '25000',
};

const SALE_OK = {
  uuid: 's1',
  saleNumber: 'SALE-001',
  soldAt: '2026-01-01T00:00:00.000Z',
  totalPaise: '25000',
  status: 'completed',
  lines: [{ uuid: 'l1', barcode: 'B-100', sellingPricePaise: '25000', unitStatus: 'sold' }],
  reversals: [],
};

function tag(uuid, name, extra = {}) {
  return { uuid, name, isActive: true, showOnPos: true, isDefault: false, ...extra };
}

function renderScreen() {
  return render(
    <ToastProvider>
      <POSScreen />
    </ToastProvider>
  );
}

async function addUnitToCart(barcode = 'B-100') {
  const input = screen.getByLabelText(/barcode/);
  fireEvent.change(input, { target: { value: barcode } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(screen.getByText(barcode)).toBeInTheDocument());
}

// Checkout opens the Payment dialog; the sale is created on "Mark received".
async function checkoutViaPaymentDialog() {
  fireEvent.click(screen.getByTestId('pos-checkout'));
  await waitFor(() => expect(screen.getByTestId('payment-mark-received')).toBeInTheDocument());
  fireEvent.click(screen.getByTestId('payment-mark-received'));
  await waitFor(() => expect(salesService.createSale).toHaveBeenCalled());
}

function chip(name) {
  return screen.getByRole('button', { name });
}

describe('POSScreen transaction tags (R-73b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: ['sales.create', 'sales.view'] });
    unitsService.getUnitByBarcode.mockResolvedValue(SELLABLE);
    salesService.createSale.mockResolvedValue(SALE_OK);
  });

  it('offers only active tags flagged show on POS', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      tag('t-expo', 'Bengaluru Expo'),
      tag('t-hidden', 'Hidden at till', { showOnPos: false }),
      tag('t-inactive', 'Retired expo', { isActive: false }),
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());
    expect(chip('Bengaluru Expo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hidden at till' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retired expo' })).not.toBeInTheDocument();
  });

  it('renders no tag selector at all when no tag is shown on POS', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      tag('t-hidden', 'Hidden at till', { showOnPos: false }),
    ]);
    renderScreen();
    await waitFor(() => expect(picklistsApi.getTransactionTags).toHaveBeenCalled());
    expect(screen.queryByTestId('pos-tags')).not.toBeInTheDocument();
  });

  it('pre-checks every tag flagged select by default', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      tag('t-a', 'Expo A', { isDefault: true }),
      tag('t-b', 'Expo B', { isDefault: true }),
      tag('t-c', 'Walk-in Saturday'),
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());
    expect(chip('Expo A')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Expo B')).toHaveAttribute('aria-pressed', 'true');
    // A non-default tag is offered but not ticked.
    expect(chip('Walk-in Saturday')).toHaveAttribute('aria-pressed', 'false');
  });

  it('never pre-checks a default tag that is not shown on POS or is inactive', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      tag('t-a', 'Expo A', { isDefault: true }),
      tag('t-hidden-default', 'Hidden default', { showOnPos: false, isDefault: true }),
      tag('t-retired-default', 'Retired default', { isActive: false, isDefault: true }),
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());
    expect(chip('Expo A')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Hidden default' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retired default' })).not.toBeInTheDocument();
  });

  it('toggles several tags independently and sends them as tagUuids', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      tag('t-a', 'Expo A'),
      tag('t-b', 'Expo B'),
      tag('t-c', 'Walk-in Saturday'),
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());
    fireEvent.click(chip('Expo A'));
    fireEvent.click(chip('Walk-in Saturday'));
    expect(chip('Expo A')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Expo B')).toHaveAttribute('aria-pressed', 'false');

    await addUnitToCart();
    await checkoutViaPaymentDialog();
    expect(salesService.createSale).toHaveBeenCalledWith(
      expect.objectContaining({ tagUuids: ['t-a', 't-c'] })
    );
  });

  it('unticking a default tag drops it from the payload', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      tag('t-a', 'Expo A', { isDefault: true }),
      tag('t-b', 'Expo B', { isDefault: true }),
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());
    fireEvent.click(chip('Expo B'));

    await addUnitToCart();
    await checkoutViaPaymentDialog();
    expect(salesService.createSale).toHaveBeenCalledWith(
      expect.objectContaining({ tagUuids: ['t-a'] })
    );
  });

  it('sends an empty tagUuids array when nothing is ticked', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([tag('t-a', 'Expo A')]);
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());

    await addUnitToCart();
    await checkoutViaPaymentDialog();
    expect(salesService.createSale).toHaveBeenCalledWith(
      expect.objectContaining({ tagUuids: [] })
    );
  });

  it('re-applies the defaults after a completed sale', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      tag('t-a', 'Expo A', { isDefault: true }),
      tag('t-b', 'Expo B', { isDefault: true }),
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());
    // The counter unticks one and ticks another for this customer.
    fireEvent.click(chip('Expo B'));
    fireEvent.click(chip('Expo A'));

    await addUnitToCart();
    await checkoutViaPaymentDialog();

    const newTransaction = await screen.findByTestId('pos-new-transaction', {}, { timeout: 4000 });
    fireEvent.click(newTransaction);
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());
    // Both defaults are back, so the next customer of the same expo needs no taps.
    expect(chip('Expo A')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Expo B')).toHaveAttribute('aria-pressed', 'true');
  });

  it('re-applies the defaults on cart clear', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      tag('t-a', 'Expo A', { isDefault: true }),
      tag('t-b', 'Expo B', { isDefault: true }),
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());
    fireEvent.click(chip('Expo A'));

    await addUnitToCart();
    // UX-M5: Clear is a two-tap confirm.
    fireEvent.click(screen.getByTestId('pos-clear'));
    fireEvent.click(screen.getByTestId('pos-clear'));

    await waitFor(() => expect(screen.getByText(/cart is empty/i)).toBeInTheDocument());
    expect(chip('Expo A')).toHaveAttribute('aria-pressed', 'true');
  });

  it('still checks out when the tag fetch fails', async () => {
    picklistsApi.getTransactionTags.mockRejectedValue(new Error('Failed to fetch transaction tags'));
    renderScreen();
    await waitFor(() => expect(picklistsApi.getTransactionTags).toHaveBeenCalled());
    expect(screen.queryByTestId('pos-tags')).not.toBeInTheDocument();

    await addUnitToCart();
    await checkoutViaPaymentDialog();
    expect(salesService.createSale).toHaveBeenCalledWith(
      expect.objectContaining({ tagUuids: [] })
    );
  });

  it('does not show tags in rental mode', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      tag('t-a', 'Expo A', { isDefault: true }),
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^rental$/i }));
    await waitFor(() => expect(screen.queryByTestId('pos-tags')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Expo A' })).not.toBeInTheDocument();

    // and back to sale: the default is re-applied by the clearCart on mode switch
    fireEvent.click(screen.getByRole('button', { name: /^sale$/i }));
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());
    expect(chip('Expo A')).toHaveAttribute('aria-pressed', 'true');
  });

  it('never sends tagUuids with a rental, even right after tagging a sale', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      tag('t-a', 'Expo A', { isDefault: true }),
    ]);
    rentalsService.createRental.mockResolvedValue({
      uuid: 'r1',
      agreementNumber: 'RENT-001',
      startDate: '2026-01-01',
      dueDate: '2026-01-04',
      status: 'active',
      depositRefundablePaise: '0',
      lines: [{ uuid: 'rl1', barcode: 'R-900', rentPerDayPaise: '10000', depositPaise: '0' }],
    });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('pos-tags')).toBeInTheDocument());
    // Tag the sale, then switch to rental: the tags must not follow the rental.
    fireEvent.click(chip('Expo A'));

    fireEvent.click(screen.getByRole('button', { name: /^rental$/i }));
    unitsService.getUnitByBarcode.mockResolvedValue({
      uuid: 'ru1',
      barcode: 'R-900',
      status: 'in_stock',
      channel: 'RENTAL',
      rentPerDayPaise: '10000',
      depositPaise: '0',
    });
    await addUnitToCart('R-900');
    fireEvent.click(screen.getByTestId('pos-checkout'));

    await waitFor(() => expect(rentalsService.createRental).toHaveBeenCalled());
    const payload = rentalsService.createRental.mock.calls[0][0];
    expect(payload).not.toHaveProperty('tagUuids');
    expect(salesService.createSale).not.toHaveBeenCalled();
  });
});
