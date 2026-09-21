import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);

let toastId = 0;

const variantStyles = {
  success: 'border-l-[var(--status-in-stock)]',
  error: 'border-l-[var(--danger)]',
  info: 'border-l-[var(--status-rented)]',
  warning: 'border-l-[var(--waking)]',
};

/**
 * ToastProvider - wraps the app and exposes `useToast()`.
 * toast.push({ title?, description?, variant })
 * variant: 'success' | 'error' | 'info' | 'warning' (default 'info')
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

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

  const api = useMemo(
    () => ({
      success: (o) => push({ variant: 'success', ...o }),
      error: (o) => push({ variant: 'error', ...o }),
      info: (o) => push({ variant: 'info', ...o }),
      warning: (o) => push({ variant: 'warning', ...o }),
      push,
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex w-auto flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm" aria-live="polite" role="status">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                className={`pointer-events-auto flex items-start gap-3 rounded-md border border-[var(--border)] border-l-4 bg-[var(--surface-raised)] p-3 shadow-lg sm:p-4 ${variantStyles[toast.variant] || variantStyles.info}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <div className="flex-1">
                  {toast.title && (
                    <div className="text-sm font-semibold text-[var(--ink)]">{toast.title}</div>
                  )}
                  {toast.description && (
                    <div className="mt-0.5 text-sm text-[var(--ink-muted)]">{toast.description}</div>
                  )}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(toast.id)}
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
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

/**
 * Like useToast but returns a no-op API outside a ToastProvider — for chrome
 * that is always mounted (e.g. the theme drawer) and rendered in isolation by tests.
 */
const NOOP_TOAST = Object.freeze({ success() {}, error() {}, info() {}, warning() {} });
export function useOptionalToast() {
  return useContext(ToastContext) || NOOP_TOAST;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}

export default ToastProvider;
