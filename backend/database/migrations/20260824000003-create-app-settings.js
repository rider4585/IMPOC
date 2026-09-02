'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_settings', {
        key: {
            type: Sequelize.STRING(255),
            primaryKey: true,
            allowNull: false,
        },

        value_text: {
            type: Sequelize.TEXT,
            allowNull: true,
        },

        value_int: {
            type: Sequelize.BIGINT,
            allowNull: true,
        },

        value_type: {
            type: Sequelize.STRING(20),
            allowNull: false,
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

    // Add CHECK constraint to restrict value_type to TEXT and INT only
    await queryInterface.sequelize.query(
        `ALTER TABLE app_settings ADD CONSTRAINT app_settings_value_type_check CHECK (value_type IN ('TEXT', 'INT'))`
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('app_settings');
}
