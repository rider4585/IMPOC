import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../AppShell';

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
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <div>content</div>
      </AppShell>
    </MemoryRouter>
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
    ['Intake', 'Vendors', 'Print labels', 'POS', 'Sales', 'Rentals', 'Expenses', 'Users', 'Roles', 'Permissions', 'Picklists', 'Dashboard'].forEach(
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
    expect(screen.getByText('Intake')).toBeInTheDocument();
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
    expect(screen.queryByText('Intake')).toBeNull();
    expect(screen.queryByText('Expenses')).toBeNull();
  });

  it('renders a no-access message when the user holds no nav permissions', () => {
    renderShell([]);
    expect(screen.getByText(/don't have access to any screens yet/i)).toBeInTheDocument();
  });
});
