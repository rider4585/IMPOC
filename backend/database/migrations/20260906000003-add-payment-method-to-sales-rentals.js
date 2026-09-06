'use strict';

/**
 * Record how the register accepted money (Cash / UPI / other picklist value)
 * on sales and rental agreements. Stored as a name snapshot so old receipts
 * survive picklist edits/deactivations.
 */
export async function up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sales', 'payment_method', {
        type: Sequelize.STRING(50),
        allowNull: true,
    });

    await queryInterface.addColumn('rental_agreements', 'payment_method', {
        type: Sequelize.STRING(50),
        allowNull: true,
    });
}

export async function down(queryInterface) {
    await queryInterface.removeColumn('rental_agreements', 'payment_method');
    await queryInterface.removeColumn('sales', 'payment_method');
}