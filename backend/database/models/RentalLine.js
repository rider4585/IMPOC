import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const RentalLine = sequelize.define(
        'RentalLine',
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

            agreementId: {
                type: DataTypes.INTEGER,
                field: 'agreement_id',
                allowNull: false,
            },

            unitId: {
                type: DataTypes.INTEGER,
                field: 'unit_id',
                allowNull: false,
            },

            unitUuid: {
                type: DataTypes.UUID,
                field: 'unit_uuid',
                allowNull: false,
            },

            barcode: {
                type: DataTypes.STRING(32),
                allowNull: false,
            },

            rentPerDayPaise: {
                type: DataTypes.BIGINT,
                field: 'rent_per_day_paise',
                allowNull: false,
            },

            depositPaise: {
                type: DataTypes.BIGINT,
                field: 'deposit_paise',
                allowNull: false,
            },

            overduePerDayPaise: {
                type: DataTypes.BIGINT,
                field: 'overdue_per_day_paise',
                allowNull: false,
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
            tableName: 'rental_lines',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return RentalLine;
};
