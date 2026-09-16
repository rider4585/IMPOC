'use strict';

/**
 * R-47: Receipt template versioning — receipt_templates + receipt_snapshots.
 * Templates hold the editable HTML/Unlayer editor state; snapshots freeze
 * the rendered output at the moment a sale or rental is completed.
 */
export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('receipt_templates', {
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
        entity_type: {
            type: Sequelize.STRING(20),
            allowNull: false,
        },
        version: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
        html_content: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        editor_state: {
            type: Sequelize.JSONB,
            allowNull: true,
        },
        is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        created_by: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
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
        `ALTER TABLE receipt_templates
         ADD CONSTRAINT chk_receipt_templates_entity_type
         CHECK (entity_type IN ('SALE', 'RENTAL', 'UNIVERSAL'))`
    );
    await queryInterface.sequelize.query(
        `ALTER TABLE receipt_templates
         ADD CONSTRAINT uq_receipt_templates_entity_type_version
         UNIQUE (entity_type, version)`
    );
    await queryInterface.addIndex('receipt_templates', ['entity_type', 'is_active'], {
        name: 'idx_receipt_templates_entity_type_active',
    });

    await queryInterface.createTable('receipt_snapshots', {
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
        entity_uuid: {
            type: Sequelize.UUID,
            allowNull: false,
        },
        template_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'receipt_templates', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
        },
        template_version: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        rendered_html: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        editor_state: {
            type: Sequelize.JSONB,
            allowNull: true,
        },
        rendered_at: {
            type: Sequelize.DATE,
            allowNull: false,
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
        `ALTER TABLE receipt_snapshots
         ADD CONSTRAINT chk_receipt_snapshots_entity_type
         CHECK (entity_type IN ('SALE', 'RENTAL'))`
    );
    await queryInterface.sequelize.query(
        `ALTER TABLE receipt_snapshots
         ADD CONSTRAINT uq_receipt_snapshots_entity_type_entity_uuid
         UNIQUE (entity_type, entity_uuid)`
    );
    await queryInterface.addIndex('receipt_snapshots', ['entity_type', 'entity_uuid'], {
        name: 'idx_receipt_snapshots_entity_type_entity_uuid',
    });
}

export async function down(queryInterface) {
    await queryInterface.dropTable('receipt_snapshots');
    await queryInterface.dropTable('receipt_templates');
}
