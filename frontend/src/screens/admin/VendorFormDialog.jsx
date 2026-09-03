import React, { useState } from 'react';
import { Dialog, Button, Input, Card, CardContent } from '../../components/ui';

export function VendorFormDialog({ open, onClose, onSave, saving, vendor }) {
  const isEdit = Boolean(vendor);
  const [form, setForm] = useState({
    name: vendor?.name || '',
    phone: vendor?.phone || '',
    address: vendor?.address || '',
    notes: vendor?.notes || '',
  });
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Vendor name is required.');
      return;
    }
    onSave({
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit vendor' : 'Create vendor'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="vendor-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Create vendor'}
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id="vendor-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Name" value={form.name} onChange={set('name')} required />
            <Input label="Phone" value={form.phone} onChange={set('phone')} />
            <Input label="Address" value={form.address} onChange={set('address')} />
            <Input label="Notes" value={form.notes} onChange={set('notes')} />
            {error && (
              <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export default VendorFormDialog;
