import React, { useState } from 'react';
import { Dialog, Button, Input } from '../../components/ui';

export const CHANNELS = [
  { key: 'WHATSAPP', label: 'WhatsApp', action: 'Open WhatsApp' },
  { key: 'EMAIL', label: 'Email', action: 'Open email' },
  { key: 'SMS', label: 'SMS', action: 'Open SMS' },
];

export const CHANNEL_LABELS = Object.fromEntries(CHANNELS.map((c) => [c.key, c.label]));

const radioCls =
  'flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] p-3 text-sm ' +
  'has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary)]/5';

/**
 * CloseEnquiryDialog — two outcomes only (R-63):
 *   "It's available — tell the customer" (pick channels; the message is
 *   prepared by the server and opened tap-to-send) or "Close quietly".
 * After a notify-close the dialog shows one button per channel link.
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
  const [opened, setOpened] = useState({});

  const toggleChannel = (key) =>
    setChannels((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (notify && channels.length === 0) {
      setError('Pick at least one way to tell the customer, or close quietly.');
      return;
    }
    setError('');
    const result = await onConfirm({ notify, channels: notify ? channels : [], note: note.trim() || null });
    if (result && Array.isArray(result.handoffs) && result.handoffs.length > 0) {
      setHandoffs(result.handoffs);
    }
  };

  const openLink = (h) => {
    window.open(h.url, '_blank', 'noopener');
    setOpened((prev) => ({ ...prev, [h.channel]: true }));
  };

  if (handoffs) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Now send the message"
        footer={
          <Button onClick={onClose} data-testid="enquiry-handoff-done">
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--ink-muted)]">
            The message is ready. Tap each button, press send in the app that opens, then come back.
          </p>
          {handoffs.map((h) => {
            const meta = CHANNELS.find((c) => c.key === h.channel) || { label: h.channel, action: 'Open' };
            return (
              <div key={h.channel} className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3">
                <span className="text-sm font-medium">{meta.label}</span>
                <Button
                  variant={opened[h.channel] ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => openLink(h)}
                  data-testid={`enquiry-handoff-${h.channel}`}
                >
                  {opened[h.channel] ? 'Open again' : meta.action}
                </Button>
              </div>
            );
          })}
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
                We prepare the message; you tap send.
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
                  No way to reach this customer — add a phone/email and consent on their profile, or close quietly.
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
