'use strict';

export async function up(queryInterface) {
    // Insert the new permission
    await queryInterface.sequelize.query(
        `
        INSERT INTO permissions (name, description, created_at, updated_at)
        VALUES (:name, :description, NOW(), NOW())
        ON CONFLICT (name) DO UPDATE SET
            description = EXCLUDED.description,
            updated_at = NOW()
        `,
        {
            replacements: {
                name: 'users.assign_role',
                description: 'Assign and remove user roles',
            },
        }
    );

    // Assign to ADMIN only (not MANAGER or others)
    const [roles] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name = 'ADMIN'`
    );

    const [permissions] = await queryInterface.sequelize.query(
        `SELECT id FROM permissions WHERE name = 'users.assign_role'`
    );

    if (roles.length && permissions.length) {
        await queryInterface.sequelize.query(
            `
            INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
            VALUES (:roleId, :permissionId, NOW(), NOW())
            ON CONFLICT (role_id, permission_id) DO NOTHING
            `,
            {
                replacements: {
                    roleId: roles[0].id,
                    permissionId: permissions[0].id,
                },
            }
        );
    }
}

export async function down(queryInterface) {
    await queryInterface.bulkDelete('role_permissions', {});
    await queryInterface.bulkDelete('permissions', {
        name: ['users.assign_role'],
    });
}
