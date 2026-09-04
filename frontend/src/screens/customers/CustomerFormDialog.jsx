import React, { useState } from 'react';
import { Dialog, Button, Input, Card, CardContent } from '../../components/ui';
import { ConsentCheckboxes } from '../../components/customers/ConsentCheckboxes.jsx';

/**
 * CustomerFormDialog — create/edit a customer (contact + consent).
 * customer shape: {uuid, name, phone, email, dob, address, notes,
 *  consentWhatsapp, consentEmail, consentSms, consentWhatsappGroup}
 */
export function CustomerFormDialog({ open, onClose, onSave, saving, customer }) {
  const isEdit = Boolean(customer);
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    dob: customer?.dob || '',
    address: customer?.address || '',
    notes: customer?.notes || '',
    consentWhatsapp: Boolean(customer?.consentWhatsapp),
    consentEmail: Boolean(customer?.consentEmail),
    consentSms: Boolean(customer?.consentSms),
    consentWhatsappGroup: Boolean(customer?.consentWhatsappGroup),
  });
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setConsents = (consents) => setForm((f) => ({ ...f, ...consents }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Customer name is required.');
      return;
    }
    onSave({
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      dob: form.dob || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      consentWhatsapp: form.consentWhatsapp,
      consentEmail: form.consentEmail,
      consentSms: form.consentSms,
      consentWhatsappGroup: form.consentWhatsappGroup,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit customer' : 'Create customer'}
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Create customer'}
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id="customer-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Name" name="name" value={form.name} onChange={set('name')} required />
              <Input label="Phone" name="phone" value={form.phone} onChange={set('phone')} />
              <Input label="Email" type="email" name="email" value={form.email} onChange={set('email')} />
              <Input label="Date of birth" type="date" name="dob" value={form.dob} onChange={set('dob')} />
            </div>
            <Input label="Address" name="address" value={form.address} onChange={set('address')} />
            <ConsentCheckboxes value={form} onChange={setConsents} />
            <Input label="Notes" name="notes" value={form.notes} onChange={set('notes')} />
            {error && (
              <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export default CustomerFormDialog;