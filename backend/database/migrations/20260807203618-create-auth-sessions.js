import {DataTypes} from 'sequelize';

export async function up(queryInterface, Sequelize) {
    await queryInterface.createTable('auth_sessions', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
        },

        uuid: {
            type: Sequelize.UUID,
            allowNull: false,
            unique: true,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },

        refresh_token_hash: {
            type: Sequelize.TEXT,
            allowNull: false,
        },

        expires_at: {
            type: Sequelize.DATE,
            allowNull: false,
        },

        revoked_at: {
            type: Sequelize.DATE,
            allowNull: true,
        },

        last_used_at: {
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

    await queryInterface.addIndex('auth_sessions', ['user_id'], {
        name: 'auth_sessions_user_id_idx',
    });

    await queryInterface.addIndex('auth_sessions', ['expires_at'], {
        name: 'auth_sessions_expires_at_idx',
    });
}

export async function down(queryInterface) {
    await queryInterface.dropTable('auth_sessions');
}