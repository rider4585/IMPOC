import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { getPosDisplayStreamUrl } from '../../platform/posDisplayStream.js';
import { formatPaise } from '../../platform/money.js';
import { SHOP_NAME } from '../../components/ShopLogo.jsx';

const DEFAULT_STATE = { status: 'idle', method: null, amountPaise: null, upiUri: null };

/**
 * PUBLIC, no-auth page for a customer-facing device (R-35). Subscribes to
 * the POS-display SSE stream and mirrors the cashier's payment step. The
 * backend auto-resets a 'received' state back to 'idle' a few seconds after
 * mark-received, which this page picks up as an ordinary stream event — no
 * client-side timer needed.
 */
function useDisplayState(code) {
  const [state, setState] = useState(DEFAULT_STATE);

  useEffect(() => {
    if (!code) return undefined;

    const source = new EventSource(getPosDisplayStreamUrl(code));

    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data);
        setState({ ...DEFAULT_STATE, ...next });
      } catch {
        // Ignore malformed events (e.g. a stray heartbeat comment line).
      }
    };

    return () => source.close();
  }, [code]);

  return state;
}

function DisplayCodeEntry() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    navigate(`/display/${trimmed}`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--surface-base)] p-6 text-center">
      <h1 className="typography-heading text-[var(--ink)]">{SHOP_NAME}</h1>
      <p className="text-[var(--ink-muted)]">Enter the display code shown at the counter.</p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Display code"
          aria-label="Display code"
          maxLength={12}
          className="h-11 rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-center text-lg tracking-widest text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        />
        <button
          type="submit"
          className="h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Open display
        </button>
      </form>
    </div>
  );
}

function IdleView() {
  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4"
      data-testid="display-idle"
    >
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)]/15 text-[var(--primary)]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V6a2 2 0 012-2h3M15 4h3a2 2 0 012 2v3M21 15v3a2 2 0 01-2 2h-3M9 20H6a2 2 0 01-2-2v-3" />
        </svg>
      </motion.div>
      <h1 className="typography-heading text-[var(--ink)]">{SHOP_NAME}</h1>
      <p className="text-[var(--ink-muted)]">Waiting for the next customer…</p>
    </motion.div>
  );
}

function AwaitingView({ method, amountPaise, upiUri }) {
  const amount = Number(amountPaise) || 0;
  return (
    <motion.div
      key="awaiting"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4"
      data-testid="display-awaiting"
    >
      {method === 'UPI' && upiUri ? (
        <>
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <QRCodeSVG value={upiUri} size={280} data-testid="display-upi-qr" />
          </div>
          <p className="typography-heading text-[var(--ink)]">Scan to pay {formatPaise(amount)}</p>
        </>
      ) : (
        <>
          <p className="typography-money-lg text-[var(--ink)]">{formatPaise(amount)}</p>
          <p className="typography-heading text-[var(--ink)]">Please pay at the counter</p>
        </>
      )}
    </motion.div>
  );
}

function ReceivedView() {
  return (
    <motion.div
      key="received"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4"
      data-testid="display-received"
    >
      <span
        className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--success)]/15 text-[var(--success)]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <h1 className="typography-heading text-[var(--ink)]">Thank you!</h1>
      <p className="text-[var(--ink-muted)]">Payment received.</p>
    </motion.div>
  );
}

function PosDisplayView({ code }) {
  const state = useDisplayState(code);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface-base)] p-6 text-center">
      <AnimatePresence mode="wait">
        {state.status === 'awaiting' && (
          <AwaitingView method={state.method} amountPaise={state.amountPaise} upiUri={state.upiUri} />
        )}
        {state.status === 'received' && <ReceivedView />}
        {state.status !== 'awaiting' && state.status !== 'received' && <IdleView />}
      </AnimatePresence>
    </div>
  );
}

export function PosDisplayScreen() {
  const { code } = useParams();
  if (!code) {
    return <DisplayCodeEntry />;
  }
  return <PosDisplayView code={code} />;
}

export default PosDisplayScreen;
