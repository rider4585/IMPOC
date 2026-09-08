import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const Role = sequelize.define(
        'Role',
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
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            isPrivileged: {
                type: DataTypes.BOOLEAN,
                field: 'is_privileged',
                allowNull: false,
                defaultValue: false,
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
            tableName: 'roles',
            timestamps: true,
            underscored: true,
        }
    );

    return Role;
};