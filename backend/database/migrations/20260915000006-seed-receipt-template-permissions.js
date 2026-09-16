'use strict';

// R-47: receipt template + snapshot permissions.
// Follows the exact same pattern as 20260915000002-seed-enquiry-permissions.js.
// Uses direct SQL interpolation (no replacements) for sequelize-cli ESM compat.

const TEMPLATE_PERMISSIONS = [
    ['receipt_templates.view', 'View receipt templates'],
    ['receipt_templates.manage', 'Create, edit, activate receipt templates'],
];

const SNAPSHOT_PERMISSIONS = [
    ['receipt_snapshots.view', 'View frozen receipt snapshots'],
    ['receipt_snapshots.export', 'Bulk export receipt snapshots'],
];

export async function up(queryInterface) {
    for (const [name, description] of [...TEMPLATE_PERMISSIONS, ...SNAPSHOT_PERMISSIONS]) {
        await queryInterface.sequelize.query(`
            INSERT INTO permissions (uuid, name, description, created_at, updated_at)
            VALUES (gen_random_uuid(), '${name}', '${description}', NOW(), NOW())
            ON CONFLICT (name) DO UPDATE SET
                description = EXCLUDED.description,
                updated_at = NOW()
        `);
    }

    const [roles] = await queryInterface.sequelize.query(
        `SELECT id, name FROM roles WHERE name IN ('ADMIN', 'MANAGER')`
    );
    const [permissions] = await queryInterface.sequelize.query(
        `SELECT id, name FROM permissions WHERE name LIKE 'receipt_templates.%' OR name LIKE 'receipt_snapshots.%'`
    );

    for (const role of roles) {
        for (const permission of permissions) {
            if (role.name === 'MANAGER' && !permission.name.endsWith('.view')) {
                continue;
            }
            await queryInterface.sequelize.query(`
                INSERT INTO role_permissions (uuid, role_id, permission_id, created_at, updated_at)
                VALUES (gen_random_uuid(), ${role.id}, ${permission.id}, NOW(), NOW())
                ON CONFLICT (role_id, permission_id) DO NOTHING
            `);
        }
    }
}

export async function down(queryInterface) {
    const [permissions] = await queryInterface.sequelize.query(
        `SELECT id FROM permissions WHERE name LIKE 'receipt_templates.%' OR name LIKE 'receipt_snapshots.%'`
    );
    const ids = permissions.map((p) => p.id);
    if (ids.length === 0) return;
    const idList = ids.join(',');
    await queryInterface.sequelize.query(
        `DELETE FROM role_permissions WHERE permission_id IN (${idList})`
    );
    await queryInterface.sequelize.query(
        `DELETE FROM permissions WHERE id IN (${idList})`
    );
}
