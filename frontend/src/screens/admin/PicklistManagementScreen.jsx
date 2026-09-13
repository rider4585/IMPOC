import React, { useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { Tabs, Tab } from '../../components/ui';
import { ProductTypesManager } from './ProductTypesManager.jsx';
import {
  FlatPicklistManager,
} from './FlatPicklistManager.jsx';
import { getColours, getSizes, getDamageGrades, getPaymentMethods, getCustomerSources, getExpenseTypes, getUpiAccounts, getReviewLinks } from '../../services/picklistsApi.js';
import { DAMAGE_GRADE_OUTCOMES } from '../../constants/damageGrades.js';

const TABS = [
  { key: 'product-types', label: 'Product types' },
  { key: 'colours', label: 'Colours' },
  { key: 'sizes', label: 'Sizes' },
  { key: 'damage-grades', label: 'Damage grades' },
  { key: 'payment-methods', label: 'Payment methods' },
  { key: 'customer-sources', label: 'Customer sources' },
  { key: 'expense-types', label: 'Expense types' },
  { key: 'upi-accounts', label: 'UPI accounts' },
  { key: 'review-links', label: 'Review links' },
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

const PAYMENT_COLUMNS = [{ key: 'name', label: 'Name' }];
const PAYMENT_FIELDS = [{ key: 'name', label: 'Name', required: true }];

const CUSTOMER_SOURCE_COLUMNS = [{ key: 'name', label: 'Name' }];
const CUSTOMER_SOURCE_FIELDS = [{ key: 'name', label: 'Name', required: true }];

const EXPENSE_TYPE_COLUMNS = [{ key: 'name', label: 'Name' }];
const EXPENSE_TYPE_FIELDS = [{ key: 'name', label: 'Name', required: true }];

const UPI_ACCOUNT_COLUMNS = [
  { key: 'label', label: 'Label' },
  { key: 'vpa', label: 'UPI ID (VPA)' },
];
const UPI_ACCOUNT_FIELDS = [
  { key: 'label', label: 'Label', required: true },
  { key: 'vpa', label: 'UPI ID (VPA), e.g. shree@okhdfcbank', required: true },
];

// R-54: shown as a QR on the customer display after payment (first ACTIVE link wins)
const REVIEW_LINK_COLUMNS = [
  { key: 'label', label: 'Label' },
  { key: 'url', label: 'Link (https)' },
];
const REVIEW_LINK_FIELDS = [
  { key: 'label', label: 'Label, e.g. Google Maps', required: true },
  { key: 'url', label: 'Link, e.g. https://search.google.com/local/writereview?placeid=…', required: true },
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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px] flex-col gap-5 p-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="typography-heading mb-1">Picklists</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            Manage product types, colours, sizes, and damage grades.
          </p>
        </div>
      </div>

      <div className="border-b border-[var(--border)] pb-2">
        <Tabs aria-label="Picklist types">
          {TABS.map((tab) => (
            <Tab
              key={tab.key}
              id={`picklist-tab-${tab.key}`}
              active={active === tab.key}
              onClick={() => setActive(tab.key)}
            >
              {tab.label}
            </Tab>
          ))}
        </Tabs>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
      {active === 'payment-methods' && (
        <FlatPicklistManager
          resource="paymentMethods"
          singular="Payment method"
          source={getPaymentMethods}
          columns={PAYMENT_COLUMNS}
          fields={PAYMENT_FIELDS}
        />
      )}
      {active === 'customer-sources' && (
        <FlatPicklistManager
          resource="customerSources"
          singular="Customer source"
          source={getCustomerSources}
          columns={CUSTOMER_SOURCE_COLUMNS}
          fields={CUSTOMER_SOURCE_FIELDS}
        />
      )}
      {active === 'expense-types' && (
        <FlatPicklistManager
          resource="expenseTypes"
          singular="Expense type"
          source={getExpenseTypes}
          columns={EXPENSE_TYPE_COLUMNS}
          fields={EXPENSE_TYPE_FIELDS}
        />
      )}
      {active === 'upi-accounts' && (
        <FlatPicklistManager
          resource="upiAccounts"
          singular="UPI account"
          source={getUpiAccounts}
          columns={UPI_ACCOUNT_COLUMNS}
          fields={UPI_ACCOUNT_FIELDS}
        />
      )}
      {active === 'review-links' && (
        <FlatPicklistManager
          resource="reviewLinks"
          singular="Review link"
          source={getReviewLinks}
          columns={REVIEW_LINK_COLUMNS}
          fields={REVIEW_LINK_FIELDS}
        />
      )}
      </div>
    </div>
  );
}

export default PicklistManagementScreen;
