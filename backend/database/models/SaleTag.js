import { DataTypes } from 'sequelize';

/**
 * R-73: sale_tags is the join table between a retail sale and the
 * transaction_tags picklist (exhibition/expo labels). Plain join row: no
 * soft-delete, so a tag link is either there or it never was.
 */
export default (sequelize) => {
    const SaleTag = sequelize.define(
        'SaleTag',
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

            transactionTagId: {
                type: DataTypes.INTEGER,
                field: 'transaction_tag_id',
                allowNull: false,
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
            tableName: 'sale_tags',
            timestamps: true,
            underscored: true,
            indexes: [
                { unique: true, fields: ['sale_id', 'transaction_tag_id'], name: 'uq_sale_tags_sale_tag' },
                { fields: ['transaction_tag_id'], name: 'idx_sale_tags_transaction_tag_id' },
            ],
        }
    );

    return SaleTag;
};