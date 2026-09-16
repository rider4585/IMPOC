import { DataTypes } from 'sequelize';

export const TEMPLATE_ENTITY_TYPES = Object.freeze(['SALE', 'RENTAL', 'UNIVERSAL']);

export default (sequelize) => {
    const ReceiptTemplate = sequelize.define(
        'ReceiptTemplate',
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

            entityType: {
                type: DataTypes.STRING(20),
                field: 'entity_type',
                allowNull: false,
                validate: { isIn: [TEMPLATE_ENTITY_TYPES] },
            },

            version: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },

            htmlContent: {
                type: DataTypes.TEXT,
                field: 'html_content',
                allowNull: false,
            },

            editorState: {
                type: DataTypes.JSONB,
                field: 'editor_state',
                allowNull: true,
            },

            isActive: {
                type: DataTypes.BOOLEAN,
                field: 'is_active',
                allowNull: false,
                defaultValue: false,
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
            tableName: 'receipt_templates',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return ReceiptTemplate;
};
