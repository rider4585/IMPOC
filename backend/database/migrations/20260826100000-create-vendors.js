'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('vendors', {
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

        phone: {
            type: Sequelize.STRING,
            allowNull: true,
        },

        address: {
            type: Sequelize.TEXT,
            allowNull: true,
        },

        notes: {
            type: Sequelize.TEXT,
            allowNull: true,
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

    // Partial unique index on name WHERE deleted_at IS NULL
    // Allows reusing names after soft-delete while enforcing uniqueness on active vendors (per spec)
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX idx_vendors_name ON vendors (name) WHERE deleted_at IS NULL'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('vendors');
}
