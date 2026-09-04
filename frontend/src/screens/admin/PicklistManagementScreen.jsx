import React, { useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { ProductTypesManager } from './ProductTypesManager.jsx';
import {
  FlatPicklistManager,
} from './FlatPicklistManager.jsx';
import { getColours, getSizes, getDamageGrades } from '../../services/picklistsApi.js';
import { DAMAGE_GRADE_OUTCOMES } from '../../constants/damageGrades.js';

const TABS = [
  { key: 'product-types', label: 'Product types' },
  { key: 'colours', label: 'Colours' },
  { key: 'sizes', label: 'Sizes' },
  { key: 'damage-grades', label: 'Damage grades' },
];

const COLOUR_COLUMNS = [{ key: 'name', label: 'Name' }];
const COLOUR_FIELDS = [{ key: 'name', label: 'Name', required: true }];

const SIZE_COLUMNS = [{ key: 'name', label: 'Name' }];
const SIZE_FIELDS = [{ key: 'name', label: 'Name', required: true }];

const DAMAGE_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'outcome', label: 'Outcome' },
];
const DAMAGE_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  {
    key: 'outcome',
    label: 'Outcome',
    required: true,
    options: Object.values(DAMAGE_GRADE_OUTCOMES),
  },
];

export function PicklistManagementScreen() {
  const { permissions } = useAuth();
  const [active, setActive] = useState('product-types');
  const canView = permissions && permissions.includes(PERMISSIONS.PICKLISTS.VIEW);

  if (!canView) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view picklists.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Picklists</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Manage product types, colours, sizes, and damage grades.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            className={`rounded-[var(--rounded-md)] border px-4 py-2 text-[14px] font-semibold text-[var(--ink-muted)] cursor-pointer ${
              active === tab.key
                ? 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--primary)]'
                : 'border-transparent bg-transparent hover:bg-[var(--surface-sunken)]'
            }`}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'product-types' && <ProductTypesManager />}
      {active === 'colours' && (
        <FlatPicklistManager
          resource="colours"
          singular="Colour"
          source={getColours}
          columns={COLOUR_COLUMNS}
          fields={COLOUR_FIELDS}
        />
      )}
      {active === 'sizes' && (
        <FlatPicklistManager
          resource="sizes"
          singular="Size"
          source={getSizes}
          columns={SIZE_COLUMNS}
          fields={SIZE_FIELDS}
        />
      )}
      {active === 'damage-grades' && (
        <FlatPicklistManager
          resource="damageGrades"
          singular="Damage grade"
          source={getDamageGrades}
          columns={DAMAGE_COLUMNS}
          fields={DAMAGE_FIELDS}
        />
      )}
    </div>
  );
}

export default PicklistManagementScreen;
