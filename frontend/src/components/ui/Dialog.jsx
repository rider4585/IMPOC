import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Dialog - shadcn-style base modal primitive (light mode, Tailwind).
 *
 * Props:
 * - open: boolean
 * - onClose: () => void (also fired on backdrop click / Escape)
 * - title: string
 * - children: body content
 * - footer: footer content (optional)
 * Uses framer-motion for open/close transitions and createPortal into document.body.
 */
export const Dialog = ({
  open,
  onClose,
  title,
  children,
  footer,
  className = '',
  fullScreen = false,
  role = 'dialog',
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="relative z-50" role={role} aria-modal="true" aria-label={title}>
          <motion.div
            className="fixed inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={fullScreen ? undefined : onClose}
          />
          <motion.div
            className={
              fullScreen
                ? `fixed inset-0 z-50 flex flex-col bg-[var(--surface-raised)] ${className}`.trim()
                : `fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-6 shadow-lg ${className}`.trim()
            }
            initial={fullScreen ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={fullScreen ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={fullScreen ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {title && (
              <div className={`flex shrink-0 items-center justify-between ${fullScreen ? 'border-b border-[var(--border)] px-6 py-4' : 'mb-4'}`}>
                <h2 className="text-lg font-semibold leading-none tracking-tight">
                  {title}
                </h2>
                {onClose && (
                  <button
                    type="button"
                    className="rounded-sm text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    onClick={onClose}
                    aria-label="Close dialog"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {/*
              -mx-2 px-2: `overflow-y-auto` also clips the X axis, which would
              cut a full-width field's 2px focus ring flush at the body edge
              (the "border overlap" seen in modals). The negative margin + equal
              padding pushes the clip boundary 8px outward while keeping content
              aligned with the title/footer, so focus rings render fully.
            */}
            <div className={fullScreen ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : '-mx-2 min-h-0 flex-1 overflow-y-auto px-2 py-0.5 text-sm text-[var(--ink)]'}>{children}</div>
            {footer && <div className={`flex shrink-0 justify-end gap-2 ${fullScreen ? 'border-t border-[var(--border)] px-6 py-3' : 'mt-4'}`}>{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Dialog;
