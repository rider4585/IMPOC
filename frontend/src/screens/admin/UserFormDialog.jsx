import React, { useState } from 'react';
import {
  Dialog,
  Button,
  Input,
  Select,
  Card,
  CardContent,
} from '../../components/ui';

const EMPTY = {
  username: '',
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  roleUuid: '',
};

export function UserFormDialog({ open, onClose, onSave, saving, user, roles }) {
  const isEdit = Boolean(user);
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          username: user.username || '',
          email: user.email || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          phone: user.phone || '',
        }
      : { ...EMPTY }
  );
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!form.username || !form.firstName) {
      setError('Username and first name are required.');
      return;
    }
    if (!isEdit && (!form.password || form.password.length < 8)) {
      setError('Password is required and must be at least 8 characters.');
      return;
    }
    if (!isEdit && !form.roleUuid) {
      setError('Please select an initial role.');
      return;
    }

    const payload = {
      username: form.username,
      firstName: form.firstName,
      lastName: form.lastName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
    };
    if (!isEdit) {
      payload.password = form.password;
      payload.roleUuid = form.roleUuid;
    }
    onSave(payload);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit user' : 'Create user'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id="user-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Username" value={form.username} onChange={set('username')} required />
            <Input label="First name" value={form.firstName} onChange={set('firstName')} required />
            <Input label="Last name" value={form.lastName} onChange={set('lastName')} />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={set('email')}
            />
            <Input label="Phone" value={form.phone} onChange={set('phone')} />

            {!isEdit && (
              <>
                <Input
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  hint="At least 8 characters."
                />
                <Select
                  label="Initial role"
                  value={form.roleUuid}
                  onChange={set('roleUuid')}
                >
                  <option value="" disabled>
                    Select a role…
                  </option>
                  {roles.map((role) => (
                    <option key={role.uuid} value={role.uuid}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </>
            )}

            {error && (
              <div className="rounded-md bg-[rgba(179,38,30,0.1)] p-3 text-sm text-[var(--danger)]" role="alert">
                {error}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export default UserFormDialog;
