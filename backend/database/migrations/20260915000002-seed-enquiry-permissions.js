'use strict';

// R-63: enquiries.* permissions. Counter staff take enquiries, so CASHIER gets them too.
const ENQUIRY_PERMISSIONS = [
    ['enquiries.view', 'View customer enquiries'],
    ['enquiries.create', 'Log customer enquiries'],
    ['enquiries.update', 'Edit, close and reopen customer enquiries'],
];

export async function up(queryInterface) {
    for (const [name, description] of ENQUIRY_PERMISSIONS) {
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
        `SELECT id, name FROM roles WHERE name IN ('ADMIN', 'MANAGER', 'CASHIER')`
    );
    const [permissions] = await queryInterface.sequelize.query(
        `SELECT id, name FROM permissions WHERE name LIKE 'enquiries.%'`
    );

    for (const role of roles) {
        for (const permission of permissions) {
            await queryInterface.sequelize.query(
                `
                INSERT INTO role_permissions (uuid, role_id, permission_id, created_at, updated_at)
                VALUES (gen_random_uuid(), :roleId, :permissionId, NOW(), NOW())
                ON CONFLICT (role_id, permission_id) DO NOTHING
                `,
                { replacements: { roleId: role.id, permissionId: permission.id } }
            );
        }
    }
}

export async function down(queryInterface) {
    const [permissions] = await queryInterface.sequelize.query(
        `SELECT id FROM permissions WHERE name LIKE 'enquiries.%'`
    );
    const ids = permissions.map((p) => p.id);
    if (ids.length === 0) {
        return;
    }
    await queryInterface.sequelize.query(
        `DELETE FROM role_permissions WHERE permission_id IN (:ids)`,
        { replacements: { ids } }
    );
    await queryInterface.sequelize.query(
        `DELETE FROM permissions WHERE id IN (:ids)`,
        { replacements: { ids } }
    );
}
