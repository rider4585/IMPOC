import React, { useState } from 'react';
import { Dialog, Button, Input } from '../../components/ui';

/**
 * TEMP FEATURE (2026-09-17, interim until R-62 lands): WhatsApp is the only
 * channel offered when closing an enquiry as available. SMTP/SMS providers
 * do not exist yet, so Email and SMS are hidden here FE-side only — the
 * backend still supports them for when R-62 enables them.
 */
export const CHANNELS = [{ key: 'WHATSAPP', label: 'WhatsApp', action: 'Open WhatsApp' }];

/** Display labels for all channels — old closed rows may list Email/SMS. */
export const CHANNEL_LABELS = { WHATSAPP: 'WhatsApp', EMAIL: 'Email', SMS: 'SMS' };

const radioCls =
  'flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] p-3 text-sm ' +
  'has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary)]/5';

const textareaCls =
  'w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2 text-sm ' +
  'text-[var(--ink)] shadow-sm transition-colors placeholder:text-[var(--ink-faint)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ' +
  'focus-visible:border-transparent min-h-[140px] resize-y';

function messageFromHandoffs(handoffs) {
  const wa = handoffs?.find((h) => h.channel === 'WHATSAPP');
  if (!wa) return '';
  try {
    return decodeURIComponent(new URL(wa.url).searchParams.get('text') || '');
  } catch {
    return '';
  }
}

/**
 * CloseEnquiryDialog — two outcomes only (R-63, WhatsApp-only since 2026-09-17):
 *   "It's available — tell the customer" (compose the WhatsApp message, then
 *   send via wa.me) or "Close quietly".
 * After a notify-close the dialog opens a composer: the message is pre-filled
 * from the server-prepared body but fully editable, and "Send" + opens
 * WhatsApp with whatever was typed.
 */
export function CloseEnquiryDialog({ open, onClose, onConfirm, saving, enquiry }) {
  const readiness = enquiry?.channelReadiness || {};
  const reachable = CHANNELS.filter((c) => readiness[c.key]?.ok).map((c) => c.key);

  const [notify, setNotify] = useState(reachable.length > 0);
  const [channels, setChannels] = useState(reachable);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  // Set once the server has closed the enquiry with links to open.
  const [handoffs, setHandoffs] = useState(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const toggleChannel = (key) =>
    setChannels((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (notify && channels.length === 0) {
      setError('Pick a way to tell the customer, or close quietly.');
      return;
    }
    setError('');
    const result = await onConfirm({ notify, channels: notify ? channels : [], note: note.trim() || null });
    if (result && Array.isArray(result.handoffs) && result.handoffs.length > 0) {
      setMessage(messageFromHandoffs(result.handoffs));
      setHandoffs(result.handoffs);
    }
  };

  const sendWhatsApp = () => {
    const wa = handoffs?.find((h) => h.channel === 'WHATSAPP');
    if (!wa) return;
    try {
      const url = new URL(wa.url);
      url.searchParams.set('text', message);
      window.open(url.toString(), '_blank', 'noopener');
      setSent(true);
    } catch {
      window.open(wa.url, '_blank', 'noopener');
      setSent(true);
    }
  };

  if (handoffs) {
    const wa = handoffs.find((h) => h.channel === 'WHATSAPP');
    const waPhone = wa ? (() => {
      try {
        return new URL(wa.url).pathname.replace(/^\/+/, '');
      } catch {
        return '';
      }
    })() : '';
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Write the message"
        footer={
          <>
            <Button variant="outline" onClick={onClose} data-testid="enquiry-handoff-done">
              Done
            </Button>
            <Button onClick={sendWhatsApp} data-testid="enquiry-handoff-send">
              {sent ? 'Send again' : 'Send WhatsApp message'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--ink-muted)]">
            WhatsApp opens with your message pre-filled — send it there to tell{' '}
            <span className="font-medium text-[var(--ink)]">{enquiry?.customer?.name}</span>.
          </p>
          {waPhone && (
            <p className="text-sm font-medium">
              To <span className="font-normal text-[var(--ink-muted)]">+{waPhone}</span>
            </p>
          )}
          <label htmlFor="enquiry-handoff-message" className="block pb-0.5 text-sm font-medium text-[var(--ink)]">
            Message
          </label>
          <textarea
            id="enquiry-handoff-message"
            data-testid="enquiry-handoff-message"
            className={textareaCls}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={5000}
            placeholder="Type the message to send…"
          />
          <p className="text-xs text-[var(--ink-faint)]">
            Sent {sent ? 'again — ' : ''}via WhatsApp ({wa ? 'wa.me' : ''}). The enquiry is already closed.
          </p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Close enquiry"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="close-enquiry-form" loading={saving} data-testid="enquiry-close-confirm">
            {notify ? 'Close & prepare message' : 'Close quietly'}
          </Button>
        </>
      }
    >
      <form id="close-enquiry-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-[var(--ink-muted)]">
          <span className="font-medium text-[var(--ink)]">{enquiry?.customer?.name}</span>
          {' — '}
          {enquiry?.description}
        </p>

        <div className="flex flex-col gap-2" role="radiogroup" aria-label="How to close">
          <label className={radioCls}>
            <input
              type="radio"
              name="close-outcome"
              className="mt-0.5"
              checked={notify}
              onChange={() => setNotify(true)}
              data-testid="enquiry-close-notify"
            />
            <span>
              <span className="block font-medium">It&apos;s available — tell the customer</span>
              <span className="block text-xs text-[var(--ink-muted)]">
                Compose the WhatsApp message, then tap send.
              </span>
            </span>
          </label>

          {notify && (
            <div className="ml-7 flex flex-col gap-1.5" data-testid="enquiry-close-channels">
              {CHANNELS.map((c) => {
                const r = readiness[c.key] || { ok: false, reason: 'Unknown' };
                return (
                  <label key={c.key} className={`flex items-center gap-2 text-sm ${r.ok ? '' : 'text-[var(--ink-faint)]'}`}>
                    <input
                      type="checkbox"
                      disabled={!r.ok}
                      checked={channels.includes(c.key)}
                      onChange={() => toggleChannel(c.key)}
                      aria-label={c.label}
                    />
                    {c.label}
                    {!r.ok && <span className="text-xs">({r.reason})</span>}
                  </label>
                );
              })}
              {reachable.length === 0 && (
                <p className="text-xs text-[var(--danger)]">
                  WhatsApp needs the customer&apos;s phone and WhatsApp consent on their profile — or close quietly.
                </p>
              )}
            </div>
          )}

          <label className={radioCls}>
            <input
              type="radio"
              name="close-outcome"
              className="mt-0.5"
              checked={!notify}
              onChange={() => setNotify(false)}
              data-testid="enquiry-close-quiet"
            />
            <span>
              <span className="block font-medium">Close quietly</span>
              <span className="block text-xs text-[var(--ink-muted)]">Nothing is sent.</span>
            </span>
          </label>
        </div>

        <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={5000} />

        {error && (
          <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
        )}
      </form>
    </Dialog>
  );
}

export default CloseEnquiryDialog;