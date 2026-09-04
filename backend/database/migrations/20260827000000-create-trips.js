'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('trips', {
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
            type: Sequelize.STRING(200),
            allowNull: false,
        },

        purchased_on: {
            type: Sequelize.DATEONLY,
            allowNull: false,
        },

        notes: {
            type: Sequelize.TEXT,
            allowNull: true,
        },

        status: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'active',
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

    // CHECK constraint: status must be 'active' or 'closed'
    await queryInterface.sequelize.query(
        "ALTER TABLE trips ADD CONSTRAINT trips_status_check CHECK (status IN ('active', 'closed'))"
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('trips');
}