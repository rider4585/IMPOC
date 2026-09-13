'use strict';

export async function up(queryInterface, Sequelize) {
    // R-50: find or create the BARCODE_LAYOUT_MANAGE permission (Admin only)
    let permission = await queryInterface.sequelize.query(
        `SELECT id FROM permissions WHERE name = 'inventory.barcode_layout_manage' LIMIT 1`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    let permissionId;

    if (permission.length === 0) {
        // Permission doesn't exist, create it
        const result = await queryInterface.sequelize.query(
            `INSERT INTO permissions (uuid, name, description, created_at, updated_at)
             VALUES (gen_random_uuid(), 'inventory.barcode_layout_manage', 'Permission to edit the barcode label sheet layout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        permissionId = result[0].id;
    } else {
        permissionId = permission[0].id;
    }

    // Admin only: editing the sheet layout affects every printed label
    const roles = await queryInterface.sequelize.query(
        `SELECT id, name FROM roles WHERE name IN ('ADMIN')`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // Assign permission to each role if not already assigned
    for (const role of roles) {
        const existing = await queryInterface.sequelize.query(
            `SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?`,
            {
                replacements: [role.id, permissionId],
                type: queryInterface.sequelize.QueryTypes.SELECT,
            }
        );

        if (existing.length === 0) {
            await queryInterface.sequelize.query(
                `INSERT INTO role_permissions (uuid, role_id, permission_id, created_at, updated_at)
                 VALUES (gen_random_uuid(), ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                {
                    replacements: [role.id, permissionId],
                }
            );
        }
    }
}

export async function down(queryInterface) {
    // Find the permission
    const permission = await queryInterface.sequelize.query(
        `SELECT id FROM permissions WHERE name = 'inventory.barcode_layout_manage' LIMIT 1`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (permission.length > 0) {
        // Remove role assignments
        await queryInterface.sequelize.query(
            `DELETE FROM role_permissions WHERE permission_id = ?`,
            {
                replacements: [permission[0].id],
            }
        );

        // Delete the permission
        await queryInterface.sequelize.query(
            `DELETE FROM permissions WHERE id = ?`,
            {
                replacements: [permission[0].id],
            }
        );
    }
}
