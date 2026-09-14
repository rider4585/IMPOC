import React, { useEffect, useState } from 'react';
import { Dialog, Button, Input, Select, Card, CardContent } from '../../components/ui';
import { CustomerPicker } from '../../components/customers/CustomerPicker.jsx';
import { getProductTypes, getColours, getSizes } from '../../services/picklistsApi.js';

const NONE = '__none__';

function toOptions(rows, { includeNone = true } = {}) {
  const opts = (rows || [])
    .filter((r) => r && r.uuid)
    .map((r) => ({ value: r.uuid, label: r.name }));
  return includeNone ? [{ value: NONE, label: '— Any —' }, ...opts] : opts;
}

/**
 * EnquiryFormDialog — log or edit a customer enquiry (R-63).
 *
 * Create: pick an existing customer or create one inline (CustomerPicker), then
 * describe what they want. Edit: the customer is fixed; only the ask changes.
 *
 * enquiry shape: {uuid, customer:{uuid,name,phone,email}, productType:{uuid,name}|null,
 *  colour, size, description, notes, promisedDate}
 */
export function EnquiryFormDialog({ open, onClose, onSave, saving, enquiry }) {
  const isEdit = Boolean(enquiry);
  const [customer, setCustomer] = useState(enquiry?.customer || null);
  const [form, setForm] = useState({
    productTypeUuid: enquiry?.productType?.uuid || NONE,
    colourUuid: enquiry?.colour?.uuid || NONE,
    sizeUuid: enquiry?.size?.uuid || NONE,
    description: enquiry?.description || '',
    notes: enquiry?.notes || '',
    promisedDate: enquiry?.promisedDate || '',
  });
  const [picklists, setPicklists] = useState({ productTypes: [], colours: [], sizes: [] });
  const [loadingPicklists, setLoadingPicklists] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [productTypes, colours, sizes] = await Promise.all([getProductTypes(), getColours(), getSizes()]);
        if (!cancelled) {
          setPicklists({
            productTypes: (productTypes || []).filter((p) => p.isActive !== false),
            colours: (colours || []).filter((c) => c.isActive !== false),
            sizes: (sizes || []).filter((s) => s.isActive !== false),
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load picklists');
      } finally {
        if (!cancelled) setLoadingPicklists(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setSelect = (key) => (value) => setForm((f) => ({ ...f, [key]: value || NONE }));
  const refOrNull = (value) => (value && value !== NONE ? value : null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isEdit && !customer) {
      setError('Pick the customer first (or create a new one).');
      return;
    }
    if (!form.description.trim()) {
      setError('Describe what the customer is looking for.');
      return;
    }
    setError('');
    const payload = {
      productTypeUuid: refOrNull(form.productTypeUuid),
      colourUuid: refOrNull(form.colourUuid),
      sizeUuid: refOrNull(form.sizeUuid),
      description: form.description.trim(),
      notes: form.notes.trim() || null,
      promisedDate: form.promisedDate || null,
    };
    onSave(isEdit ? payload : { customerUuid: customer.uuid, ...payload });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit enquiry' : 'Log enquiry'}
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="enquiry-form" loading={saving} data-testid="enquiry-save">
            {isEdit ? 'Save changes' : 'Log enquiry'}
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id="enquiry-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isEdit ? (
              <div className="rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                <span className="font-semibold">{enquiry.customer?.name}</span>
                {(enquiry.customer?.phone || enquiry.customer?.email) && (
                  <span className="ml-2 text-xs text-[var(--ink-muted)]">
                    {[enquiry.customer?.phone, enquiry.customer?.email].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            ) : (
              <CustomerPicker value={customer} onChange={setCustomer} id="enquiry-customer" />
            )}

            <Input
              label="What are they looking for?"
              name="description"
              value={form.description}
              onChange={set('description')}
              placeholder="e.g. red silk saree with golden border, for a wedding"
              maxLength={5000}
              required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select
                label="Product type"
                value={form.productTypeUuid}
                onChange={setSelect('productTypeUuid')}
                options={toOptions(picklists.productTypes)}
                placeholder="Any"
                searchPlaceholder="Search types…"
                disabled={loadingPicklists}
                dataTestid="enquiry-product-type"
              />
              <Select
                label="Colour"
                value={form.colourUuid}
                onChange={setSelect('colourUuid')}
                options={toOptions(picklists.colours)}
                placeholder="Any"
                searchPlaceholder="Search colours…"
                disabled={loadingPicklists}
                dataTestid="enquiry-colour"
              />
              <Select
                label="Size"
                value={form.sizeUuid}
                onChange={setSelect('sizeUuid')}
                options={toOptions(picklists.sizes)}
                placeholder="Any"
                searchPlaceholder="Search sizes…"
                disabled={loadingPicklists}
                dataTestid="enquiry-size"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Promised by"
                type="date"
                name="promisedDate"
                value={form.promisedDate}
                onChange={set('promisedDate')}
                hint="When did we say the stock would come?"
              />
              <Input label="Notes" name="notes" value={form.notes} onChange={set('notes')} placeholder="Optional" maxLength={5000} />
            </div>

            {error && (
              <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export default EnquiryFormDialog;
