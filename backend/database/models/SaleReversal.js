import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const SaleReversal = sequelize.define(
        'SaleReversal',
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

            saleId: {
                type: DataTypes.INTEGER,
                field: 'sale_id',
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
            tableName: 'sale_reversals',
            timestamps: true,
            underscored: true,
            paranoid: true,
            indexes: [
                {
                    fields: ['sale_id'],
                    unique: true,
                    name: 'uq_sale_reversals_refund_sale',
                    where: {
                        reversal_type: 'REFUND',
                        deleted_at: null,
                    },
                },
                {
                    fields: ['sale_id'],
                    unique: true,
                    name: 'uq_sale_reversals_cancel_sale',
                    where: {
                        reversal_type: 'CANCEL',
                        deleted_at: null,
                    },
                },
            ],
        }
    );

    return SaleReversal;
};
