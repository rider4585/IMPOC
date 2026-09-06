'use strict';

/**
 * Record how the customer found the shop (Instagram / WhatsApp group posts /
 * pamphlet / other picklist value) on sales and rental agreements. Stored as a
 * name snapshot so old receipts survive picklist edits/deactivations.
 */
export async function up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sales', 'customer_source', {
        type: Sequelize.STRING(50),
        allowNull: true,
    });

    await queryInterface.addColumn('rental_agreements', 'customer_source', {
        type: Sequelize.STRING(50),
        allowNull: true,
    });
}

export async function down(queryInterface) {
    await queryInterface.removeColumn('rental_agreements', 'customer_source');
    await queryInterface.removeColumn('sales', 'customer_source');
}