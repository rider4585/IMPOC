import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input, Dialog } from '../ui';
import { searchCustomers, createCustomer } from '../../services/customersApi.js';
import { ConsentCheckboxes } from './ConsentCheckboxes.jsx';

/**
 * CustomerPicker — search-by-phone/name dropdown with inline-create.
 *
 * Exclusive with the older bare free-text customer-name input: callers get a
 * selected customer (or null for walk-in) and send `customerUuid` when present.
 *
 * Props:
 *  - value: selected customer object or null (controlled)
 *  - onChange: (customer | null) => void
 *  - label, placeholder, id
 */
export function CustomerPicker({ value, onChange, label = 'Customer', placeholder = 'Search by name or phone…', id }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const [newForm, setNewForm] = useState({
    name: '',
    phone: '',
    email: '',
    dob: '',
    consentWhatsapp: false,
    consentEmail: false,
    consentSms: false,
    consentWhatsappGroup: false,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  const runSearch = useCallback(async (term) => {
    setSearching(true);
    setError('');
    try {
      const customers = await searchCustomers(term);
      setResults(Array.isArray(customers) ? customers : []);
      setOpen(true);
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value) return undefined;
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, value, runSearch]);

  // Close the dropdown when clicking outside the picker.
  useEffect(() => {
    const onDocPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, []);

  const select = (customer) => {
    onChange(customer);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const setNew = (key) => (e) => setNewForm((f) => ({ ...f, [key]: e.target.value }));
  const setNewConsents = (consents) => setNewForm((f) => ({ ...f, ...consents }));

  const handleCreate = async () => {
    if (!newForm.name.trim()) {
      setCreateError('Name is required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const customer = await createCustomer({
        name: newForm.name.trim(),
        phone: newForm.phone.trim() || undefined,
        email: newForm.email.trim() || undefined,
        dob: newForm.dob || undefined,
        consentWhatsapp: newForm.consentWhatsapp,
        consentEmail: newForm.consentEmail,
        consentSms: newForm.consentSms,
        consentWhatsappGroup: newForm.consentWhatsappGroup,
      });
      setCreateOpen(false);
      select(customer);
    } catch (err) {
      setCreateError(err.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError('');
    setNewForm({
      name: '',
      phone: '',
      email: '',
      dob: '',
      consentWhatsapp: false,
      consentEmail: false,
      consentSms: false,
      consentWhatsappGroup: false,
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      {label && <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">{label}</span>}

      {value ? (
        <div className="flex w-full items-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2 text-sm shadow-sm">
          <span className="flex-1 truncate">
            <span className="font-semibold">{value.name}</span>
            {value.phone ? <span className="ml-2 text-[var(--ink-muted)]">{value.phone}</span> : null}
          </span>
          <button
            type="button"
            onClick={clear}
            className="rounded-sm px-2 py-1 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
            data-testid="customer-picker-clear"
          >
            Clear
          </button>
        </div>
      ) : (
        <>
          <Input
            id={id}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            aria-label={label}
          />
          {open && (
            <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-raised)] shadow-lg">
              {searching && results.length === 0 && (
                <p className="px-3 py-2 text-sm text-[var(--ink-muted)]">Searching…</p>
              )}
              {error && !searching && (
                <p className="px-3 py-2 text-sm text-[var(--danger)]" role="alert">{error}</p>
              )}
              {!searching && !error && results.length === 0 && query.trim() && (
                <p className="px-3 py-2 text-sm text-[var(--ink-muted)]">No matches for “{query}”.</p>
              )}
              {results.map((customer) => (
                <button
                  key={customer.uuid}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(customer)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <span className="truncate">
                    <span className="font-medium">{customer.name}</span>
                    {customer.phone ? <span className="ml-2 text-[var(--ink-muted)]">{customer.phone}</span> : null}
                  </span>
                  {typeof customer.customerCount === 'number' && (
                    <span className="shrink-0 text-xs text-[var(--ink-faint)]">
                      {customer.customerCount} purchase(s)
                    </span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  setCreateOpen(true);
                }}
                className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-[var(--surface-sunken)]"
                data-testid="customer-picker-create"
              >
                <span aria-hidden="true">+</span> Create new customer
              </button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={closeCreate}
        title="New customer"
        footer={
          <>
            <Button variant="outline" onClick={closeCreate} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              Save customer
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          id="customer-picker-create-form"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Name" name="name" value={newForm.name} onChange={setNew('name')} required autoFocus />
            <Input label="Phone" name="phone" value={newForm.phone} onChange={setNew('phone')} />
            <Input label="Email" type="email" name="email" value={newForm.email} onChange={setNew('email')} />
            <Input label="Date of birth" type="date" name="dob" value={newForm.dob} onChange={setNew('dob')} />
          </div>
          <ConsentCheckboxes value={newForm} onChange={setNewConsents} />
          {createError && (
            <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
              {createError}
            </div>
          )}
        </form>
      </Dialog>
    </div>
  );
}

export default CustomerPicker;