/**
 * Frontend permission constants mirroring backend/src/constants/permissions.js
 * Used for permission-driven navigation and feature gating
 */

export const PERMISSIONS = Object.freeze({
  USERS: {
    VIEW: 'users.view',
    CREATE: 'users.create',
    UPDATE: 'users.update',
    DELETE: 'users.delete',
  },

  INVENTORY: {
    VIEW: 'inventory.view',
    CREATE: 'inventory.create',
    UPDATE: 'inventory.update',
    DELETE: 'inventory.delete',
    BARCODE_GENERATE: 'inventory.barcode_generate',
    BARCODE_LAYOUT_MANAGE: 'inventory.barcode_layout_manage',
  },

  PICKLISTS: {
    VIEW: 'picklists.view',
    CREATE: 'picklists.create',
    UPDATE: 'picklists.update',
  },

  SALES: {
    VIEW: 'sales.view',
    CREATE: 'sales.create',
    CANCEL: 'sales.cancel',
    REFUND: 'sales.refund',
  },

  BRANDING: {
    MANAGE: 'branding.manage',
  },

  CUSTOMERS: {
    VIEW: 'customers.view',
    CREATE: 'customers.create',
    UPDATE: 'customers.update',
  },

  ENQUIRIES: {
    VIEW: 'enquiries.view',
    CREATE: 'enquiries.create',
    UPDATE: 'enquiries.update',
  },

  RENTALS: {
    VIEW: 'rentals.view',
    CREATE: 'rentals.create',
    RETURN: 'rentals.return',
    CANCEL: 'rentals.cancel',
  },

  EXPENSES: {
    VIEW: 'expenses.view',
    CREATE: 'expenses.create',
    UPDATE: 'expenses.update',
  },

  REPORTS: {
    VIEW: 'reports.view',
  },

  ROLES: {
    VIEW: 'roles.view',
    MANAGE: 'roles.manage',
  },
});
