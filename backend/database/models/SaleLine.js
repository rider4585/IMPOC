import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const SaleLine = sequelize.define(
        'SaleLine',
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

            saleId: {
                type: DataTypes.INTEGER,
                field: 'sale_id',
                allowNull: false,
            },

            unitId: {
                type: DataTypes.INTEGER,
                field: 'unit_id',
                allowNull: false,
            },

            unitUuid: {
                type: DataTypes.UUID,
                field: 'unit_uuid',
                allowNull: false,
            },

            barcode: {
                type: DataTypes.STRING(12),
                allowNull: false,
            },

            sellingPricePaise: {
                type: DataTypes.BIGINT,
                field: 'selling_price_paise',
                allowNull: false,
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
            tableName: 'sale_lines',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return SaleLine;
};
