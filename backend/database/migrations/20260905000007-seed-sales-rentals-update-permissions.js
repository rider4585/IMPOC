'use strict';

const UPDATE_PERMISSIONS = [
    ['sales.update', 'Update sales'],
    ['rentals.update', 'Update rental agreements'],
];

export async function up(queryInterface) {
    for (const [name, description] of UPDATE_PERMISSIONS) {
        await queryInterface.sequelize.query(
            `
            INSERT INTO permissions (uuid, name, description, created_at, updated_at)
            VALUES (gen_random_uuid(), :name, :description, NOW(), NOW())
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
        `SELECT id, name FROM permissions WHERE name IN ('sales.update', 'rentals.update')`
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
                INSERT INTO role_permissions (uuid, role_id, permission_id, created_at, updated_at)
                VALUES (gen_random_uuid(), :roleId, :permissionId, NOW(), NOW())
                ON CONFLICT (role_id, permission_id) DO NOTHING
                `,
                { replacements: { roleId: roleIds[roleName], permissionId: permission.id } }
            );
        }
    }
}

export async function down(queryInterface) {
    await queryInterface.bulkDelete('permissions', {
        name: UPDATE_PERMISSIONS.map(([name]) => name),
    });
}