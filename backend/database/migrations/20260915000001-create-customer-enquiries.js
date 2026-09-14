'use strict';

/**
 * R-63: customer enquiries — "do you have X?" requests taken at the counter.
 * One row per ask, always tied to a customer (created inline when new).
 * Closing is manual and has two outcomes: tell the customer the item is
 * available (NOTIFIED, notified_* filled) or close quietly (NOT_NOTIFIED).
 */
export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('customer_enquiries', {
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
        customer_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'customers', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
        },
        product_type_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'product_types', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
        colour_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'colours', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
        size_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'sizes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        notes: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        promised_date: {
            type: Sequelize.DATEONLY,
            allowNull: true,
        },
        status: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'OPEN',
        },
        notified_at: {
            type: Sequelize.DATE,
            allowNull: true,
        },
        notified_channels: {
            type: Sequelize.STRING(50),
            allowNull: true,
        },
        closed_at: {
            type: Sequelize.DATE,
            allowNull: true,
        },
        closed_reason: {
            type: Sequelize.STRING(30),
            allowNull: true,
        },
        closed_note: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        closed_by_user_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
        created_by_user_id: {
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
        `ALTER TABLE customer_enquiries
         ADD CONSTRAINT chk_customer_enquiries_status
         CHECK (status IN ('OPEN', 'CLOSED'))`
    );
    await queryInterface.sequelize.query(
        `ALTER TABLE customer_enquiries
         ADD CONSTRAINT chk_customer_enquiries_closed_reason
         CHECK (closed_reason IS NULL OR closed_reason IN ('NOTIFIED', 'NOT_NOTIFIED'))`
    );

    await queryInterface.addIndex('customer_enquiries', ['status', 'created_at'], {
        name: 'idx_customer_enquiries_status_created',
    });
    await queryInterface.addIndex('customer_enquiries', ['customer_id'], {
        name: 'idx_customer_enquiries_customer',
    });
    // Open asks by product type (for "N customers asked for this" hints later).
    await queryInterface.sequelize.query(
        `CREATE INDEX idx_customer_enquiries_open_product_type
         ON customer_enquiries (product_type_id)
         WHERE status = 'OPEN' AND deleted_at IS NULL`
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('customer_enquiries');
}
