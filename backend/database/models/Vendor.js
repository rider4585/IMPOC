import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const Vendor = sequelize.define(
        'Vendor',
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

            phone: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            address: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            notes: {
                type: DataTypes.TEXT,
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
            tableName: 'vendors',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return Vendor;
};
