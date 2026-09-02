import {DataTypes} from 'sequelize';

export default (sequelize) => {
    const Permission = sequelize.define(
        'Permission',
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
                unique: true,
            },

            description: {
                type: DataTypes.TEXT,
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
            tableName: 'permissions',
            timestamps: true,
            underscored: true,
        }
    );

    return Permission;
};