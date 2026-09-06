import { describe, it, expect, afterEach, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Dialog } from '../ui/Dialog.jsx';

function ControlledDialog({ onClose, children, footer, title }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onClose={(e) => {
        onClose?.(e);
        setOpen(false);
      }}
      title={title}
      footer={footer}
    >
      {children}
    </Dialog>
  );
}

function dialogPanel() {
  return screen.getByRole('dialog').querySelector('.max-h-\\[85vh\\]');
}

describe('Dialog — capped height with scrollable body (R-17)', () => {
  afterEach(() => cleanup());

  it('renders the panel as a capped-height flex column with pinned header/footer and scrollable body', () => {
    render(
      <ControlledDialog title="Tall dialog" footer={<button>Save</button>}>
        <div data-testid="body">Body content</div>
      </ControlledDialog>
    );

    const p = dialogPanel();
    expect(p).not.toBeNull();
    expect(p.className).toContain('flex-col');
    expect(p.className).toContain('max-h-[85vh]');

    const header = p.querySelector('h2').closest('div');
    expect(header.className).toContain('shrink-0');

    const bodyEl = p.querySelector('[data-testid="body"]').parentElement;
    expect(bodyEl.className).toContain('overflow-y-auto');

    const footerRow = screen.getByRole('button', { name: 'Save' }).parentElement;
    if (footerRow) expect(footerRow.className).toContain('shrink-0');
  });

  it('keeps the Escape and backdrop click handlers working', () => {
    const onClose = vi.fn();
    const { unmount } = render(<ControlledDialog onClose={onClose}>Body</ControlledDialog>);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    const onClose2 = vi.fn();
    render(<ControlledDialog onClose={onClose2}>Body</ControlledDialog>);
    fireEvent.click(screen.getByRole('dialog').firstElementChild);
    expect(onClose2).toHaveBeenCalledTimes(1);
  });
});