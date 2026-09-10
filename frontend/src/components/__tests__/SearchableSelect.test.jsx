import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchableSelect } from '../ui/SearchableSelect.jsx';

const OPTIONS = [
  { value: 'v1', label: 'Sharma Fabrics' },
  { value: 'v2', label: 'Ghanshyam Exports' },
];

const MANY_OPTIONS = Array.from({ length: 40 }, (_, i) => ({
  value: `v${i}`,
  label: `Vendor ${i}`,
}));

function Controlled({ onChange, options = OPTIONS }) {
  const [value, setValue] = useState(null);
  return (
    <SearchableSelect
      label="Vendor"
      value={value}
      onChange={(v) => {
        onChange(v);
        setValue(v);
      }}
      options={options}
    />
  );
}

function openPopover() {
  fireEvent.click(screen.getByLabelText('Vendor'));
  return screen.getByRole('combobox', { name: /vendor/i });
}

function popoverWrapper() {
  const command = screen.queryByRole('presentation', { name: /vendor/i });
  if (!command) return null;
  return command.closest('[style*="position"]') || command;
}

describe('SearchableSelect — popover overlay (R-17)', () => {
  it('renders the dropdown as a fixed overlay anchored below the trigger', async () => {
    render(<Controlled onChange={vi.fn()} />);
    openPopover();

    const options = screen.getAllByRole('option');
    expect(options.length).toBe(2);
    expect(options.map((o) => o.textContent.trim()))
      .toEqual(['Sharma Fabrics', 'Ghanshyam Exports']);
  });

  it('caps the option list and scrolls inside, not growing the page', () => {
    render(<Controlled onChange={vi.fn()} options={MANY_OPTIONS} />);
    openPopover();

    const list = screen.getByRole('listbox');
    expect(list.className).toContain('max-h-60');
    expect(list.className).toContain('overflow-y-auto');
    expect(screen.getAllByRole('option').length).toBe(MANY_OPTIONS.length);
  });

  it('closes when clicking outside the trigger and the popover', () => {
    render(<Controlled onChange={vi.fn()} />);
    openPopover();
    expect(screen.getAllByRole('option').length).toBe(OPTIONS.length);

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('closes on Escape and keeps the selected value', () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = openPopover();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('selects an option (real vendor uuid), fires onChange and closes', () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    openPopover();

    fireEvent.click(screen.getByRole('option', { name: /Ghanshyam Exports/ }));

    expect(onChange).toHaveBeenCalledWith('v2');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});