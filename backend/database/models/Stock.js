import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const Stock = sequelize.define(
        'Stock',
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
            },

            tripId: {
                type: DataTypes.INTEGER,
                field: 'trip_id',
                allowNull: false,
            },

            tripVendorId: {
                type: DataTypes.INTEGER,
                field: 'trip_vendor_id',
                allowNull: false,
            },

            vendorId: {
                type: DataTypes.INTEGER,
                field: 'vendor_id',
                allowNull: false,
            },

            productTypeId: {
                type: DataTypes.INTEGER,
                field: 'product_type_id',
                allowNull: false,
            },

            subTypeId: {
                type: DataTypes.INTEGER,
                field: 'sub_type_id',
                allowNull: true,
            },

            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            buyingPricePaise: {
                type: DataTypes.BIGINT,
                field: 'buying_price_paise',
                allowNull: false,
            },

            wholeBuyingPricePaise: {
                type: DataTypes.BIGINT,
                field: 'whole_buying_price_paise',
                allowNull: true,
            },

            // R-51: GST rates the vendor charged on this line (percent, e.g. 2.50)
            cgstRatePct: {
                type: DataTypes.DECIMAL(5, 2),
                field: 'cgst_rate_pct',
                allowNull: false,
                defaultValue: 0,
            },

            sgstRatePct: {
                type: DataTypes.DECIMAL(5, 2),
                field: 'sgst_rate_pct',
                allowNull: false,
                defaultValue: 0,
            },

            sellingPricePaise: {
                type: DataTypes.BIGINT,
                field: 'selling_price_paise',
                allowNull: false,
            },

            floorPricePaise: {
                type: DataTypes.BIGINT,
                field: 'floor_price_paise',
                allowNull: false,
            },

            channel: {
                type: DataTypes.STRING(50),
                allowNull: false,
            },

            rentPerDayPaise: {
                type: DataTypes.BIGINT,
                field: 'rent_per_day_paise',
                allowNull: true,
            },

            depositPaise: {
                type: DataTypes.BIGINT,
                field: 'deposit_paise',
                allowNull: true,
            },

            overduePerDayPaise: {
                type: DataTypes.BIGINT,
                field: 'overdue_per_day_paise',
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
            tableName: 'stocks',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return Stock;
};