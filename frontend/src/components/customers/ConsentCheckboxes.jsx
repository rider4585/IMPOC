import React from 'react';

/**
 * Consent toggle checkboxes shared by the customer form and inline-create picker.
 * value is the four consent booleans; onChange receives the full updated set.
 */
const CHANNELS = [
  { key: 'consentWhatsapp', label: 'WhatsApp receipts' },
  { key: 'consentEmail', label: 'Email receipts' },
  { key: 'consentSms', label: 'SMS receipts' },
  { key: 'consentWhatsappGroup', label: 'WhatsApp offers group' },
];

export function ConsentCheckboxes({ value = {}, onChange }) {
  const toggle = (key) => (e) => {
    onChange({ ...value, [key]: e.target.checked });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-[var(--ink)]">Marketing & receipt consent</p>
      <label className="text-xs text-[var(--ink-muted)]">Used only for sending receipts and offers.</label>
      {CHANNELS.map(({ key, label }) => (
        <label
          key={key}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            checked={Boolean(value[key])}
            onChange={toggle(key)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export default ConsentCheckboxes;