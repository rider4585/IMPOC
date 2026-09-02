import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const Expense = sequelize.define(
        'Expense',
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

            amountPaise: {
                type: DataTypes.BIGINT,
                field: 'amount_paise',
                allowNull: false,
            },

            category: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },

            purpose: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            expenseDate: {
                type: DataTypes.DATEONLY,
                field: 'expense_date',
                allowNull: false,
            },

            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: 'completed',
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            createdBy: {
                type: DataTypes.INTEGER,
                field: 'created_by',
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
            tableName: 'expenses',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return Expense;
};
