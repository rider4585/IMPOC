import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ToastProvider } from '../../../components/ui/index.js';
import * as authModule from '../../../auth/useAuth.js';
import * as sessionsApi from '../../../services/sessionsApi.js';
import { SessionsScreen } from '../SessionsScreen.jsx';
import { PERMISSIONS } from '../../../constants/permissions.js';

vi.mock('../../../auth/useAuth.js');
vi.mock('../../../services/sessionsApi.js');

function renderWithToast(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const SAMPLE_DATA = {
  sessions: [
    {
      uuid: 'sess-1',
      user: {
        uuid: 'u-1',
        username: 'alice',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        fullName: 'Alice Smith',
        status: 'ACTIVE',
      },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
      deviceType: 'desktop',
      browser: 'Chrome',
      os: 'macOS',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      revokedAt: null,
      lastUsedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isCurrent: true,
      status: 'ACTIVE',
    },
    {
      uuid: 'sess-2',
      user: {
        uuid: 'u-2',
        username: 'bobjones',
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Jones',
        fullName: 'Bob Jones',
        status: 'ACTIVE',
      },
      ipAddress: '10.0.0.55',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...',
      deviceType: 'mobile',
      browser: 'Safari',
      os: 'iOS',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      revokedAt: null,
      lastUsedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isCurrent: false,
      status: 'ACTIVE',
    },
  ],
  stats: {
    activeSessions: 2,
    uniqueUsersCount: 2,
    deviceBreakdown: {
      desktop: 1,
      mobile: 1,
      tablet: 0,
      unknown: 0,
    },
  },
};

describe('SessionsScreen (R-68)', () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({
      permissions: [PERMISSIONS.USERS.VIEW, PERMISSIONS.USERS.UPDATE],
      currentUser: { uuid: 'u-1', username: 'alice' },
      signOut: mockSignOut,
    });
    sessionsApi.getAdminSessions.mockResolvedValue(SAMPLE_DATA);
    sessionsApi.revokeSession.mockResolvedValue({ success: true, message: 'Session revoked' });
    sessionsApi.revokeUserSessions.mockResolvedValue({ success: true, message: 'All user sessions revoked' });
  });

  it('renders header, top metrics cards, and session list', async () => {
    renderWithToast(<SessionsScreen />);

    expect(screen.getByText('Active Sessions & Devices')).toBeInTheDocument();
    expect(
      screen.getByText('Monitor signed-in accounts, inspect device telemetry, and revoke unauthorized sessions.')
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bobjones')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.55')).toBeInTheDocument();

    // Verify top metrics
    expect(screen.getByTestId('metric-active-sessions').textContent).toBe('2');
    expect(screen.getByTestId('metric-unique-users').textContent).toBe('2');
    expect(screen.getByTestId('metric-device-desktop').textContent).toBe('1');
    expect(screen.getByTestId('metric-device-mobile').textContent).toBe('1');
  });

  it('renders "Current Session" badge for caller current session', async () => {
    renderWithToast(<SessionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Current Session')).toBeInTheDocument();
    });

    expect(screen.getByTestId('current-session-badge')).toBeInTheDocument();
  });

  it('filters sessions using the search input', async () => {
    renderWithToast(<SessionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by user, email, IP, browser, OS...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'bobjones' } });
    });

    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
  });

  it('toggles active only filter', async () => {
    renderWithToast(<SessionsScreen />);

    await waitFor(() => {
      expect(sessionsApi.getAdminSessions).toHaveBeenCalledWith({ activeOnly: true });
    });

    const activeCheckbox = screen.getByRole('checkbox', { name: /active only/i });
    fireEvent.click(activeCheckbox);

    await waitFor(() => {
      expect(sessionsApi.getAdminSessions).toHaveBeenCalledWith({ activeOnly: false });
    });
  });

  it('opens revoke dialog with warning for current session', async () => {
    renderWithToast(<SessionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    // Alice is current session (first row)
    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    fireEvent.click(revokeButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Revoke Session? The user on this device will be signed out immediately.')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/This is your current session\. You will be signed out\./i)
    ).toBeInTheDocument();
  });

  it('revokes a single session when confirmed', async () => {
    renderWithToast(<SessionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    // Bob is second row
    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    fireEvent.click(revokeButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Revoke Session? The user on this device will be signed out immediately.')).toBeInTheDocument();
    });

    // Click confirm in dialog
    const confirmButton = screen.getByRole('button', { name: 'Revoke Session' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(sessionsApi.revokeSession).toHaveBeenCalledWith('sess-2');
    });
  });

  it('revokes all sessions for user when checkbox is checked', async () => {
    renderWithToast(<SessionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    // Bob is second row
    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    fireEvent.click(revokeButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Revoke Session? The user on this device will be signed out immediately.')).toBeInTheDocument();
    });

    // Check "Revoke all sessions for this user"
    const revokeAllCheckbox = screen.getByRole('checkbox', { name: /revoke all sessions for this user/i });
    fireEvent.click(revokeAllCheckbox);

    // Confirm button text updates to "Revoke All Sessions"
    const confirmAllButton = screen.getByRole('button', { name: 'Revoke All Sessions' });
    fireEvent.click(confirmAllButton);

    await waitFor(() => {
      expect(sessionsApi.revokeUserSessions).toHaveBeenCalledWith('u-2');
    });
  });

  it('renders unknown / legacy devices badge when unknown count > 0', async () => {
    sessionsApi.getAdminSessions.mockResolvedValueOnce({
      ...SAMPLE_DATA,
      stats: {
        ...SAMPLE_DATA.stats,
        activeSessions: 5,
        deviceBreakdown: { desktop: 1, mobile: 0, tablet: 0, unknown: 4 },
      },
    });

    renderWithToast(<SessionsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('metric-device-unknown')).toBeInTheDocument();
    });
    expect(screen.getByTestId('metric-device-unknown').textContent).toBe('4');
  });
});

