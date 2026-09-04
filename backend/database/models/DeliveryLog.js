import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const DeliveryLog = sequelize.define(
        'DeliveryLog',
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

            entityType: {
                type: DataTypes.STRING(20),
                field: 'entity_type',
                allowNull: false,
            },

            entityId: {
                type: DataTypes.UUID,
                field: 'entity_id',
                allowNull: false,
            },

            channel: {
                type: DataTypes.STRING(20),
                allowNull: false,
            },

            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: 'PENDING',
            },

            receiptPayload: {
                type: DataTypes.JSONB,
                field: 'receipt_payload',
                allowNull: true,
            },

            providerMessageId: {
                type: DataTypes.STRING(255),
                field: 'provider_message_id',
                allowNull: true,
            },

            provider: {
                type: DataTypes.STRING(50),
                allowNull: true,
            },

            sentAt: {
                type: DataTypes.DATE,
                field: 'sent_at',
                allowNull: true,
            },

            deliveredAt: {
                type: DataTypes.DATE,
                field: 'delivered_at',
                allowNull: true,
            },

            failedAt: {
                type: DataTypes.DATE,
                field: 'failed_at',
                allowNull: true,
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            deletedAt: {
                type: DataTypes.DATE,
                field: 'deleted_at',
                allowNull: true,
            },

            createdAt: {
                type: DataTypes.DATE,
                field: 'created_at',
            },

            updatedAt: {
                type: DataTypes.DATE,
                field: 'updated_at',
            },
        },
        {
            tableName: 'delivery_logs',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return DeliveryLog;
};
