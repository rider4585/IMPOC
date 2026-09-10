import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { ThemeProvider } from '../../theme/index.js';

// Provide a real permission set for a role-gated view of the grouped nav.
const FULL_ADMIN = [
  'inventory.view',
  'inventory.barcode_generate',
  'sales.create',
  'sales.view',
  'rentals.view',
  'expenses.view',
  'reports.view',
  'users.view',
  'roles.view',
  'picklists.view',
];

const INVENTORY_MANAGER = [
  'inventory.view',
  'inventory.barcode_generate',
  'sales.create',
  'sales.view',
  'rentals.view',
  'expenses.view',
  'reports.view',
];

const CASHIER = ['sales.create', 'sales.view'];

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    permissions: window.__mockPermissions,
    signOut: vi.fn(),
  }),
}));

function renderShell(perms, path = '/') {
  window.__mockPermissions = perms;
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('AppShell — grouped, role-gated navigation chrome', () => {
  beforeEach(() => {
    // Force desktop (left rail) so the grouped sections are visible.
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
    // Collapse state persists in localStorage; clear it so tests start expanded.
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('renders labelled grouped sections for a full-access admin', () => {
    renderShell(FULL_ADMIN);
    expect(screen.getAllByText('Inventory').length).toBeGreaterThan(0);
    expect(screen.getByText('POS / Counter')).toBeInTheDocument();
    expect(screen.getAllByText('Rentals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expenses').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
  });

  it('shows every permitted item (absent-not-disabled) for a full-access admin', () => {
    renderShell(FULL_ADMIN);
    ['Trips', 'Vendors', 'Print labels', 'POS', 'Sales', 'Rentals', 'Expenses', 'Users', 'Roles', 'Permissions', 'Picklists', 'Dashboard'].forEach(
      (label) => {
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      }
    );
    // Nothing is rendered as a disabled control.
    expect(screen.queryByText(/disabled/i)).toBeNull();
  });

  it('hides the Admin section for an inventory manager (no users/roles/picklists view)', () => {
    renderShell(INVENTORY_MANAGER);
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Trips')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.queryByText('Users')).toBeNull();
    expect(screen.queryByText('Roles')).toBeNull();
  });

  it('hides Print labels + admin for a CASHIER (no inventory.barcode_generate)', () => {
    renderShell(CASHIER);
    expect(screen.getByText('POS / Counter')).toBeInTheDocument();
    expect(screen.getByText('POS')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    // Not present (absent, never disabled):
    expect(screen.queryByText('Print labels')).toBeNull();
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.queryByText('Users')).toBeNull();
    expect(screen.queryByText('Trips')).toBeNull();
    expect(screen.queryByText('Expenses')).toBeNull();
  });

  it('collapses and re-expands a nav section when its header is clicked', () => {
    renderShell(FULL_ADMIN);
    expect(screen.getByText('Trips')).toBeInTheDocument();

    const header = screen.getByRole('button', { name: /Inventory/i });
    expect(header).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Trips')).toBeNull();

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Trips')).toBeInTheDocument();
  });

  it('renders a no-access message when the user holds no nav permissions', () => {
    renderShell([]);
    expect(screen.getByText(/don't have access to any screens yet/i)).toBeInTheDocument();
  });
});
