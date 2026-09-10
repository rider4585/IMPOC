import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PosDisplayScreen } from '../PosDisplayScreen.jsx';

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
    this.closed = false;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  emit(data) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
FakeEventSource.instances = [];

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/display" element={<PosDisplayScreen />} />
        <Route path="/display/:code" element={<PosDisplayScreen />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PosDisplayScreen (R-35, public)', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  it('shows a code-entry form at /display and navigates to /display/:code on submit', async () => {
    renderAt('/display');
    expect(screen.getByLabelText(/display code/i)).toBeInTheDocument();
    expect(FakeEventSource.instances).toHaveLength(0);

    fireEvent.change(screen.getByLabelText(/display code/i), { target: { value: 'xyz999' } });
    fireEvent.click(screen.getByRole('button', { name: /open display/i }));

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    expect(FakeEventSource.instances[0].url).toContain('XYZ999');
  });

  it('renders IDLE by default (no message received yet)', () => {
    renderAt('/display/ABC123');
    expect(screen.getByTestId('display-idle')).toBeInTheDocument();
  });

  it('connects an EventSource to the pos-display stream for the given code', () => {
    renderAt('/display/ABC123');
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toContain('/pos-display/ABC123/stream');
  });

  it('AWAITING + UPI: renders a QR and the amount', async () => {
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emit({
        status: 'awaiting',
        method: 'UPI',
        amountPaise: 25000,
        upiUri: 'upi://pay?pa=shop%40okbank&pn=Shop&am=250.00&cu=INR&tn=note&tr=ref-1',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('display-awaiting')).toBeInTheDocument();
    });
    expect(screen.getByTestId('display-upi-qr')).toBeInTheDocument();
    expect(screen.getByText(/scan to pay/i)).toBeInTheDocument();
    expect(screen.getByText(/₹250\.00/)).toBeInTheDocument();
  });

  it('AWAITING + Cash: renders the amount with no QR', async () => {
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emit({ status: 'awaiting', method: 'Cash', amountPaise: 9900, upiUri: null });
    });

    await waitFor(() => {
      expect(screen.getByTestId('display-awaiting')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('display-upi-qr')).not.toBeInTheDocument();
    expect(screen.getByText(/please pay at the counter/i)).toBeInTheDocument();
    expect(screen.getByText(/₹99\.00/)).toBeInTheDocument();
  });

  it('RECEIVED: renders a thank-you confirmation with no QR', async () => {
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];

    act(() => {
      source.emit({ status: 'awaiting', method: 'UPI', amountPaise: 25000, upiUri: 'upi://pay?pa=a%40b' });
    });
    await waitFor(() => expect(screen.getByTestId('display-awaiting')).toBeInTheDocument());

    act(() => {
      source.emit({ status: 'received' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('display-received')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('display-upi-qr')).not.toBeInTheDocument();
    expect(screen.getByText(/thank you/i)).toBeInTheDocument();
  });

  it('returns to IDLE when the server resets the state (auto-reset)', async () => {
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];

    act(() => source.emit({ status: 'received' }));
    await waitFor(() => expect(screen.getByTestId('display-received')).toBeInTheDocument());

    act(() => source.emit({ status: 'idle', method: null, amountPaise: null, upiUri: null }));
    await waitFor(() => expect(screen.getByTestId('display-idle')).toBeInTheDocument());
  });

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];
    expect(source.closed).toBe(false);
    unmount();
    expect(source.closed).toBe(true);
  });
});
