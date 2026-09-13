import { DataTypes } from 'sequelize';

/** Named snapshot of a barcode sheet layout (R-56). `layout` holds the same fields as barcode_layouts. */
export default (sequelize) => {
    const BarcodeLayoutTemplate = sequelize.define(
        'BarcodeLayoutTemplate',
        {
            id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
            uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
            name: { type: DataTypes.STRING(100), allowNull: false },
            layout: { type: DataTypes.JSONB, allowNull: false },
            createdBy: { type: DataTypes.INTEGER, field: 'created_by', allowNull: true },
            deletedAt: { type: DataTypes.DATE, field: 'deleted_at' },
            createdAt: { type: DataTypes.DATE, field: 'created_at' },
            updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
        },
        { tableName: 'barcode_layout_templates', timestamps: true, underscored: true, paranoid: true }
    );
    return BarcodeLayoutTemplate;
};
