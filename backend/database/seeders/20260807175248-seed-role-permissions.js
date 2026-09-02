'use strict';

export async function up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
        `
            SELECT id, name
            FROM roles
        `
    );

    const [permissions] = await queryInterface.sequelize.query(
        `
            SELECT id, name
            FROM permissions
        `
    );

    const roleMap = Object.fromEntries(
        roles.map((role) => [role.name, role.id])
    );

    const permissionMap = Object.fromEntries(
        permissions.map((permission) => [
            permission.name,
            permission.id,
        ])
    );

    const assignments = {
        ADMIN: Object.keys(permissionMap),

        MANAGER: [
            'users.view',
            'users.update',

            'inventory.view',
            'inventory.create',
            'inventory.update',
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

        INVENTORY_MANAGER: [
            'inventory.view',
            'inventory.create',
            'inventory.update',
            'inventory.delete',
            'inventory.barcode_generate',

            'picklists.view',
            'picklists.create',
            'picklists.update',
        ],

        CASHIER: [
            'inventory.view',
            'sales.view',
            'sales.create',
        ],

        ACCOUNTANT: [
            'sales.view',

            'expenses.view',
            'expenses.create',
            'expenses.update',

            'reports.view',
        ],
    };

    // Validate all expected roles exist upfront before assigning permissions
    for (const roleName of Object.keys(assignments)) {
        if (!roleMap[roleName]) {
            throw new Error(`Required role '${roleName}' not found in database. Seed may have failed or run out of order.`);
        }
    }

    for (const [roleName, permissionNames] of Object.entries(
        assignments
    )) {
        const roleId = roleMap[roleName];

        for (const permissionName of permissionNames) {
            const permissionId = permissionMap[permissionName];

            if (!permissionId) {
                throw new Error(
                    `Permission not found: ${permissionName}`
                );
            }

            await queryInterface.sequelize.query(
                `
                INSERT INTO role_permissions (
                    role_id,
                    permission_id,
                    created_at,
                    updated_at
                )
                VALUES (
                    :roleId,
                    :permissionId,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (role_id, permission_id)
                DO NOTHING
                `,
                {
                    replacements: {
                        roleId,
                        permissionId,
                    },
                }
            );
        }
    }
}

export async function down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM roles
        WHERE name IN (
            'ADMIN',
            'MANAGER',
            'INVENTORY_MANAGER',
            'CASHIER',
            'ACCOUNTANT'
        )
        `
    );

    const roleIds = roles.map((role) => role.id);

    if (!roleIds.length) {
        return;
    }

    await queryInterface.bulkDelete('role_permissions', {
        role_id: roleIds,
    });
}