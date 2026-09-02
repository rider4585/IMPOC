import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import './Dialog.css';

/**
 * Dialog — base modal primitive (light mode).
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
        <div className="ui-dialog-root" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="ui-dialog-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            className={`ui-dialog ${className}`.trim()}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {title && (
              <div className="ui-dialog__header">
                <h2 className="ui-dialog__title">{title}</h2>
                {onClose && (
                  <button
                    type="button"
                    className="ui-dialog__close"
                    onClick={onClose}
                    aria-label="Close dialog"
                  >
                    &times;
                  </button>
                )}
              </div>
            )}
            <div className="ui-dialog__body">{children}</div>
            {footer && <div className="ui-dialog__footer">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Dialog;
