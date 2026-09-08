import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const RentalReturn = sequelize.define(
        'RentalReturn',
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

            rentalLineId: {
                type: DataTypes.INTEGER,
                field: 'rental_line_id',
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

            actualReturnDate: {
                type: DataTypes.DATEONLY,
                field: 'actual_return_date',
                allowNull: false,
            },

            damageGradeName: {
                type: DataTypes.STRING(100),
                field: 'damage_grade_name',
                allowNull: true,
            },

            damageGradeOutcome: {
                type: DataTypes.STRING(30),
                field: 'damage_grade_outcome',
                allowNull: true,
            },

            lateDays: {
                type: DataTypes.INTEGER,
                field: 'late_days',
                allowNull: false,
                defaultValue: 0,
            },

            overdueChargePaise: {
                type: DataTypes.BIGINT,
                field: 'overdue_charge_paise',
                allowNull: false,
                defaultValue: 0,
            },

            damageChargePaise: {
                type: DataTypes.BIGINT,
                field: 'damage_charge_paise',
                allowNull: false,
                defaultValue: 0,
            },

            depositRefundedPaise: {
                type: DataTypes.BIGINT,
                field: 'deposit_refunded_paise',
                allowNull: false,
                defaultValue: 0,
            },

            notes: {
                type: DataTypes.TEXT,
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
            tableName: 'rental_returns',
            timestamps: true,
            underscored: true,
            paranoid: true,
            indexes: [
                {
                    fields: ['rental_line_id'],
                    unique: true,
                    name: 'uq_rental_returns_line',
                    where: {
                        deleted_at: null,
                    },
                },
            ],
        }
    );

    return RentalReturn;
};
