import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/index.js';
import * as authModule from '../../auth/useAuth.js';
import * as tripsService from '../../services/tripsApi.js';
import * as vendorsService from '../../services/vendorsApi.js';
import * as picklistsService from '../../services/picklistsApi.js';
import * as unitsService from '../../services/unitsApi.js';
import { navigationRegistry, navigationSections } from '../../app/navigation.js';
import { PERMISSIONS } from '../../constants/permissions.js';

vi.mock('../../auth/useAuth.js');
vi.mock('../../services/tripsApi.js');
vi.mock('../../services/vendorsApi.js');
vi.mock('../../services/picklistsApi.js');
vi.mock('../../services/unitsApi.js');

import { StocksScreen } from '../inventory/StocksScreen.jsx';
import { UnitsScreen } from '../inventory/UnitsScreen.jsx';

const VIEWER = ['inventory.view'];

const PRODUCT_TYPES = [
  { uuid: 'pt-sari', name: 'Sari', parentUuid: null, isActive: true },
  { uuid: 'st-paithani', name: 'Paithani', parentUuid: 'pt-sari', isActive: true },
];

const TRIPS = [{ uuid: 't1', name: 'Delhi run', purchasedOn: '2026-09-05' }];
const VENDORS = [{ uuid: 'v1', name: 'Sharma Fabrics', phone: '9876543210', isActive: true }];

const STOCKS = [
  {
    uuid: 'st1',
    tripUuid: 't1',
    vendorUuid: 'v1',
    vendorName: 'Sharma Fabrics',
    productTypeUuid: 'pt-sari',
    subTypeUuid: 'st-paithani',
    quantity: 5,
    unitsScannedCount: 3,
    buyingPricePaise: '150000',
    wholeBuyingPricePaise: '700000',
    sellingPricePaise: '200000',
    floorPricePaise: '120000',
    channel: 'RETAIL',
    createdAt: '2026-09-05T10:00:00Z',
    updatedAt: '2026-09-05T10:00:00Z',
  },
];

const UNITS = [
  {
    uuid: 'u1',
    barcode: '8901234567890',
    stockUuid: 'su1',
    stockName: 'Sari Paithani',
    vendorName: 'Sharma Fabrics',
    tripUuid: 't1',
    colourName: 'Red',
    sizeName: 'XL',
    status: 'in_stock',
    buyingPricePaise: '150000',
    sellingPricePaise: '200000',
    floorPricePaise: '120000',
    channel: 'RETAIL',
  },
  {
    uuid: 'u2',
    barcode: '8901234567891',
    stockUuid: 'su2',
    stockName: 'Saree Banarasi',
    vendorName: 'Southern Silk',
    tripUuid: 't1',
    colourName: null,
    sizeName: 'M',
    status: 'sold',
    buyingPricePaise: '180000',
    sellingPricePaise: '250000',
    floorPricePaise: '150000',
    channel: 'RETAIL',
  },
];

function renderWithToast(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

function PathProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="probe-path">{pathname}{search}</div>;
}

describe('navigationSections — inventory tab order (R-12)', () => {
  it('orders inventory items Trips, Vendors, Stocks, Units, Print labels with correct gates', () => {
    const inventory = navigationSections.find((s) => s.key === 'inventory');
    expect(inventory.items.map((i) => i.label)).toEqual([
      'Trips',
      'Vendors',
      'Stocks',
      'Units',
      'Print labels',
    ]);
    expect(inventory.items.map((i) => i.permission)).toEqual([
      PERMISSIONS.INVENTORY.VIEW,
      PERMISSIONS.INVENTORY.VIEW,
      PERMISSIONS.INVENTORY.VIEW,
      PERMISSIONS.INVENTORY.VIEW,
      PERMISSIONS.INVENTORY.BARCODE_GENERATE,
    ]);
    expect(inventory.items.map((i) => i.path)).toEqual([
      '/trips',
      '/vendors',
      '/stocks',
      '/units',
      '/barcode-sheets',
    ]);
  });

  it('registers /stocks and /units in the flat registry under inventory.view', () => {
    const stocks = navigationRegistry.find((e) => e.path === '/stocks');
    const units = navigationRegistry.find((e) => e.path === '/units');
    expect(stocks).toBeTruthy();
    expect(stocks.permission).toBe(PERMISSIONS.INVENTORY.VIEW);
    expect(units).toBeTruthy();
    expect(units.permission).toBe(PERMISSIONS.INVENTORY.VIEW);
  });
});

describe('StocksScreen (R-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: VIEWER });
    tripsService.getTrips.mockResolvedValue(TRIPS);
    tripsService.listAllStocks.mockResolvedValue(STOCKS);
    vendorsService.getVendors.mockResolvedValue(VENDORS);
    picklistsService.getProductTypes.mockResolvedValue(PRODUCT_TYPES);
  });

  it('renders rows with type/subtype, vendor, trip, N-of-M and whole + per-unit prices', async () => {
    renderWithToast(
      <MemoryRouter initialEntries={['/stocks']}>
        <Routes>
          <Route path="/stocks" element={<StocksScreen />} />
          <Route path="*" element={<PathProbe />} />
        </Routes>
      </MemoryRouter>
    );

    const row = await screen.findByTestId('stock-row');
    expect(row).toHaveTextContent('Sari');
    expect(row).toHaveTextContent('(Paithani)');
    expect(row).toHaveTextContent('Sharma Fabrics');
    expect(row).toHaveTextContent('Delhi run');
    expect(row).toHaveTextContent('3 of 5');
    expect(row).toHaveTextContent('Whole ₹7,000.00');
    expect(row).toHaveTextContent('Per unit ₹1,500.00');
  });

  it('translates search/trip/vendor filters into the right query params', async () => {
    renderWithToast(
      <MemoryRouter initialEntries={['/stocks']}>
        <Routes>
          <Route path="/stocks" element={<StocksScreen />} />
          <Route path="*" element={<PathProbe />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByTestId('stock-row');

    fireEvent.change(screen.getByLabelText(/search stocks/i), { target: { value: 'Paithani' } });
    await waitFor(() => {
      expect(tripsService.listAllStocks).toHaveBeenLastCalledWith({ search: 'Paithani', tripUuid: '', vendorUuid: '' });
    });

    fireEvent.change(screen.getByLabelText(/^trip$/i), { target: { value: 't1' } });
    await waitFor(() => {
      expect(tripsService.listAllStocks).toHaveBeenLastCalledWith({ search: 'Paithani', tripUuid: 't1', vendorUuid: '' });
    });

    fireEvent.change(screen.getByLabelText(/^vendor$/i), { target: { value: 'v1' } });
    await waitFor(() => {
      expect(tripsService.listAllStocks).toHaveBeenLastCalledWith({ search: 'Paithani', tripUuid: 't1', vendorUuid: 'v1' });
    });
  });

  it('navigates Scan to the intake screen', async () => {
    renderWithToast(
      <MemoryRouter initialEntries={['/stocks']}>
        <Routes>
          <Route path="/stocks" element={<StocksScreen />} />
          <Route path="*" element={<PathProbe />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByTestId('stock-row');

    fireEvent.click(screen.getByTestId('stock-scan'));
    await waitFor(() => {
      expect(screen.getByTestId('probe-path')).toHaveTextContent('/trips/t1/stocks/st1/scan');
    });
  });

  it('navigates Units to ?stockUuid=', async () => {
    renderWithToast(
      <MemoryRouter initialEntries={['/stocks']}>
        <Routes>
          <Route path="/stocks" element={<StocksScreen />} />
          <Route path="*" element={<PathProbe />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByTestId('stock-row');

    fireEvent.click(screen.getByTestId('stock-units'));
    await waitFor(() => {
      expect(screen.getByTestId('probe-path')).toHaveTextContent('/units?stockUuid=st1');
    });
  });

  it('shows an error state with a working retry', async () => {
    tripsService.listAllStocks.mockRejectedValueOnce(new Error('Boom'));
    renderWithToast(
      <MemoryRouter initialEntries={['/stocks']}>
        <Routes>
          <Route path="/stocks" element={<StocksScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('alert');
    expect(screen.getByText('Boom')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByTestId('stock-row');
  });

  it('renders an empty state with no stocks', async () => {
    tripsService.listAllStocks.mockResolvedValue([]);
    renderWithToast(
      <MemoryRouter initialEntries={['/stocks']}>
        <Routes>
          <Route path="/stocks" element={<StocksScreen />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('No stocks.')).toBeInTheDocument();
  });
});

describe('UnitsScreen (R-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: VIEWER });
    unitsService.listAllUnits.mockResolvedValue(UNITS);
  });

  it('renders barcode chip, status badge, stock, vendor, colour+size and buying price', async () => {
    renderWithToast(
      <MemoryRouter initialEntries={['/units']}>
        <Routes>
          <Route path="/units" element={<UnitsScreen />} />
        </Routes>
      </MemoryRouter>
    );

    const rows = await screen.findAllByTestId('unit-row');
    expect(rows[0]).toHaveTextContent('8901234567890');
    expect(rows[0]).toHaveTextContent('In stock');
    expect(rows[0]).toHaveTextContent('Sari Paithani');
    expect(rows[0]).toHaveTextContent('Sharma Fabrics');
    expect(rows[0]).toHaveTextContent('Red');
    expect(rows[0]).toHaveTextContent('(XL)');
    expect(rows[0]).toHaveTextContent('Buy ₹1,500.00');

    expect(rows[1]).toHaveTextContent('Sold');
    expect(rows[1]).toHaveTextContent('Saree Banarasi');
    expect(rows[1]).toHaveTextContent('Buy ₹1,800.00');
    expect(screen.getByText(/status key/i)).toBeInTheDocument();
  });

  it('reads ?stockUuid= from location.search and applies status + search filters', async () => {
    renderWithToast(
      <MemoryRouter initialEntries={['/units?stockUuid=su1']}>
        <Routes>
          <Route path="/units" element={<UnitsScreen />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findAllByTestId('unit-row');

    await waitFor(() => {
      expect(unitsService.listAllUnits).toHaveBeenLastCalledWith({ search: '', status: '', stockUuid: 'su1' });
    });

    fireEvent.change(screen.getByLabelText(/^status$/i), { target: { value: 'sold' } });
    await waitFor(() => {
      expect(unitsService.listAllUnits).toHaveBeenLastCalledWith({ search: '', status: 'sold', stockUuid: 'su1' });
    });

    fireEvent.change(screen.getByLabelText(/search units/i), { target: { value: 'Banarasi' } });
    await waitFor(() => {
      expect(unitsService.listAllUnits).toHaveBeenLastCalledWith({ search: 'Banarasi', status: 'sold', stockUuid: 'su1' });
    });
    expect(screen.getByLabelText(/stock filter/i)).toHaveValue('su1');
  });

  it('shows an error state with a working retry', async () => {
    unitsService.listAllUnits.mockRejectedValueOnce(new Error('Units boom'));
    renderWithToast(
      <MemoryRouter initialEntries={['/units']}>
        <Routes>
          <Route path="/units" element={<UnitsScreen />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('alert');
    expect(screen.getByText('Units boom')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findAllByTestId('unit-row');
  });
});