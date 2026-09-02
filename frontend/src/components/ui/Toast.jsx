import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import './Toast.css';

const ToastContext = createContext(null);

let toastId = 0;

/**
 * ToastProvider — wraps the app and exposes `useToast()`.
 * toast.push({ title?, description?, variant })
 * variant: 'success' | 'error' | 'info' | 'warning' (default 'info')
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    ({ title, description, variant = 'info', duration = 4000 }) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  const api = useRef({
    success: (o) => push({ variant: 'success', ...o }),
    error: (o) => push({ variant: 'error', ...o }),
    info: (o) => push({ variant: 'info', ...o }),
    warning: (o) => push({ variant: 'warning', ...o }),
    push,
    dismiss,
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="ui-toast__viewport" aria-live="polite" role="status">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                className={`ui-toast ui-toast--${toast.variant}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {toast.title && <div className="ui-toast__title">{toast.title}</div>}
                {toast.description && (
                  <div className="ui-toast__desc">{toast.description}</div>
                )}
                <button
                  type="button"
                  className="ui-toast__close"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(toast.id)}
                >
                  &times;
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}

export default ToastProvider;
