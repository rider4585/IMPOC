import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/index.js';
import * as authModule from '../../auth/useAuth.js';
import * as tripsService from '../../services/tripsApi.js';
import * as vendorsService from '../../services/vendorsApi.js';

vi.mock('../../auth/useAuth.js');
vi.mock('../../services/tripsApi.js');
vi.mock('../../services/vendorsApi.js');
vi.mock('../../services/picklistsApi.js', () => ({
  getProductTypes: vi.fn().mockResolvedValue([]),
}));

import { TripsScreen } from '../inventory/TripsScreen.jsx';
import { TripDetailScreen } from '../inventory/TripDetailScreen.jsx';

const CREATOR = ['inventory.view', 'inventory.create'];

function renderWithToast(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('TripsScreen — create trip (R-10, name + date only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: CREATOR });
    vendorsService.getVendors.mockResolvedValue([{ uuid: 'v1', name: 'Sharma Fabrics' }]);
    tripsService.getTrips.mockResolvedValue([]);
  });

  it('opens the create-trip dialog and does NOT expose the old single-vendor/bill fields', async () => {
    renderWithToast(<MemoryRouter><TripsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('trips-create'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /create trip/i })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^trip name$/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/purchased on/i)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^vendor$/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/bill reference/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/total paid/i)).not.toBeInTheDocument();
  });

  it('disables the submit button until a name is provided (date defaults to today)', async () => {
    renderWithToast(<MemoryRouter><TripsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('trips-create'));
    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: /^create trip$/i });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/^trip name$/i), { target: { value: 'Delhi run' } });
    expect(submit).toBeEnabled();
    expect(within(dialog).getByLabelText(/purchased on/i).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('posts {name, purchasedOn, notes, vendors: []} — never the old flat fields', async () => {
    tripsService.createTrip.mockResolvedValue({ uuid: 't-new', name: 'Delhi run' });
    renderWithToast(<MemoryRouter><TripsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('trips-create'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^trip name$/i), { target: { value: 'Delhi run' } });
    fireEvent.change(within(dialog).getByLabelText(/purchased on/i), { target: { value: '2026-09-05' } });
    fireEvent.change(within(dialog).getByLabelText(/^notes$/i), { target: { value: 'First batch' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^create trip$/i }));

    await waitFor(() => {
      expect(tripsService.createTrip).toHaveBeenCalledTimes(1);
    });
    expect(tripsService.createTrip).toHaveBeenCalledWith({
      name: 'Delhi run',
      purchasedOn: '2026-09-05',
      notes: 'First batch',
      vendors: [],
    });
    expect(tripsService.createTrip.mock.calls[0][0]).not.toHaveProperty('vendorUuid');
    expect(tripsService.createTrip.mock.calls[0][0]).not.toHaveProperty('billReference');
    expect(tripsService.createTrip.mock.calls[0][0]).not.toHaveProperty('totalPaidPaise');
  });
});

describe('TripDetailScreen — add vendor with bill (R-10)', () => {
  let tripState;

  const makeTrip = (vendors = []) => ({
    uuid: 't1',
    name: 'Delhi run',
    purchasedOn: '2026-09-05',
    notes: null,
    status: 'active',
    totalPaidPaise: vendors.reduce((s, v) => s + Number(v.totalPaidPaise), 0),
    variancePaise: vendors.reduce((s, v) => s + Number(v.totalPaidPaise), 0),
    vendors,
    stocks: [],
  });

  const VENDORS = [
    { uuid: 'v1', name: 'Sharma Fabrics', phone: '9876543210', isActive: true },
    { uuid: 'v2', name: 'Southern Silk', phone: '9123456789', isActive: true },
  ];

  function renderDetail() {
    return renderWithToast(
      <MemoryRouter initialEntries={['/trips/t1']}>
        <Routes>
          <Route path="/trips/:tripUuid" element={<TripDetailScreen />} />
        </Routes>
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: CREATOR });
    tripState = makeTrip();
    tripsService.getTrip.mockImplementation(async () => tripState);
    tripsService.getStocks.mockResolvedValue([]);
    vendorsService.getVendors.mockResolvedValue(VENDORS);
  });

  it('attaches an existing vendor to the trip with a bill and refreshes the detail', async () => {
    tripsService.addTripVendor.mockImplementation(async (tripUuid, { vendorUuid, billReference, totalPaidPaise }) => {
      const vendor = VENDORS.find((v) => v.uuid === vendorUuid);
      tripState = makeTrip([{
        uuid: 'tv1',
        tripUuid,
        vendorUuid,
        vendorName: vendor.name,
        billReference,
        totalPaidPaise,
        notes: null,
      }]);
      return { ok: true };
    });

    renderDetail();
    await waitFor(() => expect(screen.getByTestId('add-vendor')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('add-vendor'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('existing-vendor-tab')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^vendor$/i), { target: { value: 'v1' } });
    fireEvent.change(within(dialog).getByLabelText(/bill reference/i), { target: { value: 'B-123' } });
    fireEvent.change(within(dialog).getByLabelText(/total paid/i), { target: { value: '1250' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^add vendor$/i }));

    await waitFor(() => {
      expect(tripsService.addTripVendor).toHaveBeenCalledWith(
        't1',
        { vendorUuid: 'v1', billReference: 'B-123', totalPaidPaise: 125000, notes: null }
      );
    });

    await waitFor(() => expect(screen.getByText('Sharma Fabrics')).toBeInTheDocument());
    expect(screen.getByText(/Bill B-123/)).toBeInTheDocument();
    expect(screen.getAllByText(/Paid ₹1,250.00/).length).toBeGreaterThan(0);
  });

  it('creates a NEW vendor inline (name/address/phone), attaches it with a bill, and re-renders', async () => {
    vendorsService.createVendor.mockResolvedValue({ uuid: 'v-new', name: 'Ghanshyam Exports', phone: '9000000001', address: 'MG Road' });
    tripsService.addTripVendor.mockImplementation(async (tripUuid, { vendorUuid, billReference, totalPaidPaise }) => {
      tripState = makeTrip([{
        uuid: 'tv-new',
        tripUuid,
        vendorUuid,
        vendorName: 'Ghanshyam Exports',
        billReference,
        totalPaidPaise,
        notes: null,
      }]);
      return { ok: true };
    });

    renderDetail();
    await waitFor(() => expect(screen.getByTestId('add-vendor')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('add-vendor'));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByTestId('new-vendor-tab'));
    fireEvent.change(within(dialog).getByLabelText(/^name$/i), { target: { value: 'Ghanshyam Exports' } });
    fireEvent.change(within(dialog).getByLabelText(/contact number/i), { target: { value: '9000000001' } });
    fireEvent.change(within(dialog).getByLabelText(/^address$/i), { target: { value: 'MG Road' } });
    fireEvent.change(within(dialog).getByLabelText(/bill reference/i), { target: { value: 'B-099' } });
    fireEvent.change(within(dialog).getByLabelText(/total paid/i), { target: { value: '5000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^add vendor$/i }));

    await waitFor(() => {
      expect(vendorsService.createVendor).toHaveBeenCalledWith({
        name: 'Ghanshyam Exports',
        phone: '9000000001',
        address: 'MG Road',
      });
      expect(tripsService.addTripVendor).toHaveBeenCalledWith(
        't1',
        { vendorUuid: 'v-new', billReference: 'B-099', totalPaidPaise: 500000, notes: null }
      );
    });

    await waitFor(() => expect(screen.getByText('Ghanshyam Exports')).toBeInTheDocument());
    expect(screen.getByText(/Bill B-099/)).toBeInTheDocument();
    expect(screen.getAllByText(/Paid ₹5,000.00/).length).toBeGreaterThan(0);
  });

  it('surfaces a duplicate-vendor error (backend 409) in the dialog', async () => {
    tripsService.addTripVendor.mockRejectedValue(Object.assign(new Error('Vendor already added to this trip'), { statusCode: 409 }));

    renderDetail();
    await waitFor(() => expect(screen.getByTestId('add-vendor')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('add-vendor'));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/^vendor$/i), { target: { value: 'v2' } });
    fireEvent.change(within(dialog).getByLabelText(/total paid/i), { target: { value: '1000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^add vendor$/i }));

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Vendor already added to this trip');
    });
  });
});