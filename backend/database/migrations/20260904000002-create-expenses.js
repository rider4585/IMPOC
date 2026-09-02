'use strict';

export async function up(queryInterface, Sequelize) {
    // ---- expenses -------------------------------------------------------
    await queryInterface.createTable('expenses', {
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
        amount_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },
        category: {
            type: Sequelize.STRING(100),
            allowNull: false,
        },
        purpose: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        expense_date: {
            type: Sequelize.DATEONLY,
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
        "ALTER TABLE expenses ADD CONSTRAINT expenses_status_check CHECK (status IN ('completed', 'cancelled'))"
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE expenses ADD CONSTRAINT expenses_amount_paise_check CHECK (amount_paise >= 0)'
    );

    // ---- expense_reversals (cancellation reversal records) --------------
    await queryInterface.createTable('expense_reversals', {
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
        expense_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'expenses', key: 'id' },
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
        "ALTER TABLE expense_reversals ADD CONSTRAINT expense_reversals_reversal_type_check CHECK (reversal_type IN ('CANCEL'))"
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE expense_reversals ADD CONSTRAINT expense_reversals_amount_paise_check CHECK (amount_paise >= 0)'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('expense_reversals');
    await queryInterface.dropTable('expenses');
}
