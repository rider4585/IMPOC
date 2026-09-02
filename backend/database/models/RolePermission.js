import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const RolePermission = sequelize.define(
        'RolePermission',
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

            roleId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'role_id',
            },

            permissionId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'permission_id',
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
            tableName: 'role_permissions',
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    fields: ['role_id', 'permission_id'],
                    unique: true,
                },
            ],
        }
    );

    return RolePermission;
};