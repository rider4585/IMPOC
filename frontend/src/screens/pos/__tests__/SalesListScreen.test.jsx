import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import * as authModule from '../../../auth/useAuth.js';
import * as salesApi from '../../../services/salesApi.js';

vi.mock('../../../auth/useAuth.js');
vi.mock('../../../services/salesApi.js');

import { SalesListScreen } from '../SalesListScreen.jsx';

const PERMS = ['sales.view'];

const SALES = [
  {
    uuid: 's1',
    saleNumber: 'SAL-001',
    soldAt: '2026-09-20T10:00:00.000Z',
    customerName: 'Priya Sharma',
    status: 'completed',
    totalPaise: '250000',
    lines: [{ uuid: 'l1' }, { uuid: 'l2' }],
    tags: [{ uuid: 'tag-bengaluru', name: 'Bengaluru Expo' }],
  },
  {
    uuid: 's2',
    saleNumber: 'SAL-002',
    soldAt: '2026-09-21T11:00:00.000Z',
    customerName: 'Anita Rao',
    status: 'completed',
    totalPaise: '150000',
    lines: [{ uuid: 'l3' }],
    tags: [
      { uuid: 'tag-bengaluru', name: 'Bengaluru Expo' },
      { uuid: 'tag-mysore', name: 'Mysore Fair' },
    ],
  },
  {
    uuid: 's3',
    saleNumber: 'SAL-003',
    soldAt: '2026-09-22T12:00:00.000Z',
    customerName: 'Walk-in',
    status: 'refunded',
    totalPaise: '90000',
    lines: [{ uuid: 'l4' }],
    tags: [],
  },
];

function renderScreen() {
  return render(<SalesListScreen />);
}

async function waitForSales() {
  await waitFor(() => expect(screen.getByText('SAL-001')).toBeInTheDocument());
}

describe('SalesListScreen - tags (R-73)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: PERMS });
    salesApi.listSales.mockResolvedValue(SALES);
  });

  it('renders a Tags column with a badge per tag and a dash when untagged', async () => {
    renderScreen();
    await waitForSales();

    // Scope to the grid: the tag names also appear as filter chips above it.
    const grid = within(screen.getByRole('table'));
    expect(grid.getByRole('columnheader', { name: 'Tags' })).toBeInTheDocument();
    expect(grid.getAllByText('Bengaluru Expo').length).toBe(2);
    expect(grid.getAllByText('Mysore Fair').length).toBe(1);
    expect(grid.getByText('—')).toBeInTheDocument();
  });

  it('loads with no tag filter and re-queries the API with OR-semantics uuids', async () => {
    renderScreen();
    await waitForSales();

    expect(salesApi.listSales).toHaveBeenCalledWith({ tagUuids: [] });

    const filter = screen.getByTestId('sales-tag-filter');
    expect(filter).toBeInTheDocument();
    // One chip per distinct tag on the loaded sales, in first-seen order.
    expect(screen.getByRole('button', { name: 'Bengaluru Expo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mysore Fair' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mysore Fair' }));
    await waitFor(() =>
      expect(salesApi.listSales).toHaveBeenLastCalledWith({ tagUuids: ['tag-mysore'] })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bengaluru Expo' }));
    await waitFor(() =>
      expect(salesApi.listSales).toHaveBeenLastCalledWith({
        tagUuids: ['tag-mysore', 'tag-bengaluru'],
      })
    );
  });

  it('de-selects a chip and clears the whole filter', async () => {
    renderScreen();
    await waitForSales();

    fireEvent.click(screen.getByRole('button', { name: 'Mysore Fair' }));
    await waitFor(() =>
      expect(salesApi.listSales).toHaveBeenLastCalledWith({ tagUuids: ['tag-mysore'] })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mysore Fair' }));
    await waitFor(() => expect(salesApi.listSales).toHaveBeenLastCalledWith({ tagUuids: [] }));

    fireEvent.click(screen.getByRole('button', { name: 'Bengaluru Expo' }));
    await waitFor(() =>
      expect(salesApi.listSales).toHaveBeenLastCalledWith({ tagUuids: ['tag-bengaluru'] })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(salesApi.listSales).toHaveBeenLastCalledWith({ tagUuids: [] }));
  });

  it('keeps the tag options after a filtered load so the chips cannot vanish', async () => {
    // Server returns only the Mysore Fair row for the filtered request.
    salesApi.listSales.mockImplementation(async ({ tagUuids }) =>
      tagUuids.length ? SALES.filter((s) => s.uuid === 's2') : SALES
    );
    renderScreen();
    await waitForSales();

    fireEvent.click(screen.getByRole('button', { name: 'Mysore Fair' }));
    await waitFor(() =>
      expect(salesApi.listSales).toHaveBeenLastCalledWith({ tagUuids: ['tag-mysore'] })
    );
    await waitFor(() => expect(screen.queryByText('SAL-001')).not.toBeInTheDocument());

    // Both chips survive even though the new payload only mentions one tag.
    expect(screen.getByRole('button', { name: 'Mysore Fair' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bengaluru Expo' })).toBeInTheDocument();
  });

  it('hides the filter when no sale carries a tag', async () => {
    salesApi.listSales.mockResolvedValue([SALES[2]]);
    renderScreen();
    await waitFor(() => expect(screen.getByText('SAL-003')).toBeInTheDocument());
    expect(screen.queryByTestId('sales-tag-filter')).not.toBeInTheDocument();
  });

  it('says so when the filter excludes everything', async () => {
    salesApi.listSales.mockImplementation(async ({ tagUuids }) => (tagUuids.length ? [] : SALES));
    renderScreen();
    await waitForSales();

    fireEvent.click(screen.getByRole('button', { name: 'Mysore Fair' }));
    await waitFor(() =>
      expect(screen.getByText('No sales carry the selected tags.')).toBeInTheDocument()
    );
  });

  it('keeps the existing DataGrid column filters working alongside the tag filter', async () => {
    renderScreen();
    await waitForSales();

    const saleNumberFilter = within(screen.getByRole('columnheader', { name: /Sale #/ })).getByPlaceholderText(
      'Filter…'
    );
    fireEvent.change(saleNumberFilter, { target: { value: 'SAL-002' } });

    await waitFor(() => expect(screen.queryByText('SAL-001')).not.toBeInTheDocument());
    expect(screen.getByText('SAL-002')).toBeInTheDocument();
    expect(screen.queryByText('SAL-003')).not.toBeInTheDocument();
    // The client-side column filter never touched the server-side tag filter.
    expect(salesApi.listSales).toHaveBeenCalledTimes(1);
  });
});
