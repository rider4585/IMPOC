export const PERMISSIONS = Object.freeze({
    USERS: {
        VIEW: 'users.view',
        VIEW_PII: 'users.view_pii',
        CREATE: 'users.create',
        UPDATE: 'users.update',
        DELETE: 'users.delete',
        ASSIGN_ROLE: 'users.assign_role',
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
        UPDATE: 'sales.update',
        CANCEL: 'sales.cancel',
        REFUND: 'sales.refund',
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

    CUSTOMERS: {
        VIEW: 'customers.view',
        CREATE: 'customers.create',
        UPDATE: 'customers.update',
        DELETE: 'customers.delete',
    },
});