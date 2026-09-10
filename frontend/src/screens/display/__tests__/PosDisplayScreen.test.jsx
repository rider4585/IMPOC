import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PosDisplayScreen } from '../PosDisplayScreen.jsx';
import { LOGO_SRC } from '../../../platform/qrLogo.js';

class FakeSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
  }
}

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
    localStorage.clear();
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

  it('AWAITING + UPI: QR renders level=H with a center logo, value intact (R-42a)', async () => {
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];
    const upiUri = 'upi://pay?pa=shop%40okbank&pn=Shop&am=250.00&cu=INR&tn=note&tr=ref-1';

    act(() => {
      source.emit({ status: 'awaiting', method: 'UPI', amountPaise: 25000, upiUri });
    });

    await waitFor(() => expect(screen.getByTestId('display-upi-qr')).toBeInTheDocument());
    const svg = screen.getByTestId('display-upi-qr');
    // qrcode.react only renders an <image> child when imageSettings is passed — its
    // presence (with our LOGO_SRC) is the DOM-level proxy for level="H" + imageSettings.
    const logo = svg.querySelector('image');
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute('href')).toBe(LOGO_SRC);
    // value is intact — the QR still renders its foreground path data.
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('R-42b: awaiting QR has a border wrapper defaulting to pulse, toggle switches + persists to localStorage', async () => {
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];
    act(() => {
      source.emit({ status: 'awaiting', method: 'UPI', amountPaise: 25000, upiUri: 'upi://pay?pa=a%40b' });
    });
    await waitFor(() => expect(screen.getByTestId('display-qr-border')).toBeInTheDocument());

    expect(screen.getByTestId('display-qr-border').className).toContain('qr-border--pulse');
    expect(screen.getByTestId('display-border-toggle')).toHaveTextContent(/pulse/i);

    fireEvent.click(screen.getByTestId('display-border-toggle'));

    expect(screen.getByTestId('display-qr-border').className).toContain('qr-border--marching');
    expect(screen.getByTestId('display-border-toggle')).toHaveTextContent(/marching/i);
    expect(localStorage.getItem('pos-display-border-style')).toBe('marching');
  });

  it('R-42b: a device that previously chose marching starts on marching (persisted)', async () => {
    localStorage.setItem('pos-display-border-style', 'marching');
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];
    act(() => {
      source.emit({ status: 'awaiting', method: 'UPI', amountPaise: 25000, upiUri: 'upi://pay?pa=a%40b' });
    });
    await waitFor(() => expect(screen.getByTestId('display-qr-border')).toBeInTheDocument());
    expect(screen.getByTestId('display-qr-border').className).toContain('qr-border--marching');
  });
});

describe('PosDisplayScreen speech (R-42c, mocked Web Speech API)', () => {
  let utteranceTexts;

  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    localStorage.clear();
    utteranceTexts = [];
    vi.stubGlobal('SpeechSynthesisUtterance', FakeSpeechSynthesisUtterance);
    vi.stubGlobal('speechSynthesis', {
      speak: vi.fn((utterance) => utteranceTexts.push(utterance.text)),
    });
  });

  function unlockSound() {
    fireEvent.click(screen.getByTestId('display-sound-enable'));
    utteranceTexts = []; // drop the silent unlock utterance
  }

  it('speaks the generic thank-you on a live transition into received (no name)', async () => {
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];
    act(() => source.emit({ status: 'awaiting', method: 'Cash', amountPaise: 5000 }));
    await waitFor(() => expect(screen.getByTestId('display-awaiting')).toBeInTheDocument());
    unlockSound();

    act(() => source.emit({ status: 'received', customerFirstName: null }));
    await waitFor(() => expect(screen.getByTestId('display-received')).toBeInTheDocument());

    expect(utteranceTexts).toEqual(['Thank you for shopping with us!']);
  });

  it('speaks with the first name when present', async () => {
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];
    act(() => source.emit({ status: 'awaiting', method: 'Cash', amountPaise: 5000 }));
    await waitFor(() => expect(screen.getByTestId('display-awaiting')).toBeInTheDocument());
    unlockSound();

    act(() => source.emit({ status: 'received', customerFirstName: 'Asha' }));
    await waitFor(() => expect(screen.getByTestId('display-received')).toBeInTheDocument());

    expect(utteranceTexts).toEqual(['Thank you for shopping with us, Asha!']);
  });

  it('does NOT speak when the first SSE message on connect/late-join is already received', async () => {
    renderAt('/display/ABC123');
    unlockSound();
    const source = FakeEventSource.instances[0];

    act(() => source.emit({ status: 'received', customerFirstName: 'Asha' }));
    await waitFor(() => expect(screen.getByTestId('display-received')).toBeInTheDocument());

    expect(utteranceTexts).toEqual([]);
  });

  it('does NOT speak before the sound-enable tap unlocks audio', async () => {
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];
    act(() => source.emit({ status: 'awaiting', method: 'Cash', amountPaise: 5000 }));
    await waitFor(() => expect(screen.getByTestId('display-awaiting')).toBeInTheDocument());

    act(() => source.emit({ status: 'received' }));
    await waitFor(() => expect(screen.getByTestId('display-received')).toBeInTheDocument());

    expect(utteranceTexts).toEqual([]);
  });

  it('does NOT re-speak when a reconnect replays the same received state', async () => {
    renderAt('/display/ABC123');
    const source = FakeEventSource.instances[0];
    act(() => source.emit({ status: 'awaiting', method: 'Cash', amountPaise: 5000 }));
    await waitFor(() => expect(screen.getByTestId('display-awaiting')).toBeInTheDocument());
    unlockSound();

    act(() => source.emit({ status: 'received', customerFirstName: 'Asha' }));
    await waitFor(() => expect(screen.getByTestId('display-received')).toBeInTheDocument());
    expect(utteranceTexts).toEqual(['Thank you for shopping with us, Asha!']);

    // Reconnect: server replays the still-current 'received' state — must not re-speak.
    act(() => source.emit({ status: 'received', customerFirstName: 'Asha' }));
    expect(utteranceTexts).toEqual(['Thank you for shopping with us, Asha!']);
  });

  it('hides the sound-enable button once tapped', async () => {
    renderAt('/display/ABC123');
    expect(screen.getByTestId('display-sound-enable')).toBeInTheDocument();
    unlockSound();
    expect(screen.queryByTestId('display-sound-enable')).not.toBeInTheDocument();
  });
});
