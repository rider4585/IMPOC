import { DataTypes } from 'sequelize';

export const ENQUIRY_STATUSES = Object.freeze(['OPEN', 'CLOSED']);
export const ENQUIRY_CLOSE_REASONS = Object.freeze(['NOTIFIED', 'NOT_NOTIFIED']);
export const ENQUIRY_CHANNELS = Object.freeze(['WHATSAPP', 'EMAIL', 'SMS']);

export default (sequelize) => {
    const CustomerEnquiry = sequelize.define(
        'CustomerEnquiry',
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

            customerId: {
                type: DataTypes.INTEGER,
                field: 'customer_id',
                allowNull: false,
            },

            productTypeId: {
                type: DataTypes.INTEGER,
                field: 'product_type_id',
                allowNull: true,
            },

            colourId: {
                type: DataTypes.INTEGER,
                field: 'colour_id',
                allowNull: true,
            },

            sizeId: {
                type: DataTypes.INTEGER,
                field: 'size_id',
                allowNull: true,
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            promisedDate: {
                type: DataTypes.DATEONLY,
                field: 'promised_date',
                allowNull: true,
            },

            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: 'OPEN',
                validate: { isIn: [ENQUIRY_STATUSES] },
            },

            notifiedAt: {
                type: DataTypes.DATE,
                field: 'notified_at',
                allowNull: true,
            },

            notifiedChannels: {
                type: DataTypes.STRING(50),
                field: 'notified_channels',
                allowNull: true,
            },

            closedAt: {
                type: DataTypes.DATE,
                field: 'closed_at',
                allowNull: true,
            },

            closedReason: {
                type: DataTypes.STRING(30),
                field: 'closed_reason',
                allowNull: true,
            },

            closedNote: {
                type: DataTypes.TEXT,
                field: 'closed_note',
                allowNull: true,
            },

            closedByUserId: {
                type: DataTypes.INTEGER,
                field: 'closed_by_user_id',
                allowNull: true,
            },

            createdByUserId: {
                type: DataTypes.INTEGER,
                field: 'created_by_user_id',
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
            tableName: 'customer_enquiries',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return CustomerEnquiry;
};
