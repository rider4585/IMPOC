import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const UnitStatusEvent = sequelize.define(
        'UnitStatusEvent',
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

            unitId: {
                type: DataTypes.INTEGER,
                field: 'unit_id',
                allowNull: false,
            },

            fromStatus: {
                type: DataTypes.STRING(20),
                field: 'from_status',
                allowNull: true,
            },

            toStatus: {
                type: DataTypes.STRING(20),
                field: 'to_status',
                allowNull: false,
            },

            cause: {
                type: DataTypes.STRING(50),
                allowNull: false,
            },

            reason: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            actorUserId: {
                type: DataTypes.INTEGER,
                field: 'actor_user_id',
                allowNull: true,
            },

            occurredAt: {
                type: DataTypes.DATE,
                field: 'occurred_at',
                allowNull: false,
            },

            saleLineId: {
                type: DataTypes.INTEGER,
                field: 'sale_line_id',
                allowNull: true,
            },

            agreementId: {
                type: DataTypes.INTEGER,
                field: 'agreement_id',
                allowNull: true,
            },

            deletedAt: {
                type: DataTypes.DATE,
                field: 'deleted_at',
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
            tableName: 'unit_status_events',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return UnitStatusEvent;
};
