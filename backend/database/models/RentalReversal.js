import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const RentalReversal = sequelize.define(
        'RentalReversal',
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

            reversalType: {
                type: DataTypes.STRING(20),
                field: 'reversal_type',
                allowNull: false,
            },

            amountPaise: {
                type: DataTypes.BIGINT,
                field: 'amount_paise',
                allowNull: false,
            },

            reason: {
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
            tableName: 'rental_reversals',
            timestamps: true,
            underscored: true,
            paranoid: true,
            indexes: [
                {
                    fields: ['agreement_id'],
                    unique: true,
                    name: 'uq_rental_reversals_cancel_agreement',
                    where: {
                        reversal_type: 'CANCEL',
                        deleted_at: null,
                    },
                },
            ],
        }
    );

    return RentalReversal;
};
