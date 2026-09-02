import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const Unit = sequelize.define(
        'Unit',
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

            barcode: {
                type: DataTypes.STRING(12),
                allowNull: false,
            },

            stockIntakeLineId: {
                type: DataTypes.INTEGER,
                field: 'stock_intake_line_id',
                allowNull: false,
            },

            colourId: {
                type: DataTypes.INTEGER,
                field: 'colour_id',
                allowNull: false,
            },

            sizeId: {
                type: DataTypes.INTEGER,
                field: 'size_id',
                allowNull: false,
            },

            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: 'in_stock',
            },

            channel: {
                type: DataTypes.STRING(10),
                allowNull: false,
            },

            buyingPricePaise: {
                type: DataTypes.BIGINT,
                field: 'buying_price_paise',
                allowNull: false,
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
            tableName: 'units',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return Unit;
};
