import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const TripVendor = sequelize.define(
        'TripVendor',
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

            tripId: {
                type: DataTypes.INTEGER,
                field: 'trip_id',
                allowNull: false,
            },

            vendorId: {
                type: DataTypes.INTEGER,
                field: 'vendor_id',
                allowNull: false,
            },

            billReference: {
                type: DataTypes.STRING(100),
                field: 'bill_reference',
                allowNull: true,
            },

            totalPaidPaise: {
                type: DataTypes.BIGINT,
                field: 'total_paid_paise',
                allowNull: false,
            },

            // R-51: final CGST / SGST amounts printed at the bill subtotal.
            // totalPaidPaise is GST-inclusive; these are recorded, never reconciled.
            cgstPaise: {
                type: DataTypes.BIGINT,
                field: 'cgst_paise',
                allowNull: false,
                defaultValue: 0,
            },

            sgstPaise: {
                type: DataTypes.BIGINT,
                field: 'sgst_paise',
                allowNull: false,
                defaultValue: 0,
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            receiptImage: {
                type: DataTypes.TEXT,
                field: 'receipt_image',
                allowNull: true,
            },

            deletedAt: {
                type: DataTypes.DATE,
                field: 'deleted_at',
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
            tableName: 'trip_vendors',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return TripVendor;
};