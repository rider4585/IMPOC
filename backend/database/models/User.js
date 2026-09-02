import { DataTypes } from 'sequelize';

import { USER_STATUS } from '../../src/constants/user-status.js';

export default (sequelize) => {
    const User = sequelize.define(
        'User',
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            uuid: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                unique: true,
            },

            username: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
            },

            email: {
                type: DataTypes.STRING(255),
                allowNull: true,
                unique: true,
            },

            passwordHash: {
                type: DataTypes.TEXT,
                allowNull: false,
                field: 'password_hash',
            },

            firstName: {
                type: DataTypes.STRING(100),
                allowNull: false,
                field: 'first_name',
            },

            lastName: {
                type: DataTypes.STRING(100),
                allowNull: true,
                field: 'last_name',
            },

            phone: {
                type: DataTypes.STRING(20),
                allowNull: true,
            },

            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: USER_STATUS.ACTIVE,
            },

            lastLoginAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_login_at',
            },

            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: 'created_at',
            },

            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: 'updated_at',
            },
        },
        {
            tableName: 'users',
            timestamps: true,
            underscored: true,
        }
    );

    return User;
};