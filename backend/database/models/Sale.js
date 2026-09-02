import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const Sale = sequelize.define(
        'Sale',
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

            saleNumber: {
                type: DataTypes.STRING(20),
                field: 'sale_number',
                allowNull: false,
                unique: true,
            },

            customerName: {
                type: DataTypes.STRING(255),
                field: 'customer_name',
                allowNull: true,
            },

            soldAt: {
                type: DataTypes.DATEONLY,
                field: 'sold_at',
                allowNull: false,
            },

            totalPaise: {
                type: DataTypes.BIGINT,
                field: 'total_paise',
                allowNull: false,
            },

            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: 'completed',
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            createdBy: {
                type: DataTypes.INTEGER,
                field: 'created_by',
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
            tableName: 'sales',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return Sale;
};
