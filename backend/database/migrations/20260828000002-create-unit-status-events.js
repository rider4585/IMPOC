'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('unit_status_events', {
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

        unit_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'units',
                key: 'id',
            },
            onDelete: 'RESTRICT',
        },

        from_status: {
            type: Sequelize.STRING(20),
            allowNull: true,
        },

        to_status: {
            type: Sequelize.STRING(20),
            allowNull: false,
        },

        cause: {
            type: Sequelize.STRING(50),
            allowNull: false,
        },

        reason: {
            type: Sequelize.TEXT,
            allowNull: true,
        },

        actor_user_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id',
            },
            onDelete: 'SET NULL',
        },

        occurred_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },

        sale_line_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },

        agreement_id: {
            type: Sequelize.INTEGER,
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

    // CHECK constraint: to_status must be valid unit status
    await queryInterface.sequelize.query(
        `ALTER TABLE unit_status_events ADD CONSTRAINT unit_status_events_to_status_check CHECK (to_status IN ('in_stock', 'sold', 'damaged', 'lost', 'in_maintenance', 'retired', 'rented'))`
    );

    // CHECK constraint: from_status must be valid unit status or null (null for initial creation)
    await queryInterface.sequelize.query(
        `ALTER TABLE unit_status_events ADD CONSTRAINT unit_status_events_from_status_check CHECK (from_status IS NULL OR from_status IN ('in_stock', 'sold', 'damaged', 'lost', 'in_maintenance', 'retired', 'rented'))`
    );

    // CHECK constraint: cause must be one of the valid causes
    await queryInterface.sequelize.query(
        `ALTER TABLE unit_status_events ADD CONSTRAINT unit_status_events_cause_check CHECK (cause IN ('INTAKE', 'STAFF_MARKED_DAMAGED', 'STAFF_MARKED_LOST', 'MAINTENANCE_COMPLETE', 'BEYOND_REPAIR', 'RECOVERY', 'CHECKOUT', 'EXCHANGE', 'HAND_OVER', 'RETURN', 'WRITE_OFF'))`
    );

    // CHECK constraint: sale_line_id XOR agreement_id (at most one can be set)
    await queryInterface.sequelize.query(
        `ALTER TABLE unit_status_events ADD CONSTRAINT unit_status_events_sale_or_agreement_xor CHECK ((sale_line_id IS NULL OR agreement_id IS NULL))`
    );

    // CHECK constraint: cause='RECOVERY' implies reason NOT NULL
    await queryInterface.sequelize.query(
        `ALTER TABLE unit_status_events ADD CONSTRAINT unit_status_events_recovery_reason_check CHECK (cause != 'RECOVERY' OR reason IS NOT NULL)`
    );

    // Index on unit_id for efficient status history queries
    await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_unit_status_events_unit_id ON unit_status_events (unit_id)'
    );

    // Index on created_at for chronological queries
    await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_unit_status_events_created_at ON unit_status_events (created_at DESC)'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('unit_status_events');
}
