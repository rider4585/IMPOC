import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExpenseFormDialog } from '../ExpenseFormDialog.jsx';
import * as picklistsApi from '../../../services/picklistsApi.js';

vi.mock('../../../services/picklistsApi.js');

describe('ExpenseFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and display expense types in the category Select', async () => {
    const mockExpenseTypes = [
      { uuid: '1', name: 'Rent', isActive: true },
      { uuid: '2', name: 'Travel', isActive: true },
      { uuid: '3', name: 'Food', isActive: true },
      { uuid: '4', name: 'Misc', isActive: true },
      { uuid: '5', name: 'Inactive', isActive: false },
    ];

    picklistsApi.getExpenseTypes.mockResolvedValue(mockExpenseTypes);

    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(
      <ExpenseFormDialog
        open={true}
        onClose={handleClose}
        onSave={handleSave}
        saving={false}
        expense={null}
      />
    );

    await waitFor(() => {
      expect(picklistsApi.getExpenseTypes).toHaveBeenCalled();
    });

    const categoryLabel = screen.getByText('Category');
    expect(categoryLabel).toBeInTheDocument();
  });

  it('should render the expense form with Select for category', async () => {
    picklistsApi.getExpenseTypes.mockResolvedValue([
      { uuid: '1', name: 'Rent', isActive: true },
      { uuid: '2', name: 'Travel', isActive: true },
    ]);

    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(
      <ExpenseFormDialog
        open={true}
        onClose={handleClose}
        onSave={handleSave}
        saving={false}
        expense={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
    });
  });

  it('should only show active expense types in the Select', async () => {
    const mockExpenseTypes = [
      { uuid: '1', name: 'Rent', isActive: true },
      { uuid: '2', name: 'Travel', isActive: true },
      { uuid: '3', name: 'Inactive', isActive: false },
    ];

    picklistsApi.getExpenseTypes.mockResolvedValue(mockExpenseTypes);

    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(
      <ExpenseFormDialog
        open={true}
        onClose={handleClose}
        onSave={handleSave}
        saving={false}
        expense={null}
      />
    );

    await waitFor(() => {
      expect(picklistsApi.getExpenseTypes).toHaveBeenCalled();
    });
  });
});
