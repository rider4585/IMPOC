'use strict';

export async function up(queryInterface, Sequelize) {
    // ---- sales ----
    await queryInterface.addColumn('sales', 'customer_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'customers', key: 'id' },
        onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('sales', 'customer_mobile', {
        type: Sequelize.STRING(30),
        allowNull: true,
    });

    // ---- rental_agreements ----
    await queryInterface.addColumn('rental_agreements', 'customer_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'customers', key: 'id' },
        onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('rental_agreements', 'customer_mobile', {
        type: Sequelize.STRING(30),
        allowNull: true,
    });
}

export async function down(queryInterface) {
    await queryInterface.removeColumn('sales', 'customer_id');
    await queryInterface.removeColumn('sales', 'customer_mobile');
    await queryInterface.removeColumn('rental_agreements', 'customer_id');
    await queryInterface.removeColumn('rental_agreements', 'customer_mobile');
}