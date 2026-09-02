import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const UserRole = sequelize.define(
        'UserRole',
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

            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'user_id',
            },

            roleId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'role_id',
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
            tableName: 'user_roles',
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    fields: ['user_id', 'role_id'],
                    unique: true,
                },
            ],
        }
    );

    return UserRole;
};