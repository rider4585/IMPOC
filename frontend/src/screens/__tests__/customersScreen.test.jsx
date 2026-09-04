import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../components/ui/index.js';
import * as authModule from '../../auth/useAuth.js';
import * as customersApi from '../../services/customersApi.js';

vi.mock('../../auth/useAuth.js');
vi.mock('../../services/customersApi.js');

import { CustomersScreen } from '../customers/CustomersScreen.jsx';

const PERMS = {
  CUSTOMERS: { VIEW: 'customers.view', CREATE: 'customers.create', UPDATE: 'customers.update' },
};

function renderWithToast(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const SAMPLE = [
  {
    uuid: 'c1',
    name: 'Priya Sharma',
    phone: '9876543210',
    email: 'priya@example.com',
    consentWhatsapp: true,
    consentEmail: false,
    consentSms: false,
    consentWhatsappGroup: false,
    customerCount: 3,
  },
  {
    uuid: 'c2',
    name: 'Ravi Kumar',
    phone: '9123456780',
    email: null,
    consentWhatsapp: false,
    consentEmail: false,
    consentSms: true,
    consentWhatsappGroup: false,
  },
];

describe('CustomersScreen (T-20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({
      permissions: [PERMS.CUSTOMERS.VIEW, PERMS.CUSTOMERS.CREATE, PERMS.CUSTOMERS.UPDATE],
    });
    customersApi.searchCustomers.mockResolvedValue(SAMPLE);
  });

  it('renders the customer list with purchases count and consent', async () => {
    renderWithToast(<CustomersScreen />);
    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });
    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('searches by phone/name term', async () => {
    renderWithToast(<CustomersScreen />);
    const input = screen.getByLabelText(/search customers/i);
    fireEvent.change(input, { target: { value: 'Priya' } });
    await waitFor(() => {
      expect(customersApi.searchCustomers).toHaveBeenCalledWith('Priya');
    });
  });

  it('opens the create dialog and creates a customer', async () => {
    customersApi.createCustomer.mockResolvedValue({ uuid: 'c3', name: 'New Person' });
    renderWithToast(<CustomersScreen />);
    fireEvent.click(screen.getByTestId('customer-create'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^name$/i), { target: { value: 'New Person' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Create customer/ }));
    await waitFor(() => {
      expect(customersApi.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Person' })
      );
    });
  });

  it('shows the permission-null state without customers.view', () => {
    authModule.useAuth.mockReturnValue({ permissions: [] });
    renderWithToast(<CustomersScreen />);
    expect(screen.getByText(/do not have permission to view customers/i)).toBeInTheDocument();
  });
});