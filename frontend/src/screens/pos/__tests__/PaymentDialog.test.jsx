import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentDialog } from '../PaymentDialog.jsx';
import { LOGO_SRC } from '../../../platform/qrLogo.js';

const UPI_ACCOUNTS = [
  { uuid: 'upi-1', label: 'Shop UPI', vpa: 'shop@okbank', isActive: true },
];

function renderDialog(overrides = {}) {
  const props = {
    open: true,
    step: 'confirm',
    paymentMethod: 'Cash',
    totalPaise: 25000,
    upiAccounts: [],
    selectedUpiAccountUuid: '',
    onSelectUpiAccount: vi.fn(),
    upiUri: null,
    confirming: false,
    onMarkReceived: vi.fn(),
    onCancel: vi.fn(),
    displayCode: 'ABC123',
    displayUrl: 'https://example.test/display/ABC123',
    ...overrides,
  };
  render(<PaymentDialog {...props} />);
  return props;
}

describe('PaymentDialog (R-35)', () => {
  it('Cash: shows the amount and no QR', () => {
    renderDialog({ paymentMethod: 'Cash' });
    expect(screen.getByTestId('payment-amount').textContent).toBe('₹250.00');
    expect(screen.queryByTestId('payment-upi-qr')).not.toBeInTheDocument();
    expect(screen.getByText(/collect the cash payment/i)).toBeInTheDocument();
  });

  it('UPI: shows a QR encoding the upiUri and the amount', () => {
    renderDialog({
      paymentMethod: 'UPI',
      upiAccounts: UPI_ACCOUNTS,
      selectedUpiAccountUuid: 'upi-1',
      upiUri: 'upi://pay?pa=shop%40okbank&pn=Shop&am=250.00&cu=INR&tn=note&tr=ref-1',
    });
    expect(screen.getByTestId('payment-upi-qr')).toBeInTheDocument();
    expect(screen.getByText(/scan to pay/i)).toBeInTheDocument();
    expect(screen.getByText('₹250.00')).toBeInTheDocument();
  });

  it('UPI: the payment QR has a center logo (R-42a), the small display-link QR does not', () => {
    renderDialog({
      paymentMethod: 'UPI',
      upiAccounts: UPI_ACCOUNTS,
      selectedUpiAccountUuid: 'upi-1',
      upiUri: 'upi://pay?pa=shop%40okbank&pn=Shop&am=250.00&cu=INR&tn=note&tr=ref-1',
      displayCode: 'ABC123',
      displayUrl: 'https://example.test/display/ABC123',
    });
    const paymentQr = screen.getByTestId('payment-upi-qr');
    const logo = paymentQr.querySelector('image');
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute('href')).toBe(LOGO_SRC);
    // value is intact — the QR still renders its foreground path data.
    expect(paymentQr.querySelectorAll('path').length).toBeGreaterThan(0);

    // The tiny 56px display-link QR (R-42 boundary: leave it alone) has no logo.
    const displayLinkQr = document.querySelector('svg[width="56"]');
    expect(displayLinkQr).toBeTruthy();
    expect(displayLinkQr.querySelector('image')).not.toBeInTheDocument();
  });

  it('UPI with several active accounts: shows an account selector', () => {
    renderDialog({
      paymentMethod: 'UPI',
      upiAccounts: [
        ...UPI_ACCOUNTS,
        { uuid: 'upi-2', label: 'Counter 2', vpa: 'counter2@okbank', isActive: true },
      ],
      selectedUpiAccountUuid: 'upi-1',
      upiUri: 'upi://pay?pa=shop%40okbank&pn=Shop&am=250.00&cu=INR&tn=note&tr=ref-1',
    });
    expect(screen.getByTestId('payment-upi-account')).toBeInTheDocument();
  });

  it('UPI with no active accounts: shows a hint and disables Mark received', () => {
    renderDialog({ paymentMethod: 'UPI', upiAccounts: [], upiUri: null });
    expect(screen.getByText(/no active upi account configured/i)).toBeInTheDocument();
    expect(screen.getByTestId('payment-mark-received')).toBeDisabled();
  });

  it('calls onMarkReceived when Mark received is clicked', () => {
    const props = renderDialog({ paymentMethod: 'Cash' });
    fireEvent.click(screen.getByTestId('payment-mark-received'));
    expect(props.onMarkReceived).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const props = renderDialog({ paymentMethod: 'Cash' });
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables Mark received and Cancel while confirming', () => {
    renderDialog({ paymentMethod: 'Cash', confirming: true });
    expect(screen.getByTestId('payment-mark-received')).toBeDisabled();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled();
  });

  it('thankyou step: shows a confirmation and no Mark received / Cancel buttons', () => {
    renderDialog({ paymentMethod: 'UPI', step: 'thankyou' });
    expect(screen.getByTestId('payment-thankyou')).toBeInTheDocument();
    expect(screen.getByText(/thank you/i)).toBeInTheDocument();
    expect(screen.queryByTestId('payment-mark-received')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument();
  });

  it('shows the customer display code', () => {
    renderDialog({ paymentMethod: 'Cash', displayCode: 'ZX99KQ' });
    expect(screen.getByText(/ZX99KQ/)).toBeInTheDocument();
  });

  it('renders nothing interactive when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId('payment-amount')).not.toBeInTheDocument();
  });
});
