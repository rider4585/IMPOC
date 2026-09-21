import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../components/ui/index.js';
import * as authModule from '../../auth/useAuth.js';
import * as enquiriesApi from '../../services/enquiriesApi.js';
import * as picklistsApi from '../../services/picklistsApi.js';
import * as customersApi from '../../services/customersApi.js';

vi.mock('../../auth/useAuth.js');
vi.mock('../../services/enquiriesApi.js');
vi.mock('../../services/picklistsApi.js');
vi.mock('../../services/customersApi.js');

import { EnquiriesScreen, wantedSummary } from '../enquiries/EnquiriesScreen.jsx';

const PERMS = ['enquiries.view', 'enquiries.create', 'enquiries.update'];

function renderScreen() {
  return render(
    <ToastProvider>
      <EnquiriesScreen />
    </ToastProvider>
  );
}

const OPEN = [
  {
    uuid: 'e1',
    status: 'OPEN',
    description: 'red silk saree with golden border',
    notes: null,
    promisedDate: '2000-01-01', // long past → Overdue
    customer: { uuid: 'c1', name: 'Priya Sharma', phone: '9876543210', email: null },
    channelReadiness: {
      WHATSAPP: { ok: true, reason: null },
      EMAIL: { ok: true, reason: null },
      SMS: { ok: true, reason: null },
    },
    productType: { uuid: 'pt1', name: 'Saree' },
    colour: { uuid: 'col1', name: 'Red' },
    size: null,
    createdBy: 'Ravi',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const CLOSED = [
  {
    uuid: 'e2',
    status: 'CLOSED',
    description: 'green kurta size M',
    customer: { uuid: 'c2', name: 'Ravi Kumar', phone: '9123456780', email: null },
    productType: null,
    colour: null,
    size: null,
    closedReason: 'NOTIFIED',
    notifiedChannels: ['WHATSAPP', 'EMAIL'],
    closedNote: 'vendor stopped the line',
    createdBy: 'Asha',
    createdAt: new Date().toISOString(),
  },
];

const COUNTS = { OPEN: 1, CLOSED: 1 };

describe('EnquiriesScreen (R-63)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: PERMS });
    enquiriesApi.listEnquiries.mockImplementation(async ({ status }) => ({
      enquiries: status === 'CLOSED' ? CLOSED : OPEN,
      counts: COUNTS,
    }));
    picklistsApi.getProductTypes.mockResolvedValue([{ uuid: 'pt1', name: 'Saree', isActive: true }]);
    picklistsApi.getColours.mockResolvedValue([{ uuid: 'col1', name: 'Red', isActive: true }]);
    picklistsApi.getSizes.mockResolvedValue([{ uuid: 's1', name: 'M', isActive: true }]);
    customersApi.searchCustomers.mockResolvedValue([
      { uuid: 'c1', name: 'Priya Sharma', phone: '9876543210', email: null },
    ]);
  });

  it('lists open enquiries with the structured ask, overdue badge, age and counts on the tabs', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeInTheDocument());
    expect(enquiriesApi.listEnquiries).toHaveBeenCalledWith({ status: 'OPEN', search: '' });
    expect(screen.getByText('Saree · Red')).toBeInTheDocument();
    expect(screen.getByText('red silk saree with golden border')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('3 days')).toBeInTheDocument();
    expect(screen.getByText('Ravi')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Open/ })).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /Closed/ })).toHaveTextContent('1');
  });

  it('switches to the Closed tab, shows the close reason and offers Reopen', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Closed/ }));
    await waitFor(() => expect(screen.getByText('Ravi Kumar')).toBeInTheDocument());
    expect(enquiriesApi.listEnquiries).toHaveBeenLastCalledWith({ status: 'CLOSED', search: '' });
    expect(screen.getByText('Customer told')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp, Email')).toBeInTheDocument();
    expect(screen.getByText('vendor stopped the line')).toBeInTheDocument();

    enquiriesApi.reopenEnquiry.mockResolvedValue({ ...CLOSED[0], status: 'OPEN' });
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    await waitFor(() => expect(enquiriesApi.reopenEnquiry).toHaveBeenCalledWith('e2'));
  });

  it('searches with the typed term', async () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText(/search enquiries/i), { target: { value: '98765' } });
    await waitFor(() =>
      expect(enquiriesApi.listEnquiries).toHaveBeenCalledWith({ status: 'OPEN', search: '98765' })
    );
  });

  it('logs a new enquiry: pick the customer, describe the ask, submit the API shape', async () => {
    enquiriesApi.createEnquiry.mockResolvedValue(OPEN[0]);
    renderScreen();
    await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('enquiry-create'));

    // Pick the customer from the picker's search results.
    const picker = screen.getByLabelText('Customer');
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: 'Pri' } });
    await waitFor(() => expect(customersApi.searchCustomers).toHaveBeenCalled());
    const options = await screen.findAllByRole('button', { name: /Priya Sharma/ });
    fireEvent.click(options[0]);

    fireEvent.change(screen.getByLabelText(/What are they looking for/i), {
      target: { value: '  blue lehenga for a wedding  ' },
    });
    fireEvent.change(screen.getByLabelText(/Promised by/i), { target: { value: '2026-10-05' } });
    fireEvent.click(screen.getByTestId('enquiry-save'));

    await waitFor(() => expect(enquiriesApi.createEnquiry).toHaveBeenCalledTimes(1));
    expect(enquiriesApi.createEnquiry).toHaveBeenCalledWith({
      customerUuid: 'c1',
      productTypeUuid: null,
      colourUuid: null,
      sizeUuid: null,
      description: 'blue lehenga for a wedding',
      notes: null,
      promisedDate: '2026-10-05',
    });
  });

  it('refuses to log an enquiry without a customer', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('enquiry-create'));
    fireEvent.change(screen.getByLabelText(/What are they looking for/i), { target: { value: 'anything' } });
    fireEvent.click(screen.getByTestId('enquiry-save'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/pick the customer/i);
    expect(enquiriesApi.createEnquiry).not.toHaveBeenCalled();
  });

  it('closes as available (WhatsApp only, interim until R-62): compose, then send via wa.me', async () => {
    enquiriesApi.closeEnquiry.mockResolvedValue({
      enquiry: { ...OPEN[0], status: 'CLOSED' },
      handoffs: [{ channel: 'WHATSAPP', url: 'https://wa.me/919876543210?text=Hello' }],
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderScreen();
    await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('enquiry-actions-e1-trigger'));
    fireEvent.click(screen.getByTestId('enquiry-close-e1'));

    // "Tell the customer" is the default because WhatsApp is reachable.
    expect(screen.getByTestId('enquiry-close-notify')).toBeChecked();
    expect(screen.getByLabelText('WhatsApp')).toBeChecked();
    // Email/SMS are hidden on the FE for now even when reachable (Temp/R-62).
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('SMS')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'came in today' } });
    fireEvent.click(screen.getByTestId('enquiry-close-confirm'));
    await waitFor(() =>
      expect(enquiriesApi.closeEnquiry).toHaveBeenCalledWith('e1', {
        notify: true,
        channels: ['WHATSAPP'],
        note: 'came in today',
      })
    );

    // Composer: pre-filled with the server message, editable, send opens wa.me.
    const compose = await screen.findByTestId('enquiry-handoff-message');
    expect(compose.value).toBe('Hello');
    fireEvent.change(compose, { target: { value: 'Hi Priya, your saree is ready today!' } });
    fireEvent.click(screen.getByTestId('enquiry-handoff-send'));
    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/919876543210?text=Hi+Priya%2C+your+saree+is+ready+today%21',
      '_blank',
      'noopener'
    );
    fireEvent.click(screen.getByTestId('enquiry-handoff-done'));
    await waitFor(() => expect(screen.queryByTestId('enquiry-handoff-done')).not.toBeInTheDocument());
    openSpy.mockRestore();
  });

  it('closes quietly: no channels sent, dialog closes', async () => {
    enquiriesApi.closeEnquiry.mockResolvedValue({ enquiry: { ...OPEN[0], status: 'CLOSED' }, handoffs: [] });
    renderScreen();
    await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('enquiry-actions-e1-trigger'));
    fireEvent.click(screen.getByTestId('enquiry-close-e1'));
    fireEvent.click(screen.getByTestId('enquiry-close-quiet'));
    expect(screen.queryByTestId('enquiry-close-channels')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enquiry-close-confirm'));
    await waitFor(() =>
      expect(enquiriesApi.closeEnquiry).toHaveBeenCalledWith('e1', { notify: false, channels: [], note: null })
    );
    await waitFor(() => expect(screen.queryByTestId('enquiry-close-confirm')).not.toBeInTheDocument());
  });

  it('defaults to a quiet close when the customer cannot be reached on any channel', async () => {
    enquiriesApi.listEnquiries.mockResolvedValue({
      enquiries: [{ ...OPEN[0], channelReadiness: { WHATSAPP: { ok: false, reason: 'No consent' }, EMAIL: { ok: false, reason: 'No email' }, SMS: { ok: false, reason: 'No consent' } } }],
      counts: COUNTS,
    });
    renderScreen();
    await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('enquiry-actions-e1-trigger'));
    fireEvent.click(screen.getByTestId('enquiry-close-e1'));
    expect(screen.getByTestId('enquiry-close-quiet')).toBeChecked();
    fireEvent.click(screen.getByTestId('enquiry-close-notify'));
    expect(screen.getByText(/WhatsApp needs the customer's phone and WhatsApp consent/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enquiry-close-confirm'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Pick a way/i);
    expect(enquiriesApi.closeEnquiry).not.toHaveBeenCalled();
  });

  it('hides create/close when the user lacks the permissions', async () => {
    authModule.useAuth.mockReturnValue({ permissions: ['enquiries.view'] });
    renderScreen();
    await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeInTheDocument());
    expect(screen.queryByTestId('enquiry-create')).not.toBeInTheDocument();
    expect(screen.queryByTestId('enquiry-close-e1')).not.toBeInTheDocument();
  });

  it('wantedSummary joins only the parts that are set', () => {
    expect(wantedSummary(OPEN[0])).toBe('Saree · Red');
    expect(wantedSummary(CLOSED[0])).toBe('');
  });
});
