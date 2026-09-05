'use strict';

export async function up(queryInterface, Sequelize) {
    // Stock templates: optional subtype + whole (bulk) buying price
    await queryInterface.addColumn('stock_templates', 'sub_type_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: 'product_types',
            key: 'id',
        },
        onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('stock_templates', 'whole_buying_price_paise', {
        type: Sequelize.BIGINT,
        allowNull: true,
    });

    // Stocks: optional subtype + whole (bulk) buying price
    await queryInterface.addColumn('stocks', 'sub_type_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: 'product_types',
            key: 'id',
        },
        onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('stocks', 'whole_buying_price_paise', {
        type: Sequelize.BIGINT,
        allowNull: true,
    });

    // Indexes on sub_type_id for both tables
    await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_stock_templates_sub_type_id ON stock_templates (sub_type_id)'
    );

    await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_stocks_sub_type_id ON stocks (sub_type_id)'
    );
}

export async function down(queryInterface) {
    await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS idx_stock_templates_sub_type_id'
    );

    await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS idx_stocks_sub_type_id'
    );

    await queryInterface.removeColumn('stocks', 'whole_buying_price_paise');
    await queryInterface.removeColumn('stocks', 'sub_type_id');

    await queryInterface.removeColumn('stock_templates', 'whole_buying_price_paise');
    await queryInterface.removeColumn('stock_templates', 'sub_type_id');
}