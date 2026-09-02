import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const RequestKey = sequelize.define(
        'RequestKey',
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            uuid: {
                type: DataTypes.UUID,
                allowNull: false,
                unique: true,
                defaultValue: DataTypes.UUIDV4,
            },

            gesture_type: {
                type: DataTypes.STRING(40),
                allowNull: false,
                field: 'gesture_type',
            },

            request_uuid: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'request_uuid',
            },

            result_kind: {
                type: DataTypes.STRING(40),
                allowNull: false,
                field: 'result_kind',
            },

            result_uuid: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'result_uuid',
            },

            actor_user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'actor_user_id',
            },

            deleted_at: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'deleted_at',
            },
        },
        {
            tableName: 'request_keys',
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    fields: ['gesture_type', 'request_uuid'],
                    unique: true,
                    name: 'request_keys_gesture_request',
                    where: {
                        deleted_at: null,
                    },
                },
            ],
        }
    );

    return RequestKey;
};
