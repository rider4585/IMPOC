'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_intake_lines', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },

        uuid: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            allowNull: false,
        },

        stock_intake_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'stock_intakes',
                key: 'id',
            },
            onDelete: 'SET NULL',
        },

        product_type_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'product_types',
                key: 'id',
            },
        },

        quantity: {
            type: Sequelize.INTEGER,
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

        channel: {
            type: Sequelize.STRING(50),
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

    // CHECK constraint: quantity > 0
    await queryInterface.sequelize.query(
        'ALTER TABLE stock_intake_lines ADD CONSTRAINT stock_intake_lines_quantity_check CHECK (quantity > 0)'
    );

    // CHECK constraint: buying_price_paise >= 0
    await queryInterface.sequelize.query(
        'ALTER TABLE stock_intake_lines ADD CONSTRAINT stock_intake_lines_buying_price_paise_check CHECK (buying_price_paise >= 0)'
    );

    // CHECK constraint: selling_price_paise >= 0
    await queryInterface.sequelize.query(
        'ALTER TABLE stock_intake_lines ADD CONSTRAINT stock_intake_lines_selling_price_paise_check CHECK (selling_price_paise >= 0)'
    );

    // CHECK constraint: floor_price_paise >= 0 AND floor_price_paise <= selling_price_paise
    await queryInterface.sequelize.query(
        'ALTER TABLE stock_intake_lines ADD CONSTRAINT stock_intake_lines_floor_price_paise_check CHECK (floor_price_paise >= 0 AND floor_price_paise <= selling_price_paise)'
    );

    // CHECK constraint: channel is RETAIL or RENTAL
    await queryInterface.sequelize.query(
        "ALTER TABLE stock_intake_lines ADD CONSTRAINT stock_intake_lines_channel_check CHECK (channel IN ('RETAIL', 'RENTAL'))"
    );

    // CHECK constraint: rent_per_day_paise >= 0
    await queryInterface.sequelize.query(
        'ALTER TABLE stock_intake_lines ADD CONSTRAINT stock_intake_lines_rent_per_day_paise_check CHECK (rent_per_day_paise >= 0)'
    );

    // CHECK constraint: deposit_paise >= 0
    await queryInterface.sequelize.query(
        'ALTER TABLE stock_intake_lines ADD CONSTRAINT stock_intake_lines_deposit_paise_check CHECK (deposit_paise >= 0)'
    );

    // CHECK constraint: overdue_per_day_paise > 0 (for read-side division)
    await queryInterface.sequelize.query(
        'ALTER TABLE stock_intake_lines ADD CONSTRAINT stock_intake_lines_overdue_per_day_paise_check CHECK (overdue_per_day_paise > 0)'
    );

    // Partial unique index on (stock_intake_id, uuid) WHERE deleted_at IS NULL
    // Ensures uniqueness within a trip for non-deleted lines only
    // Global uuid uniqueness NOT enforced to allow restoration of soft-deleted lines
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_intake_lines_stock_intake_uuid ON stock_intake_lines (stock_intake_id, uuid) WHERE deleted_at IS NULL'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('stock_intake_lines');
}
