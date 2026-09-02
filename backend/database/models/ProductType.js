import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const ProductType = sequelize.define(
        'ProductType',
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

            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },

            parentId: {
                type: DataTypes.INTEGER,
                field: 'parent_id',
                allowNull: true,
            },

            isActive: {
                type: DataTypes.BOOLEAN,
                field: 'is_active',
                allowNull: false,
                defaultValue: true,
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
            tableName: 'product_types',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return ProductType;
};
