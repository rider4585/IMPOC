import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../components/ui/index.js';
import * as authModule from '../../../auth/useAuth.js';
import * as usersApi from '../../../services/usersApi.js';
import * as rolesApi from '../../../services/rolesApi.js';
import { UsersScreen } from '../UsersScreen.jsx';
import { PERMISSIONS } from '../../../constants/permissions.js';

vi.mock('../../../auth/useAuth.js');
vi.mock('../../../services/usersApi.js');
vi.mock('../../../services/rolesApi.js');

function renderWithToast(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const SAMPLE_ROLES = [
  { uuid: 'role-1', name: 'ADMIN', description: 'Full system access', isPrivileged: true },
  { uuid: 'role-2', name: 'CASHIER', description: 'Counter POS access', isPrivileged: false },
];

const SAMPLE_USERS = [
  {
    uuid: 'user-1',
    username: 'adminuser',
    firstName: 'Admin',
    lastName: 'Super',
    email: 'admin@example.com',
    phone: '9876543210',
    status: 'active',
    lastLoginAt: new Date().toISOString(),
    roles: [{ uuid: 'role-1', name: 'ADMIN', isPrivileged: true }],
  },
  {
    uuid: 'user-2',
    username: 'cashier1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '9876543211',
    status: 'active',
    lastLoginAt: null,
    roles: [{ uuid: 'role-2', name: 'CASHIER', isPrivileged: false }],
  },
  {
    uuid: 'user-3',
    username: 'noroleuser',
    firstName: 'No',
    lastName: 'Role',
    email: 'norole@example.com',
    phone: null,
    status: 'inactive',
    lastLoginAt: null,
    roles: [],
  },
];

describe('UsersScreen - Role column', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({
      permissions: [
        PERMISSIONS.USERS.VIEW,
        PERMISSIONS.USERS.CREATE,
        PERMISSIONS.USERS.UPDATE,
        PERMISSIONS.USERS.DELETE,
      ],
      currentUser: { uuid: 'user-1', username: 'adminuser' },
    });
    usersApi.getUsers.mockResolvedValue(SAMPLE_USERS);
    rolesApi.getRoles.mockResolvedValue(SAMPLE_ROLES);
    usersApi.getUserRoles.mockResolvedValue([{ uuid: 'role-1', name: 'ADMIN' }]);
  });

  it('renders "Role" column header and user role badges', async () => {
    renderWithToast(<UsersScreen />);

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('adminuser')).toBeInTheDocument();
    });

    // Check that role badges are rendered
    const adminRolesContainer = screen.getByTestId('user-roles-user-1');
    expect(adminRolesContainer).toHaveTextContent('ADMIN');

    const cashierRolesContainer = screen.getByTestId('user-roles-user-2');
    expect(cashierRolesContainer).toHaveTextContent('CASHIER');

    // User without roles renders em dash
    expect(screen.getByText('noroleuser')).toBeInTheDocument();
  });

  it('filters users using search bar matching role name', async () => {
    renderWithToast(<UsersScreen />);

    await waitFor(() => {
      expect(screen.getByText('adminuser')).toBeInTheDocument();
      expect(screen.getByText('cashier1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name, username, role, email…');
    fireEvent.change(searchInput, { target: { value: 'cashier' } });

    expect(screen.getByText('cashier1')).toBeInTheDocument();
    expect(screen.queryByText('adminuser')).not.toBeInTheDocument();
    expect(screen.queryByText('noroleuser')).not.toBeInTheDocument();
  });

  it('opens roles management dialog for user via action menu', async () => {
    renderWithToast(<UsersScreen />);

    await waitFor(() => {
      expect(screen.getByText('adminuser')).toBeInTheDocument();
    });

    // Primary action button is Edit
    expect(screen.getByTestId('user-edit-user-1')).toBeInTheDocument();

    // Trigger overflow menu for user-1
    const triggerBtn = screen.getByTestId('user-actions-user-1-trigger');
    fireEvent.click(triggerBtn);

    // Click Roles in the opened popover menu
    const rolesOption = screen.getByTestId('user-roles-btn-user-1');
    fireEvent.click(rolesOption);

    await waitFor(() => {
      expect(screen.getByText('Roles — adminuser')).toBeInTheDocument();
    });
  });

  it('filters users using role picklist dropdown', async () => {
    renderWithToast(<UsersScreen />);

    await waitFor(() => {
      expect(screen.getByText('adminuser')).toBeInTheDocument();
      expect(screen.getByText('cashier1')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    const roleSelect = selects.find((s) =>
      Array.from(s.options).some((opt) => opt.value === 'ADMIN')
    );
    expect(roleSelect).toBeDefined();

    fireEvent.change(roleSelect, { target: { value: 'ADMIN' } });

    expect(screen.getByText('adminuser')).toBeInTheDocument();
    expect(screen.queryByText('cashier1')).not.toBeInTheDocument();
    expect(screen.queryByText('noroleuser')).not.toBeInTheDocument();
  });
});

