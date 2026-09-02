'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('colours', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },

        uuid: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            allowNull: false,
            unique: true,
        },

        name: {
            type: Sequelize.STRING(100),
            allowNull: false,
        },

        is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },

        deleted_at: {
            type: Sequelize.DATE,
            allowNull: true,
        },

        created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },

        updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
    });

    // AD-4: Partial unique index per rule — only active, non-deleted entries enforce uniqueness
    // Allows deactivated names to be reused per Story 2.2
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX idx_colours_name ON colours (name) WHERE deleted_at IS NULL AND is_active = true'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('colours');
}
