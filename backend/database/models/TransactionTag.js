import { DataTypes } from 'sequelize';

/**
 * R-73: transaction_tags is a picklist the shop uses to label POS sales by
 * exhibition/expo, so they can later be filtered and grouped.
 *  - showOnPos: offer this tag in the POS checkout step
 *  - isDefault: preselect it in the POS checkout step
 */
export default (sequelize) => {
    const TransactionTag = sequelize.define(
        'TransactionTag',
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
                type: DataTypes.STRING(100),
                allowNull: false,
            },

            isActive: {
                type: DataTypes.BOOLEAN,
                field: 'is_active',
                allowNull: false,
                defaultValue: true,
            },

            showOnPos: {
                type: DataTypes.BOOLEAN,
                field: 'show_on_pos',
                allowNull: false,
                defaultValue: false,
            },

            isDefault: {
                type: DataTypes.BOOLEAN,
                field: 'is_default',
                allowNull: false,
                defaultValue: false,
            },

            deletedAt: {
                type: DataTypes.DATE,
                field: 'deleted_at',
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
            tableName: 'transaction_tags',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return TransactionTag;
};