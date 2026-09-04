'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_templates', {
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

        vendor_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'vendors',
                key: 'id',
            },
            onDelete: 'RESTRICT',
        },

        product_type_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'product_types',
                key: 'id',
            },
            onDelete: 'RESTRICT',
        },

        name: {
            type: Sequelize.STRING(200),
            allowNull: true,
        },

        buying_price_paise: {
            type: Sequelize.BIGINT,
            allowNull: false,
        },

        default_quantity: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },

        default_selling_price_paise: {
            type: Sequelize.BIGINT,
            allowNull: true,
        },

        default_floor_price_paise: {
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

    await queryInterface.sequelize.query(
        'ALTER TABLE stock_templates ADD CONSTRAINT stock_templates_buying_price_check CHECK (buying_price_paise >= 0)'
    );

    await queryInterface.sequelize.query(
        'ALTER TABLE stock_templates ADD CONSTRAINT stock_templates_default_selling_price_check CHECK (default_selling_price_paise IS NULL OR default_selling_price_paise >= 0)'
    );

    await queryInterface.sequelize.query(
        'ALTER TABLE stock_templates ADD CONSTRAINT stock_templates_default_floor_price_check CHECK (default_floor_price_paise IS NULL OR default_floor_price_paise >= 0)'
    );

    // Partial unique index on (vendor_id, product_type_id, name) WHERE deleted_at IS NULL
    // Allows reusing a name after soft-delete while preventing active duplicates
    // NULL name disables the uniqueness guarantee (Postgres treats NULLs as distinct)
    await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_templates_vendor_product_name ON stock_templates (vendor_id, product_type_id, name) WHERE deleted_at IS NULL'
    );
}

export async function down(queryInterface) {
    await queryInterface.dropTable('stock_templates');
}