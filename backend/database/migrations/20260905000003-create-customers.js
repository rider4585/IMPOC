'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('customers', {
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
            type: Sequelize.STRING(255),
            allowNull: false,
        },
        phone: {
            type: Sequelize.STRING(30),
            allowNull: true,
        },
        email: {
            type: Sequelize.STRING(255),
            allowNull: true,
        },
        dob: {
            type: Sequelize.DATEONLY,
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
        consent_whatsapp: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        consent_email: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        consent_sms: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        consent_whatsapp_group: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        consent_recorded_at: {
            type: Sequelize.DATE,
            allowNull: true,
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

    // Unique phone and email when present, while allowing multiple NULLs
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone) WHERE phone IS NOT NULL AND deleted_at IS NULL'
    );
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers (email) WHERE email IS NOT NULL AND deleted_at IS NULL'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('customers');
}
