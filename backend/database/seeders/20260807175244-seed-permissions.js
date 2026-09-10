'use strict';

export async function up(queryInterface) {
    const permissions = [
        ['users.view', 'View users'],
        ['users.create', 'Create users'],
        ['users.update', 'Update users'],
        ['users.delete', 'Soft delete users'],
        ['users.view_pii', 'View staff contact details (privileged read scope)'],

        ['roles.view', 'View roles'],
        ['roles.manage', 'Manage roles and permissions'],
        ['users.assign_role', 'Assign and remove user roles'],

        ['inventory.view', 'View inventory'],
        ['inventory.create', 'Add inventory items'],
        ['inventory.update', 'Update inventory items'],
        ['inventory.delete', 'Delete inventory items'],
        ['inventory.barcode_generate', 'Generate barcodes'],

        ['picklists.view', 'View picklists'],
        ['picklists.create', 'Create picklist items'],
        ['picklists.update', 'Update picklist items'],

        ['sales.view', 'View sales'],
        ['sales.create', 'Create sales'],
        ['sales.cancel', 'Cancel sales'],
        ['sales.refund', 'Process refunds'],

        ['expenses.view', 'View expenses'],
        ['expenses.create', 'Create expenses'],
        ['expenses.update', 'Update expenses'],

        ['reports.view', 'View reports'],
    ];

    for (const [name, description] of permissions) {
        await queryInterface.sequelize.query(
            `
            INSERT INTO permissions (
                name,
                description,
                created_at,
                updated_at
            )
            VALUES (
                :name,
                :description,
                NOW(),
                NOW()
            )
            ON CONFLICT (name)
            DO UPDATE SET
                description = EXCLUDED.description,
                updated_at = NOW()
            `,
            {
                replacements: {
                    name,
                    description,
                },
            }
        );
    }
}

export async function down(queryInterface) {
    await queryInterface.bulkDelete('permissions', {
        name: [
            'users.view',
            'users.create',
            'users.update',
            'users.delete',
            'users.view_pii',
            'users.assign_role',
            'roles.view',
            'roles.manage',
            'inventory.view',
            'inventory.create',
            'inventory.update',
            'inventory.delete',
            'inventory.barcode_generate',
            'picklists.view',
            'picklists.create',
            'picklists.update',
            'sales.view',
            'sales.create',
            'sales.cancel',
            'sales.refund',
            'expenses.view',
            'expenses.create',
            'expenses.update',
            'reports.view',
        ],
    });
}