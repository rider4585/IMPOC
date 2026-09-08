'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.addColumn('roles', 'is_privileged', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    });

    await queryInterface.sequelize.query(
        `UPDATE roles SET is_privileged = TRUE WHERE name = 'ADMIN'`
    );
}

export async function down(queryInterface) {
    await queryInterface.removeColumn('roles', 'is_privileged');
}
