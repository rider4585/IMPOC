'use strict';

export async function up(queryInterface, Sequelize) {
    // ---- rental_agreements ---------------------------------------------
    await queryInterface.createTable('rental_agreements', {
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
        agreement_number: {
            type: Sequelize.STRING(20),
            allowNull: false,
            unique: true,
        },
        customer_name: {
            type: Sequelize.STRING(255),
            allowNull: true,
        },
        start_date: {
            type: Sequelize.DATEONLY,
            allowNull: false,
        },
        due_date: {
            type: Sequelize.DATEONLY,
            allowNull: false,
        },
        // Snapshot of total deposit collected at hand-out (never mutated)
        deposit_refundable_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: 0,
        },
        status: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'active',
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
        "ALTER TABLE rental_agreements ADD CONSTRAINT rental_agreements_status_check CHECK (status IN ('active', 'completed', 'cancelled'))"
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE rental_agreements ADD CONSTRAINT rental_agreements_deposit_refundable_paise_check CHECK (deposit_refundable_paise >= 0)'
    );

    // ---- rental_lines ---------------------------------------------------
    await queryInterface.createTable('rental_lines', {
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
        agreement_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'rental_agreements', key: 'id' },
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
        // Snapshot of the rental pricing at hand-out (never mutated)
        rent_per_day_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },
        deposit_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },
        overdue_per_day_paise: {
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
        'ALTER TABLE rental_lines ADD CONSTRAINT rental_lines_rent_per_day_paise_check CHECK (rent_per_day_paise >= 0)'
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE rental_lines ADD CONSTRAINT rental_lines_deposit_paise_check CHECK (deposit_paise >= 0)'
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE rental_lines ADD CONSTRAINT rental_lines_overdue_per_day_paise_check CHECK (overdue_per_day_paise >= 0)'
    );

    // ---- rental_returns -------------------------------------------------
    await queryInterface.createTable('rental_returns', {
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
        agreement_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'rental_agreements', key: 'id' },
            onDelete: 'RESTRICT',
        },
        rental_line_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'rental_lines', key: 'id' },
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
        actual_return_date: {
            type: Sequelize.DATEONLY,
            allowNull: false,
        },
        // Damage grading at return (snapshot of grade; grade may be later edited)
        damage_grade_name: {
            type: Sequelize.STRING(100),
            allowNull: true,
        },
        damage_grade_outcome: {
            type: Sequelize.STRING(30),
            allowNull: true,
        },
        // Derived late days and charges snapshot at return time
        late_days: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        overdue_charge_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: 0,
        },
        damage_charge_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: 0,
        },
        // Deposit that is actually refunded (deposit - overdue - damage), min 0
        deposit_refunded_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: 0,
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
        "ALTER TABLE rental_returns ADD CONSTRAINT rental_returns_damage_grade_outcome_check CHECK (damage_grade_outcome IS NULL OR damage_grade_outcome IN ('RETURN_TO_STOCK', 'SEND_TO_MAINTENANCE', 'RETIRE'))"
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE rental_returns ADD CONSTRAINT rental_returns_late_days_check CHECK (late_days >= 0)'
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE rental_returns ADD CONSTRAINT rental_returns_overdue_charge_paise_check CHECK (overdue_charge_paise >= 0)'
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE rental_returns ADD CONSTRAINT rental_returns_damage_charge_paise_check CHECK (damage_charge_paise >= 0)'
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE rental_returns ADD CONSTRAINT rental_returns_deposit_refunded_paise_check CHECK (deposit_refunded_paise >= 0)'
    );

    // ---- rental_reversals ----------------------------------------------
    await queryInterface.createTable('rental_reversals', {
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
        agreement_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'rental_agreements', key: 'id' },
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
        "ALTER TABLE rental_reversals ADD CONSTRAINT rental_reversals_reversal_type_check CHECK (reversal_type IN ('CANCEL'))"
    );
    await queryInterface.sequelize.query(
        'ALTER TABLE rental_reversals ADD CONSTRAINT rental_reversals_amount_paise_check CHECK (amount_paise >= 0)'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('rental_reversals');
    await queryInterface.dropTable('rental_returns');
    await queryInterface.dropTable('rental_lines');
    await queryInterface.dropTable('rental_agreements');
}
