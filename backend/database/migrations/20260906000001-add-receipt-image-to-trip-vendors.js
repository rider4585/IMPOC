'use strict';

export async function up(queryInterface, Sequelize) {
    // Optional bill receipt photo (base64 data-URI) attached to a trip-vendor bill
    await queryInterface.addColumn('trip_vendors', 'receipt_image', {
        type: Sequelize.TEXT,
        allowNull: true,
    });
}

export async function down(queryInterface) {
    await queryInterface.removeColumn('trip_vendors', 'receipt_image');
}