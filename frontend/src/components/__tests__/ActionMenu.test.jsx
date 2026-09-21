import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionMenu } from '../ui/ActionMenu.jsx';

describe('ActionMenu UI component (R-69)', () => {
  it('renders nothing when there are no actions', () => {
    const { container } = render(<ActionMenu primary={null} items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a single standalone button when only primary action is provided (no menu)', () => {
    const onEdit = vi.fn();
    render(
      <ActionMenu
        primary={{ label: 'Edit', onClick: onEdit }}
        items={[]}
      />
    );

    const editBtn = screen.getByRole('button', { name: 'Edit' });
    expect(editBtn).toBeInTheDocument();
    // Overflow trigger should NOT exist
    expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument();

    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders a single standalone button when only 1 item is provided in items (no menu)', () => {
    const onRevoke = vi.fn();
    render(
      <ActionMenu
        items={[{ label: 'Revoke', onClick: onRevoke }]}
      />
    );

    const revokeBtn = screen.getByRole('button', { name: 'Revoke' });
    expect(revokeBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument();

    fireEvent.click(revokeBtn);
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it('renders standalone primary button and overflow menu trigger when multiple actions exist', () => {
    const onEdit = vi.fn();
    const onRoles = vi.fn();
    const onDelete = vi.fn();

    render(
      <ActionMenu
        primary={{ label: 'Edit', onClick: onEdit }}
        items={[
          { label: 'Roles', onClick: onRoles },
          { label: 'Delete', onClick: onDelete, danger: true, divider: true },
        ]}
      />
    );

    // Primary button visible standalone
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();

    // Trigger button visible
    const trigger = screen.getByRole('button', { name: /more actions/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Menu not opened yet
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Click trigger to open menu
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();

    // Roles and Delete options are visible in menu
    const rolesOption = screen.getByRole('menuitem', { name: 'Roles' });
    const deleteOption = screen.getByRole('menuitem', { name: 'Delete' });
    expect(rolesOption).toBeInTheDocument();
    expect(deleteOption).toBeInTheDocument();

    // Check danger class on delete item
    expect(deleteOption.className).toContain('text-red');

    // Check divider
    expect(screen.getByRole('separator')).toBeInTheDocument();

    // Click Roles
    fireEvent.click(rolesOption);
    expect(onRoles).toHaveBeenCalledTimes(1);

    // Menu should close on item click
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes menu when Escape is pressed', () => {
    render(
      <ActionMenu
        primary={{ label: 'Edit', onClick: vi.fn() }}
        items={[{ label: 'Cancel', onClick: vi.fn() }]}
      />
    );

    const trigger = screen.getByRole('button', { name: /more actions/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes menu when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ActionMenu
          primary={{ label: 'Edit', onClick: vi.fn() }}
          items={[{ label: 'Cancel', onClick: vi.fn() }]}
        />
      </div>
    );

    const trigger = screen.getByRole('button', { name: /more actions/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('filters out conditional/falsy items cleanly', () => {
    const canManage = false;
    render(
      <ActionMenu
        primary={{ label: 'Edit', onClick: vi.fn() }}
        items={[
          canManage && { label: 'Admin Only', onClick: vi.fn() },
          null,
          undefined,
        ]}
      />
    );

    // Since items are all falsy, only primary action exists -> no menu trigger
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument();
  });

  it('stops event propagation when clicking buttons to avoid triggering row clicks', () => {
    const onRowClick = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <div onClick={onRowClick} data-testid="table-row">
        <ActionMenu
          primary={{ label: 'Edit', onClick: onEdit }}
          items={[{ label: 'Delete', onClick: onDelete }]}
        />
      </div>
    );

    // Clicking primary button
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();

    // Clicking trigger button
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
    expect(onRowClick).not.toHaveBeenCalled();

    // Clicking menu item
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
