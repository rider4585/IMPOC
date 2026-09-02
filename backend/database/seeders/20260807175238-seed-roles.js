'use strict';

export async function up(queryInterface) {
    const roles = [
        ['ADMIN', 'Full system access'],
        ['MANAGER', 'Shop management access'],
        ['INVENTORY_MANAGER', 'Inventory management access'],
        ['CASHIER', 'Point of sale operations'],
        ['ACCOUNTANT', 'Financial and expense management'],
    ];

    for (const [name, description] of roles) {
        await queryInterface.sequelize.query(
            `
                INSERT INTO roles (
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