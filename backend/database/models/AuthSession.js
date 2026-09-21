import {DataTypes} from 'sequelize';

export default (sequelize) => {
    const AuthSession = sequelize.define(
        'AuthSession',
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            uuid: {
                type: DataTypes.UUID,
                allowNull: false,
                unique: true,
                defaultValue: DataTypes.UUIDV4,
            },

            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'user_id',
            },

            refreshTokenHash: {
                type: DataTypes.TEXT,
                allowNull: false,
                field: 'refresh_token_hash',
            },

            expiresAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: 'expires_at',
            },

            revokedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'revoked_at',
            },

            lastUsedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_used_at',
            },

            ipAddress: {
                type: DataTypes.STRING(64),
                allowNull: true,
                field: 'ip_address',
            },

            userAgent: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'user_agent',
            },

            deviceType: {
                type: DataTypes.STRING(32),
                allowNull: true,
                field: 'device_type',
            },

            browser: {
                type: DataTypes.STRING(64),
                allowNull: true,
                field: 'browser',
            },

            os: {
                type: DataTypes.STRING(64),
                allowNull: true,
                field: 'os',
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
            tableName: 'auth_sessions',
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    fields: ['user_id'],
                    name: 'auth_sessions_user_id_idx',
                },
                {
                    fields: ['expires_at'],
                    name: 'auth_sessions_expires_at_idx',
                },
            ],
        }
    );

    return AuthSession;
};