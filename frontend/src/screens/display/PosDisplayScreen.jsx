import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DigitalPet from '../../components/DigitalPet.jsx';
import { QRCodeSVG } from 'qrcode.react';
import { getPosDisplayStreamUrl } from '../../platform/posDisplayStream.js';
import { formatPaise } from '../../platform/money.js';
import { useBranding } from '../../theme/BrandingProvider.jsx';
import { qrLogoSettings } from '../../platform/qrLogo.js';
import { BORDER_STYLES, getBorderStyle, setBorderStyle } from '../../platform/displayBorderStyle.js';

const DEFAULT_STATE = { status: 'idle', method: null, amountPaise: null, upiUri: null, customerFirstName: null, reviewUrl: null };

/**
 * Speaks the R-42c thank-you line via the Web Speech API. No-ops (silently)
 * when speech synthesis isn't available in this browser.
 */
function speakThankYou(firstName) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return;

  const text = firstName
    ? `Thank you for shopping with us, ${firstName}!`
    : 'Thank you for shopping with us!';

  try {
    synth.speak(new window.SpeechSynthesisUtterance(text));
  } catch {
    // Speech unavailable/blocked — degrade silently.
  }
}

/**
 * Speaks the thank-you line on a LIVE non-received -> received transition
 * only. `messageCount` (real SSE messages received, from useDisplayState) is
 * what "first message" is judged against — NOT this effect's own run count,
 * which would otherwise also fire (and wrongly burn the "first message" flag)
 * on mount / on a soundUnlocked change, before any SSE message has arrived.
 * Guards against: the first SSE message already being 'received' (a
 * late-join / page-reload joining mid-confirmation), a reconnect replaying
 * the current state, and speaking before the user has unlocked audio.
 */
function useSpeakOnReceived(status, customerFirstName, soundUnlocked, messageCount) {
  const prevStatusRef = useRef(null);
  const lastProcessedCountRef = useRef(0);

  useEffect(() => {
    if (messageCount === 0 || messageCount === lastProcessedCountRef.current) return;

    const isFirstMessage = lastProcessedCountRef.current === 0;
    const prevStatus = prevStatusRef.current;
    lastProcessedCountRef.current = messageCount;
    prevStatusRef.current = status;

    if (!soundUnlocked || isFirstMessage) return;
    if (status !== 'received' || prevStatus === 'received') return;

    speakThankYou(customerFirstName);
  }, [status, customerFirstName, soundUnlocked, messageCount]);
}

/**
 * PUBLIC, no-auth page for a customer-facing device (R-35). Subscribes to
 * the POS-display SSE stream and mirrors the cashier's payment step. The
 * backend auto-resets a 'received' state back to 'idle' a few seconds after
 * mark-received, which this page picks up as an ordinary stream event — no
 * client-side timer needed.
 */
function useDisplayState(code) {
  const [state, setState] = useState(DEFAULT_STATE);
  // Counts real SSE messages (as opposed to the initial DEFAULT_STATE render) —
  // R-42c's speak-dedupe needs to tell "no message yet" apart from "an actual
  // idle/awaiting message happened to arrive first".
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    if (!code) return undefined;

    const source = new EventSource(getPosDisplayStreamUrl(code));

    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data);
        setState({ ...DEFAULT_STATE, ...next });
        setMessageCount((n) => n + 1);
      } catch {
        // Ignore malformed events (e.g. a stray heartbeat comment line).
      }
    };

    return () => source.close();
  }, [code]);

  return { state, messageCount };
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

  const { shopName } = useBranding();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[var(--surface-base)] p-6 text-center">
      <h1 className="typography-heading text-[var(--ink)]">{shopName}</h1>
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
  const { shopName } = useBranding();
  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4"
      data-testid="display-idle"
    >
      {/* R-53: the shop mascot cycles through random animations while nobody is paying */}
      <div className="flex w-full items-end justify-center" aria-hidden="true">
        <DigitalPet scale={2} />
      </div>
      <h1 className="typography-heading text-[var(--ink)]">{shopName}</h1>
    </motion.div>
  );
}

function AwaitingView({ method, amountPaise, upiUri, borderStyle }) {
  const { logoDataUrl } = useBranding();
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
          <div className={`qr-border qr-border--${borderStyle}`} data-testid="display-qr-border">
            <div className="rounded-xl bg-white p-6 shadow-lg">
              <QRCodeSVG
                value={upiUri}
                size={280}
                level="H"
                imageSettings={qrLogoSettings(280, logoDataUrl)}
                data-testid="display-upi-qr"
              />
            </div>
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

function ReceivedView({ customerFirstName, reviewUrl }) {
  const { logoDataUrl } = useBranding();
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
      <h1 className="typography-heading text-[var(--ink)]">
        {customerFirstName ? `Thank you, ${customerFirstName}!` : 'Thank you!'}
      </h1>
      <p className="text-[var(--ink-muted)]">Payment received.</p>
      {reviewUrl && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-4 flex flex-col items-center gap-3"
          data-testid="display-review"
        >
          <div className="rounded-2xl bg-white p-4 shadow-lg">
            <QRCodeSVG value={reviewUrl} size={200} level="H" imageSettings={qrLogoSettings(200, logoDataUrl)} />
          </div>
          <p className="max-w-[26rem] text-lg font-semibold text-[var(--ink)]">Loved it? Scan to leave us a Google review</p>
          <p className="text-sm text-[var(--ink-muted)]">Your words help other shoppers find us.</p>
        </motion.div>
      )}
    </motion.div>
  );
}

const BORDER_STYLE_LABEL = { pulse: 'Pulse', marching: 'Marching' };

/** Small, unobtrusive top-left toggle between the two awaiting-QR border styles (R-42b). */
function BorderStyleToggle({ borderStyle, onCycle }) {
  return (
    <button
      type="button"
      onClick={onCycle}
      data-testid="display-border-toggle"
      className="fixed left-3 top-3 rounded-full border border-[var(--border)] bg-[var(--surface-raised)]/70 px-3 py-1 text-xs text-[var(--ink-muted)] opacity-40 transition-opacity hover:opacity-100 focus-visible:opacity-100"
      title="Change QR border animation"
    >
      Border: {BORDER_STYLE_LABEL[borderStyle] || borderStyle}
    </button>
  );
}

/** One-time top-right "Tap to enable sound" affordance (R-42c) — browsers block speech before a user gesture. */
function SoundUnlockButton({ onUnlock }) {
  return (
    <button
      type="button"
      onClick={onUnlock}
      data-testid="display-sound-enable"
      className="fixed right-3 top-3 rounded-full border border-[var(--border)] bg-[var(--surface-raised)]/70 px-3 py-1 text-xs text-[var(--ink-muted)] opacity-40 transition-opacity hover:opacity-100 focus-visible:opacity-100"
      title="Enable sound"
    >
      🔈 Tap to enable sound
    </button>
  );
}

function PosDisplayView({ code }) {
  const { state, messageCount } = useDisplayState(code);
  const [borderStyle, setBorderStyleState] = useState(() => getBorderStyle());
  const [soundUnlocked, setSoundUnlocked] = useState(false);

  useSpeakOnReceived(state.status, state.customerFirstName, soundUnlocked, messageCount);

  const cycleBorderStyle = useCallback(() => {
    setBorderStyleState((current) => {
      const next = BORDER_STYLES[(BORDER_STYLES.indexOf(current) + 1) % BORDER_STYLES.length];
      setBorderStyle(next);
      return next;
    });
  }, []);

  const unlockSound = useCallback(() => {
    // Speaking a (near-)empty utterance synchronously inside the click handler
    // satisfies the browser's user-gesture requirement for the rest of the session.
    if (typeof window !== 'undefined' && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function') {
      try {
        window.speechSynthesis.speak(new window.SpeechSynthesisUtterance(' '));
      } catch {
        // Speech unavailable — still mark unlocked so we stop showing the button.
      }
    }
    setSoundUnlocked(true);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--surface-base)] p-6 text-center">
      {state.status === 'awaiting' && <BorderStyleToggle borderStyle={borderStyle} onCycle={cycleBorderStyle} />}
      {!soundUnlocked && <SoundUnlockButton onUnlock={unlockSound} />}
      <AnimatePresence mode="wait">
        {state.status === 'awaiting' && (
          <AwaitingView
            method={state.method}
            amountPaise={state.amountPaise}
            upiUri={state.upiUri}
            borderStyle={borderStyle}
          />
        )}
        {state.status === 'received' && <ReceivedView customerFirstName={state.customerFirstName} reviewUrl={state.reviewUrl} />}
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
