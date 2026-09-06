import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const CustomerSource = sequelize.define(
        'CustomerSource',
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
            tableName: 'customer_sources',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return CustomerSource;
};