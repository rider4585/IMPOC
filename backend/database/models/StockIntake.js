import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const StockIntake = sequelize.define(
        'StockIntake',
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

            vendorId: {
                type: DataTypes.INTEGER,
                field: 'vendor_id',
                allowNull: false,
            },

            purchasedOn: {
                type: DataTypes.DATEONLY,
                field: 'purchased_on',
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
            tableName: 'stock_intakes',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return StockIntake;
};
