'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('delivery_logs', {
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
        entity_type: {
            type: Sequelize.STRING(20),
            allowNull: false,
        },
        entity_id: {
            type: Sequelize.UUID,
            allowNull: false,
        },
        channel: {
            type: Sequelize.STRING(20),
            allowNull: false,
        },
        status: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'PENDING',
        },
        receipt_payload: {
            type: Sequelize.JSONB,
            allowNull: true,
        },
        provider_message_id: {
            type: Sequelize.STRING(255),
            allowNull: true,
        },
        provider: {
            type: Sequelize.STRING(50),
            allowNull: true,
        },
        sent_at: {
            type: Sequelize.DATE,
            allowNull: true,
        },
        delivered_at: {
            type: Sequelize.DATE,
            allowNull: true,
        },
        failed_at: {
            type: Sequelize.DATE,
            allowNull: true,
        },
        notes: {
            type: Sequelize.TEXT,
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

    await queryInterface.sequelize.query(
        "ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_entity_type_check CHECK (entity_type IN ('SALE', 'RENTAL', 'QUOTE', 'GENERAL'))"
    );
    await queryInterface.sequelize.query(
        "ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_channel_check CHECK (channel IN ('WHATSAPP', 'EMAIL', 'SMS', 'WHATSAPP_GROUP'))"
    );
    await queryInterface.sequelize.query(
        "ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_status_check CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'OPTED_OUT'))"
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('delivery_logs');
}
