import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const UpiAccount = sequelize.define(
        'UpiAccount',
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

            label: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },

            vpa: {
                type: DataTypes.STRING(255),
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
            tableName: 'upi_accounts',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return UpiAccount;
};
