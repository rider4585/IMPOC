'use strict';

const CUSTOMER_PERMISSIONS = [
    ['customers.view', 'View customers'],
    ['customers.create', 'Create customers'],
    ['customers.update', 'Update customers'],
    ['customers.delete', 'Soft delete customers'],
];

export async function up(queryInterface) {
    for (const [name, description] of CUSTOMER_PERMISSIONS) {
        await queryInterface.sequelize.query(
            `
            INSERT INTO permissions (name, description, created_at, updated_at)
            VALUES (:name, :description, NOW(), NOW())
            ON CONFLICT (name) DO UPDATE SET
                description = EXCLUDED.description,
                updated_at = NOW()
            `,
            { replacements: { name, description } }
        );
    }

    const [roles] = await queryInterface.sequelize.query(
        `SELECT id, name FROM roles WHERE name IN ('ADMIN', 'MANAGER')`
    );
    const [permissions] = await queryInterface.sequelize.query(
        `SELECT id, name FROM permissions WHERE name LIKE 'customers.%'`
    );

    const roleIds = Object.fromEntries(roles.map((r) => [r.name, r.id]));
    if (!roleIds.ADMIN && !roleIds.MANAGER) {
        // Roles may not exist yet (e.g. seeders run out of order); nothing to assign.
        return;
    }

    for (const roleName of Object.keys(roleIds)) {
        for (const permission of permissions) {
            await queryInterface.sequelize.query(
                `
                INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
                VALUES (:roleId, :permissionId, NOW(), NOW())
                ON CONFLICT (role_id, permission_id) DO NOTHING
                `,
                { replacements: { roleId: roleIds[roleName], permissionId: permission.id } }
            );
        }
    }
}

export async function down(queryInterface) {
    await queryInterface.bulkDelete('permissions', {
        name: CUSTOMER_PERMISSIONS.map(([name]) => name),
    });
}