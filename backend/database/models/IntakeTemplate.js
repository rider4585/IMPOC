import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const IntakeTemplate = sequelize.define(
        'IntakeTemplate',
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

            intakeRecordId: {
                type: DataTypes.INTEGER,
                field: 'intake_record_id',
                allowNull: false,
            },

            name: {
                type: DataTypes.STRING(200),
                allowNull: true,
            },

            productTypeId: {
                type: DataTypes.INTEGER,
                field: 'product_type_id',
                allowNull: false,
            },

            buyingPricePaise: {
                type: DataTypes.BIGINT,
                field: 'buying_price_paise',
                allowNull: false,
            },

            defaultQuantity: {
                type: DataTypes.INTEGER,
                field: 'default_quantity',
                allowNull: true,
            },

            defaultSellingPricePaise: {
                type: DataTypes.BIGINT,
                field: 'default_selling_price_paise',
                allowNull: true,
            },

            defaultFloorPricePaise: {
                type: DataTypes.BIGINT,
                field: 'default_floor_price_paise',
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
            tableName: 'intake_templates',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return IntakeTemplate;
};
