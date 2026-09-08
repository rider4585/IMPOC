'use strict';

export async function up(queryInterface) {
    const roles = [
        ['ADMIN', 'Full system access', true],
        ['MANAGER', 'Shop management access', false],
        ['INVENTORY_MANAGER', 'Inventory management access', false],
        ['CASHIER', 'Point of sale operations', false],
        ['ACCOUNTANT', 'Financial and expense management', false],
    ];

    for (const [name, description, isPrivileged] of roles) {
        await queryInterface.sequelize.query(
            `
                INSERT INTO roles (
                    name,
                    description,
                    is_privileged,
                    created_at,
                    updated_at
                )
                VALUES (
                           :name,
                           :description,
                           :isPrivileged,
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
                    isPrivileged,
                },
            }
        );
    }
}

export async function down(queryInterface) {
    await queryInterface.bulkDelete('roles', {
        name: [
            'ADMIN',
            'MANAGER',
            'INVENTORY_MANAGER',
            'CASHIER',
            'ACCOUNTANT',
        ],
    });
}