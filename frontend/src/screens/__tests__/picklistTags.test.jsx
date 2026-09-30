import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../components/ui/index.js';
import * as authModule from '../../auth/useAuth.js';
import * as picklistsApi from '../../services/picklistsApi.js';

vi.mock('../../auth/useAuth.js');
// Explicit factory: the screen renders ProductTypesManager on first paint, and an
// auto-mock would hand its source() back undefined.
vi.mock('../../services/picklistsApi.js', () => ({
  getProductTypes: vi.fn().mockResolvedValue([]),
  getColours: vi.fn().mockResolvedValue([]),
  getSizes: vi.fn().mockResolvedValue([]),
  getDamageGrades: vi.fn().mockResolvedValue([]),
  getPaymentMethods: vi.fn().mockResolvedValue([]),
  getCustomerSources: vi.fn().mockResolvedValue([]),
  getExpenseTypes: vi.fn().mockResolvedValue([]),
  getUpiAccounts: vi.fn().mockResolvedValue([]),
  getReviewLinks: vi.fn().mockResolvedValue([]),
  getTransactionTags: vi.fn().mockResolvedValue([]),
  createPicklistItem: vi.fn().mockResolvedValue({}),
  updatePicklistItem: vi.fn().mockResolvedValue({}),
}));

import { FlatPicklistManager } from '../admin/FlatPicklistManager.jsx';
import { PicklistManagementScreen } from '../admin/PicklistManagementScreen.jsx';

const PERMS = ['picklists.view', 'picklists.create', 'picklists.update'];

const TAGS = [
  { uuid: 't-a', name: 'Bengaluru Expo', isActive: true, showOnPos: true, isDefault: true },
  { uuid: 't-b', name: 'Walk-in Saturday', isActive: true, showOnPos: true, isDefault: false },
  { uuid: 't-c', name: 'Retired expo', isActive: false, showOnPos: true, isDefault: true },
];

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'showOnPos', label: 'Show on POS', type: 'boolean' },
  { key: 'isDefault', label: 'Select by default', type: 'boolean' },
];

const FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'showOnPos', label: 'Show on POS', type: 'checkbox' },
  { key: 'isDefault', label: 'Select by default', type: 'checkbox' },
];

function renderManager() {
  return render(
    <ToastProvider>
      <FlatPicklistManager
        resource="transactionTags"
        singular="Transaction tag"
        source={picklistsApi.getTransactionTags}
        columns={COLUMNS}
        fields={FIELDS}
      />
    </ToastProvider>
  );
}

describe('FlatPicklistManager checkbox fields (R-73b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: PERMS });
    picklistsApi.getTransactionTags.mockResolvedValue([]);
  });

  it('renders checkbox fields unchecked for a new item and sends booleans', async () => {
    picklistsApi.createPicklistItem.mockResolvedValue({ uuid: 't-new' });
    renderManager();
    await waitFor(() => expect(picklistsApi.getTransactionTags).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add transaction tag/i }));
    const name = await screen.findByLabelText('Name');
    const showOnPos = screen.getByTestId('flat-field-showOnPos');
    const isDefault = screen.getByTestId('flat-field-isDefault');
    expect(showOnPos).not.toBeChecked();
    expect(isDefault).not.toBeChecked();

    fireEvent.change(name, { target: { value: 'Mysore Fair' } });
    fireEvent.click(showOnPos);
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() =>
      expect(picklistsApi.createPicklistItem).toHaveBeenCalledWith('transactionTags', {
        name: 'Mysore Fair',
        showOnPos: true,
        isDefault: false,
      })
    );
  });

  it('pre-fills checkboxes from the edited row and sends the toggled values', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue(TAGS);
    picklistsApi.updatePicklistItem.mockResolvedValue({});
    renderManager();
    await waitFor(() => expect(screen.getByText('Bengaluru Expo')).toBeInTheDocument());

    // Open the row's overflow menu, then Edit.
    fireEvent.click(screen.getByTestId('picklist-actions-t-b'));
    fireEvent.click(await screen.findByTestId('picklist-edit-t-b'));

    const showOnPos = await screen.findByTestId('flat-field-showOnPos');
    const isDefault = screen.getByTestId('flat-field-isDefault');
    expect(showOnPos).toBeChecked();
    expect(isDefault).not.toBeChecked();

    fireEvent.click(isDefault);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(picklistsApi.updatePicklistItem).toHaveBeenCalledWith('transactionTags', 't-b', {
        name: 'Walk-in Saturday',
        showOnPos: true,
        isDefault: true,
      })
    );
  });

  it('treats the string "false" as unchecked rather than truthy', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue([
      { uuid: 't-s', name: 'Stringy tag', isActive: true, showOnPos: 'false', isDefault: 'true' },
    ]);
    renderManager();
    await waitFor(() => expect(screen.getByText('Stringy tag')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('picklist-actions-t-s'));
    fireEvent.click(await screen.findByTestId('picklist-edit-t-s'));

    expect(await screen.findByTestId('flat-field-showOnPos')).not.toBeChecked();
    expect(screen.getByTestId('flat-field-isDefault')).toBeChecked();
  });

  it('renders a boolean column as a Yes/No badge, not the raw value', async () => {
    picklistsApi.getTransactionTags.mockResolvedValue(TAGS);
    renderManager();
    await waitFor(() => expect(screen.getByText('Bengaluru Expo')).toBeInTheDocument());

    const row = screen.getByText('Bengaluru Expo').closest('tr');
    // name | show on POS (Yes) | select by default (Yes) | status (active)
    expect(within(row).getAllByText('Yes')).toHaveLength(2);
    expect(within(row).getByText('active')).toBeInTheDocument();
    expect(row).not.toHaveTextContent('true');

    const offRow = screen.getByText('Walk-in Saturday').closest('tr');
    expect(within(offRow).getByText('No')).toBeInTheDocument();
  });
});

describe('PicklistManagementScreen transaction tags tab (R-73b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: PERMS });
    picklistsApi.getTransactionTags.mockResolvedValue(TAGS);
  });

  it('renders the Transaction tags tab and its manager on click', async () => {
    render(
      <ToastProvider>
        <PicklistManagementScreen />
      </ToastProvider>
    );

    const tab = screen.getByRole('tab', { name: 'Transaction tags' });
    expect(tab).toBeInTheDocument();
    // Not active on first paint — the list must not be fetched yet.
    expect(picklistsApi.getTransactionTags).not.toHaveBeenCalled();

    fireEvent.click(tab);
    await waitFor(() => expect(screen.getByText('Bengaluru Expo')).toBeInTheDocument());
    expect(picklistsApi.getTransactionTags).toHaveBeenCalled();
    // The boolean columns are there with their labels.
    expect(screen.getByText('Show on POS')).toBeInTheDocument();
    expect(screen.getByText('Select by default')).toBeInTheDocument();
  });

  it('still refuses the whole screen without the picklists.view permission', () => {
    authModule.useAuth.mockReturnValue({ permissions: [] });
    render(
      <ToastProvider>
        <PicklistManagementScreen />
      </ToastProvider>
    );
    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Transaction tags' })).not.toBeInTheDocument();
  });
});
