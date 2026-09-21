'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.addColumn('auth_sessions', 'ip_address', {
        type: Sequelize.DataTypes.STRING(64),
        allowNull: true,
    });
    await queryInterface.addColumn('auth_sessions', 'user_agent', {
        type: Sequelize.DataTypes.TEXT,
        allowNull: true,
    });
    await queryInterface.addColumn('auth_sessions', 'device_type', {
        type: Sequelize.DataTypes.STRING(32),
        allowNull: true,
    });
    await queryInterface.addColumn('auth_sessions', 'browser', {
        type: Sequelize.DataTypes.STRING(64),
        allowNull: true,
    });
    await queryInterface.addColumn('auth_sessions', 'os', {
        type: Sequelize.DataTypes.STRING(64),
        allowNull: true,
    });
}

export async function down(queryInterface) {
    await queryInterface.removeColumn('auth_sessions', 'os');
    await queryInterface.removeColumn('auth_sessions', 'browser');
    await queryInterface.removeColumn('auth_sessions', 'device_type');
    await queryInterface.removeColumn('auth_sessions', 'user_agent');
    await queryInterface.removeColumn('auth_sessions', 'ip_address');
}

export default { up, down };
