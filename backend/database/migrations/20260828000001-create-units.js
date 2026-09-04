'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('units', {
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

        barcode: {
            type: Sequelize.STRING(12),
            allowNull: false,
        },

        stock_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'stocks',
                key: 'id',
            },
            onDelete: 'RESTRICT',
        },

        colour_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'colours',
                key: 'id',
            },
            onDelete: 'RESTRICT',
        },

        size_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'sizes',
                key: 'id',
            },
            onDelete: 'RESTRICT',
        },

        status: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'in_stock',
        },

        channel: {
            type: Sequelize.STRING(10),
            allowNull: false,
        },

        buying_price_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },

        selling_price_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },

        floor_price_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },

        rent_per_day_paise: {
            type: Sequelize.BIGINT,
            allowNull: true,
        },

        deposit_paise: {
            type: Sequelize.BIGINT,
            allowNull: true,
        },

        overdue_per_day_paise: {
            type: Sequelize.BIGINT,
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

    // Partial unique index on barcode WHERE deleted_at IS NULL
    // The only guard against double-binding (per spec AD-1)
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_units_barcode_unique ON units (barcode) WHERE deleted_at IS NULL'
    );

    // CHECK constraint: status must be valid unit status from unit-state-machine.md
    await queryInterface.sequelize.query(
        `ALTER TABLE units ADD CONSTRAINT units_status_check CHECK (status IN ('in_stock', 'sold', 'damaged', 'lost', 'in_maintenance', 'retired', 'rented'))`
    );

    // CHECK constraint: channel must be RETAIL or RENTAL (mirrored from stocks, AD-3)
    await queryInterface.sequelize.query(
        "ALTER TABLE units ADD CONSTRAINT units_channel_check CHECK (channel IN ('RETAIL', 'RENTAL'))"
    );

    // CHECK constraint: barcode must be 1-12 chars
    await queryInterface.sequelize.query(
        "ALTER TABLE units ADD CONSTRAINT units_barcode_length_check CHECK (LENGTH(barcode) >= 1 AND LENGTH(barcode) <= 12)"
    );

    // CHECK constraint: pricing columns must be >= 0
    await queryInterface.sequelize.query(
        'ALTER TABLE units ADD CONSTRAINT units_buying_price_paise_check CHECK (buying_price_paise >= 0)'
    );

    await queryInterface.sequelize.query(
        'ALTER TABLE units ADD CONSTRAINT units_selling_price_paise_check CHECK (selling_price_paise >= 0)'
    );

    await queryInterface.sequelize.query(
        'ALTER TABLE units ADD CONSTRAINT units_floor_price_paise_check CHECK (floor_price_paise >= 0)'
    );

    // Rental pricing columns: must be >= 0 if not null
    await queryInterface.sequelize.query(
        'ALTER TABLE units ADD CONSTRAINT units_rent_per_day_paise_check CHECK (rent_per_day_paise IS NULL OR rent_per_day_paise >= 0)'
    );

    await queryInterface.sequelize.query(
        'ALTER TABLE units ADD CONSTRAINT units_deposit_paise_check CHECK (deposit_paise IS NULL OR deposit_paise >= 0)'
    );

    await queryInterface.sequelize.query(
        'ALTER TABLE units ADD CONSTRAINT units_overdue_per_day_paise_check CHECK (overdue_per_day_paise IS NULL OR overdue_per_day_paise > 0)'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('units');
}