import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as customersApi from '../../services/customersApi.js';

vi.mock('../../services/customersApi.js');

import { CustomerPicker } from '../customers/CustomerPicker.jsx';

function Controlled({ onPick }) {
  const [value, setValue] = useState(null);
  return (
    <CustomerPicker
      value={value}
      onChange={(c) => {
        onPick(c);
        setValue(c);
      }}
    />
  );
}

describe('CustomerPicker (T-20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects an existing customer from search results', async () => {
    customersApi.searchCustomers.mockResolvedValue([
      { uuid: 'c1', name: 'Priya Sharma', phone: '9876543210', customerCount: 3 },
    ]);
    const onChange = vi.fn();
    render(<Controlled onPick={onChange} />);

    const input = screen.getByLabelText(/customer/i);
    fireEvent.change(input, { target: { value: 'Priya' } });
    fireEvent.click(await screen.findByRole('button', { name: /priya sharma/i }));

    expect(onChange).toHaveBeenCalledWith({
      uuid: 'c1',
      name: 'Priya Sharma',
      phone: '9876543210',
      customerCount: 3,
    });
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(customersApi.searchCustomers).toHaveBeenCalledWith('Priya');
  });

  it('inline-creates a customer with consent and hands it back', async () => {
    customersApi.searchCustomers.mockResolvedValue([]);
    customersApi.createCustomer.mockResolvedValue({
      uuid: 'c9',
      name: 'New Person',
      phone: '9000000000',
      consentWhatsapp: true,
    });
    const onChange = vi.fn();
    render(<Controlled onPick={onChange} />);

    const input = screen.getByLabelText(/customer/i);
    fireEvent.change(input, { target: { value: 'zzz' } });
    fireEvent.click(screen.getByTestId('customer-picker-create'));

    await screen.findByText('New customer');
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'New Person' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '9000000000' } });
    fireEvent.click(screen.getByRole('button', { name: /save customer/i }));

    await waitFor(() => {
      expect(customersApi.createCustomer).toHaveBeenCalledWith({
        name: 'New Person',
        phone: '9000000000',
        email: undefined,
        dob: undefined,
        consentWhatsapp: false,
        consentEmail: false,
        consentSms: false,
        consentWhatsappGroup: false,
      });
      expect(onChange).toHaveBeenCalledWith({
        uuid: 'c9',
        name: 'New Person',
        phone: '9000000000',
        consentWhatsapp: true,
      });
    });
  });

  it('renders the selected chip and clears it', async () => {
    const onChange = vi.fn();
    render(
      <CustomerPicker
        value={{ uuid: 'c1', name: 'Priya Sharma', phone: '9876543210' }}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('customer-picker-clear'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});