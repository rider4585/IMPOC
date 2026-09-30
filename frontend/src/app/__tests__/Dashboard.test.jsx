import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import * as authModule from '../../auth/useAuth.js';
import * as reportsApi from '../../services/reportsApi.js';

vi.mock('../../auth/useAuth.js');
vi.mock('../../services/reportsApi.js');

import { Dashboard } from '../Dashboard.jsx';

const PERMS = ['reports.view'];

/**
 * Bengaluru Expo: 2 sales, one of which also carries Mysore Fair — the classic
 * double-count case, so the caveat has to show up. Money is paise-as-string,
 * exactly as the API returns BIGINT.
 */
const BY_TAG = {
  period: { from: '2026-09-01', to: '2026-09-30' },
  rows: [
    {
      tagUuid: 'tag-bengaluru',
      tagName: 'Bengaluru Expo',
      count: 2,
      grossPaise: '300000',
      refundedPaise: '50000',
      netPaise: '250000',
      unitsSold: 3,
    },
    {
      tagUuid: 'tag-mysore',
      tagName: 'Mysore Fair',
      count: 1,
      grossPaise: '100000',
      refundedPaise: '0',
      netPaise: '100000',
      unitsSold: 1,
    },
    {
      tagUuid: null,
      tagName: 'Untagged',
      count: 1,
      grossPaise: '75000',
      refundedPaise: '0',
      netPaise: '75000',
      unitsSold: 1,
    },
  ],
  totals: {
    count: 3,
    grossPaise: '475000',
    refundedPaise: '50000',
    netPaise: '425000',
    unitsSold: 5,
    salesWithMultipleTags: 1,
  },
};

const NO_OVERLAP = {
  ...BY_TAG,
  totals: { ...BY_TAG.totals, salesWithMultipleTags: 0 },
};

const DASHBOARD = {
  netPaise: '425000',
  sales: { netPaise: '425000' },
  rentals: { earnedPaise: '0' },
  expenses: { totalPaise: '0' },
};

function renderDashboard() {
  return render(<Dashboard />);
}

async function openByTag() {
  await waitFor(() => expect(screen.getByTestId('kpi-net')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('tab', { name: 'By tag' }));
  await waitFor(() => expect(screen.getByTestId('dashboard-by-tag')).toBeInTheDocument());
}

describe('Dashboard - By tag tab (R-73)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: PERMS });
    reportsApi.getDashboard.mockResolvedValue(DASHBOARD);
    reportsApi.getInventoryReport.mockResolvedValue({ total: 10, retailInStock: 4, byChannel: {}, byStatus: {} });
    reportsApi.getSalesReport.mockResolvedValue({ rows: [] });
    reportsApi.getRentalsReport.mockResolvedValue({ rows: [] });
    reportsApi.getExpensesReport.mockResolvedValue({ rows: [] });
    reportsApi.getSalesByTag.mockResolvedValue(BY_TAG);
  });

  it('adds a By tag tab next to the existing report tabs', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('kpi-net')).toBeInTheDocument());

    for (const label of ['Sales', 'Rentals', 'Expenses', 'Inventory', 'By tag']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('requests the report for the active period and renders one row per tag', async () => {
    renderDashboard();
    await openByTag();

    expect(reportsApi.getSalesByTag).toHaveBeenCalledTimes(1);
    const { from, to } = reportsApi.getSalesByTag.mock.calls[0][0];
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const rows = screen.getAllByTestId('by-tag-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Bengaluru Expo')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Mysore Fair')).toBeInTheDocument();
    // The Untagged row (tagUuid null) is shown too, so nothing disappears silently.
    expect(within(rows[2]).getByText('Untagged')).toBeInTheDocument();
  });

  it('formats every money cell through formatPaise (paise strings in, rupees out)', async () => {
    renderDashboard();
    await openByTag();

    const rows = screen.getAllByTestId('by-tag-row');
    // gross 300000 -> ₹3,000.00, refunded 50000 -> ₹500.00, net 250000 -> ₹2,500.00
    expect(within(rows[0]).getByText('₹3,000.00')).toBeInTheDocument();
    expect(within(rows[0]).getByText('₹500.00')).toBeInTheDocument();
    expect(within(rows[0]).getByText('₹2,500.00')).toBeInTheDocument();
    // Indian grouping is exercised by the totals row: 475000 paise.
    expect(screen.getByTestId('by-tag-gross')).toHaveTextContent('₹4,750.00');
    expect(screen.getByTestId('by-tag-net')).toHaveTextContent('₹4,250.00');
    expect(screen.getByTestId('by-tag-refunded')).toHaveTextContent('₹500.00');
  });

  it('renders the period totals row and the per-row counts', async () => {
    renderDashboard();
    await openByTag();

    const totals = screen.getByTestId('by-tag-totals');
    expect(within(totals).getByText('Period total')).toBeInTheDocument();
    expect(within(totals).getByText('₹4,750.00')).toBeInTheDocument();

    const firstRow = screen.getAllByTestId('by-tag-row')[0];
    expect(within(firstRow).getByText('2')).toBeInTheDocument(); // count
    expect(within(firstRow).getByText('3')).toBeInTheDocument(); // unitsSold
  });

  it('states the double-count caveat using totals.salesWithMultipleTags', async () => {
    renderDashboard();
    await openByTag();

    const caveat = screen.getByTestId('by-tag-caveat');
    // Singular: exactly one sale in the period carries two tags.
    expect(caveat).toHaveTextContent('1 sale carries more than one tag in this period');
    expect(caveat).toHaveTextContent('add up to MORE than the period totals');
  });

  it('pluralises the caveat for several multi-tagged sales', async () => {
    reportsApi.getSalesByTag.mockResolvedValue({
      ...BY_TAG,
      totals: { ...BY_TAG.totals, salesWithMultipleTags: 4 },
    });
    renderDashboard();
    await openByTag();

    expect(screen.getByTestId('by-tag-caveat')).toHaveTextContent(
      '4 sales carry more than one tag in this period'
    );
  });

  it('pluralises the caveat and still explains the rule when nothing is multi-tagged', async () => {
    reportsApi.getSalesByTag.mockResolvedValue(NO_OVERLAP);
    renderDashboard();
    await openByTag();

    const caveat = screen.getByTestId('by-tag-caveat');
    expect(caveat).toHaveTextContent('A sale carrying more than one tag is counted in full under each of its tags');
    expect(caveat).not.toHaveTextContent('in this period');
  });

  it('narrows the table to the selected tag so two events can be compared', async () => {
    renderDashboard();
    await openByTag();
    expect(screen.getAllByTestId('by-tag-row')).toHaveLength(3);

    const filter = screen.getByTestId('by-tag-filter');
    expect(filter).toBeInTheDocument();
    // The Untagged row has no uuid, so it is not offered as a chip.
    expect(within(filter).queryByRole('button', { name: 'Untagged' })).not.toBeInTheDocument();

    fireEvent.click(within(filter).getByRole('button', { name: 'Mysore Fair' }));

    const rows = screen.getAllByTestId('by-tag-row');
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText('Mysore Fair')).toBeInTheDocument();
    // Period totals stay honest — they describe the whole period, not the filter.
    expect(screen.getByTestId('by-tag-totals')).toBeInTheDocument();
    expect(screen.getByTestId('by-tag-gross')).toHaveTextContent('₹4,750.00');
  });

  it('clears the tag filter back to every row', async () => {
    renderDashboard();
    await openByTag();

    const filter = screen.getByTestId('by-tag-filter');
    fireEvent.click(within(filter).getByRole('button', { name: 'Bengaluru Expo' }));
    expect(screen.getAllByTestId('by-tag-row')).toHaveLength(1);

    fireEvent.click(within(filter).getByRole('button', { name: 'Clear' }));
    expect(screen.getAllByTestId('by-tag-row')).toHaveLength(3);
  });

  it('says so when the period has no sales at all', async () => {
    reportsApi.getSalesByTag.mockResolvedValue({ period: {}, rows: [], totals: null });
    renderDashboard();
    await openByTag();

    expect(screen.getByText('No sales in this period.')).toBeInTheDocument();
    expect(screen.queryByTestId('by-tag-row')).not.toBeInTheDocument();
    // Totals absent → the Kpi cards must not blow up on undefined paise.
    expect(screen.getByTestId('by-tag-gross')).toHaveTextContent('₹0.00');
    expect(screen.getByTestId('by-tag-caveat')).toBeInTheDocument();
  });
});
