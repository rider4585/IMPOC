'use strict';

export async function up(queryInterface, Sequelize) {
    // ---- sales ----------------------------------------------------------
    await queryInterface.createTable('sales', {
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
        sale_number: {
            type: Sequelize.STRING(20),
            allowNull: false,
            unique: true,
        },
        customer_name: {
            type: Sequelize.STRING(255),
            allowNull: true,
        },
        sold_at: {
            type: Sequelize.DATEONLY,
            allowNull: false,
        },
        total_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },
        status: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'completed',
        },
        notes: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        created_by: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'users', key: 'id' },
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
        "ALTER TABLE sales ADD CONSTRAINT sales_status_check CHECK (status IN ('completed', 'cancelled', 'refunded'))"
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE sales ADD CONSTRAINT sales_total_paise_check CHECK (total_paise >= 0)'
    );

    // ---- sale_lines -----------------------------------------------------
    await queryInterface.createTable('sale_lines', {
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
        sale_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'sales', key: 'id' },
            onDelete: 'RESTRICT',
        },
        unit_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'units', key: 'id' },
            onDelete: 'RESTRICT',
        },
        unit_uuid: {
            type: Sequelize.UUID,
            allowNull: false,
        },
        barcode: {
            type: Sequelize.STRING(12),
            allowNull: false,
        },
        // Snapshot of the transacted price at checkout (AD-24 tier 1)
        selling_price_paise: {
            type: Sequelize.BIGINT,
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
        'ALTER TABLE sale_lines ADD CONSTRAINT sale_lines_selling_price_paise_check CHECK (selling_price_paise >= 0)'
    );

    // ---- sale_reversals (cancel/refund reversal records) ----------------
    await queryInterface.createTable('sale_reversals', {
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
        sale_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'sales', key: 'id' },
            onDelete: 'RESTRICT',
        },
        reversal_type: {
            type: Sequelize.STRING(20),
            allowNull: false,
        },
        amount_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },
        reason: {
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
        "ALTER TABLE sale_reversals ADD CONSTRAINT sale_reversals_reversal_type_check CHECK (reversal_type IN ('CANCEL', 'REFUND'))"
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE sale_reversals ADD CONSTRAINT sale_reversals_amount_paise_check CHECK (amount_paise >= 0)'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('sale_reversals');
    await queryInterface.dropTable('sale_lines');
    await queryInterface.dropTable('sales');
}
