import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { NetworkAccessModal } from '../NetworkAccessModal.jsx';
import * as systemApi from '../../services/systemApi.js';
import { ToastProvider } from '../ui/Toast.jsx';

const mockNetworkDataSingle = {
  port: 3000,
  primaryUrl: 'http://192.168.1.50:3000',
  interfaces: [
    {
      name: 'en0',
      address: '192.168.1.50',
      family: 'IPv4',
      mac: 'aa:bb:cc:dd:ee:ff',
      cidr: '192.168.1.50/24',
      url: 'http://192.168.1.50:3000',
      isDefault: true,
    },
  ],
};

const mockNetworkDataMultiple = {
  port: 3000,
  primaryUrl: 'http://192.168.1.50:3000',
  interfaces: [
    {
      name: 'en0',
      address: '192.168.1.50',
      family: 'IPv4',
      mac: 'aa:bb:cc:dd:ee:ff',
      cidr: '192.168.1.50/24',
      url: 'http://192.168.1.50:3000',
      isDefault: true,
    },
    {
      name: 'en1',
      address: '10.0.0.12',
      family: 'IPv4',
      mac: '11:22:33:44:55:66',
      cidr: '10.0.0.12/24',
      url: 'http://10.0.0.12:3000',
      isDefault: false,
    },
  ],
};

function renderModal(props = {}) {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };
  return render(
    <ToastProvider>
      <NetworkAccessModal {...defaultProps} {...props} />
    </ToastProvider>
  );
}

describe('NetworkAccessModal (Ticket R-67)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render dialog content when open is false', () => {
    renderModal({ open: false });
    expect(screen.queryByText('Wi-Fi & LAN Access')).toBeNull();
  });

  it('fetches network info and displays header, status badge, QR code, and instructions on open', async () => {
    vi.spyOn(systemApi, 'getNetworkInfo').mockResolvedValue(mockNetworkDataSingle);

    renderModal({ open: true });

    expect(systemApi.getNetworkInfo).toHaveBeenCalledTimes(1);

    // Wait for content to render
    await waitFor(() => {
      expect(screen.getByText('Wi-Fi & LAN Access')).toBeInTheDocument();
    });

    expect(screen.getByText(/Connect mobile devices or tablets over Wi-Fi/i)).toBeInTheDocument();
    expect(screen.getByText('Ready for connections')).toBeInTheDocument();

    // QR code display
    expect(screen.getByTestId('wifi-qr-code')).toBeInTheDocument();

    // URL box
    const urlDisplay = screen.getByTestId('network-url-display');
    expect(urlDisplay).toHaveTextContent('http://192.168.1.50:3000');

    // Instructions
    expect(screen.getByText(/Connect your phone or tablet to the same Wi-Fi network/i)).toBeInTheDocument();
    expect(screen.getByText(/Scan the QR code with your camera/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign in to IMPOC/i)).toBeInTheDocument();
  });

  it('calls getNetworkInfo again when the refresh button is clicked', async () => {
    const spy = vi.spyOn(systemApi, 'getNetworkInfo').mockResolvedValue(mockNetworkDataSingle);

    renderModal({ open: true });

    await waitFor(() => {
      expect(screen.getByText('http://192.168.1.50:3000')).toBeInTheDocument();
    });

    expect(spy).toHaveBeenCalledTimes(1);

    const refreshBtn = screen.getByRole('button', { name: /Refresh network IP/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  it('copies the URL to clipboard and triggers feedback when Copy URL button is clicked', async () => {
    vi.spyOn(systemApi, 'getNetworkInfo').mockResolvedValue(mockNetworkDataSingle);

    renderModal({ open: true });

    await waitFor(() => {
      expect(screen.getByTestId('copy-url-btn')).toBeInTheDocument();
    });

    const copyBtn = screen.getByTestId('copy-url-btn');
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://192.168.1.50:3000');

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    // Toast confirmation
    await waitFor(() => {
      expect(screen.getByText('Link copied to clipboard!')).toBeInTheDocument();
    });
  });

  it('renders interface selector when multiple network interfaces exist and switches URL/QR', async () => {
    vi.spyOn(systemApi, 'getNetworkInfo').mockResolvedValue(mockNetworkDataMultiple);

    renderModal({ open: true });

    await waitFor(() => {
      expect(screen.getByTestId('network-interface-select')).toBeInTheDocument();
    });

    const select = screen.getByTestId('network-interface-select');
    expect(select).toHaveValue('http://192.168.1.50:3000');
    expect(screen.getByTestId('network-url-display')).toHaveTextContent('http://192.168.1.50:3000');

    // Switch to second interface
    fireEvent.change(select, { target: { value: 'http://10.0.0.12:3000' } });

    expect(select).toHaveValue('http://10.0.0.12:3000');
    expect(screen.getByTestId('network-url-display')).toHaveTextContent('http://10.0.0.12:3000');
  });

  it('falls back gracefully when network fetch fails', async () => {
    vi.spyOn(systemApi, 'getNetworkInfo').mockRejectedValue(new Error('Network error'));

    renderModal({ open: true });

    await waitFor(() => {
      expect(screen.getByText('Wi-Fi & LAN Access')).toBeInTheDocument();
    });

    expect(screen.getByText('Ready for connections')).toBeInTheDocument();
  });
});
