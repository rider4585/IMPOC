import React, { useState } from 'react';
import { Dialog, Button, Input, Card, CardContent } from '../../components/ui';

export function RoleFormDialog({ open, onClose, onSave, saving, role }) {
  const isEdit = Boolean(role);
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Role name is required.');
      return;
    }
    onSave({ name: name.trim(), description: description.trim() || undefined });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit role' : 'Create role'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="role-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Create role'}
          </Button>
        </>
      }
    >
      <Card>
        <CardContent>
          <form id="role-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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

export default RoleFormDialog;
