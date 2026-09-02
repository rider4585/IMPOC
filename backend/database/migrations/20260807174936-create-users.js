'use strict';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
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

        username: {
            type: Sequelize.STRING(50),
            allowNull: false,
            unique: true,
        },

        email: {
            type: Sequelize.STRING(255),
            allowNull: true,
            unique: true,
        },

        password_hash: {
            type: Sequelize.TEXT,
            allowNull: false,
        },

        first_name: {
            type: Sequelize.STRING(100),
            allowNull: false,
        },

        last_name: {
            type: Sequelize.STRING(100),
            allowNull: true,
        },

        phone: {
            type: Sequelize.STRING(20),
            allowNull: true,
        },

        status: {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'ACTIVE',
        },

        last_login_at: {
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

    await queryInterface.addConstraint('users', {
        fields: ['status'],
        type: 'check',
        name: 'users_status_check',
        where: {
            status: {
                [Sequelize.Op.in]: [
                    'ACTIVE',
                    'INACTIVE',
                    'SUSPENDED',
                    'DELETED',
                ],
            },
        },
    });
}

export async function down(queryInterface) {
    await queryInterface.dropTable('users');
}