import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataGrid } from '../ui/DataGrid.jsx';

describe('DataGrid UI component (R-70 mobile accessibility)', () => {
  const sampleColumns = [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 150,
      enableSorting: true,
      filter: { type: 'text' },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      size: 120,
      enableSorting: true,
    },
  ];

  const sampleData = [
    { id: '1', name: 'Alice', role: 'Admin' },
    { id: '2', name: 'Bob', role: 'Staff' },
    { id: '3', name: 'Charlie', role: 'Cashier' },
    { id: '4', name: 'David', role: 'Staff' },
    { id: '5', name: 'Eve', role: 'Admin' },
  ];

  it('renders table headers and rows correctly', () => {
    render(<DataGrid data={sampleData} columns={sampleColumns} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Eve')).toBeInTheDocument();
  });

  it('includes mobile-friendly min-height and touch momentum scroll on container elements', () => {
    const { container } = render(
      <DataGrid data={sampleData} columns={sampleColumns} className="test-grid" />
    );

    const root = container.querySelector('.datagrid-root');
    expect(root).toBeInTheDocument();
    expect(root.className).toContain('max-md:min-h-[360px]');
    expect(root.className).toContain('max-md:min-h-[45vh]');

    const wrapper = container.querySelector('.datagrid-wrapper');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.className).toContain('max-md:min-h-[360px]');
    expect(wrapper.className).toContain('max-md:min-h-[45vh]');

    const scrollContainer = container.querySelector('.datagrid-scroll-container');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer.className).toContain('overflow-auto');
    expect(scrollContainer.className).toContain('max-md:min-h-[360px]');
    expect(scrollContainer.className).toContain('max-md:min-h-[45vh]');
    expect(scrollContainer.className).toContain('overscroll-contain');
    expect(scrollContainer.style.webkitOverflowScrolling).toBe('touch');
  });

  it('renders loading state when isLoading is true', () => {
    render(<DataGrid data={[]} columns={sampleColumns} isLoading={true} loadingMessage="Fetching items…" />);
    expect(screen.getByText('Fetching items…')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<DataGrid data={[]} columns={sampleColumns} emptyMessage="No records found." />);
    expect(screen.getByText('No records found.')).toBeInTheDocument();
  });

  it('calls onRowClick when a row is clicked', () => {
    const handleRowClick = vi.fn();
    render(<DataGrid data={sampleData} columns={sampleColumns} onRowClick={handleRowClick} />);

    const rowCell = screen.getByText('Alice');
    fireEvent.click(rowCell.closest('tr'));

    expect(handleRowClick).toHaveBeenCalledTimes(1);
    expect(handleRowClick).toHaveBeenCalledWith(sampleData[0]);
  });

  it('handles column sorting toggle', () => {
    render(<DataGrid data={sampleData} columns={sampleColumns} />);

    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);

    // Clicking header sorts column
    const rows = screen.getAllByRole('row');
    // First data row should be Alice
    expect(rows[1]).toHaveTextContent('Alice');
  });
});
