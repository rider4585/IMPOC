import { DataTypes } from 'sequelize';

export const SNAPSHOT_ENTITY_TYPES = Object.freeze(['SALE', 'RENTAL']);

export default (sequelize) => {
    const ReceiptSnapshot = sequelize.define(
        'ReceiptSnapshot',
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

            entityType: {
                type: DataTypes.STRING(20),
                field: 'entity_type',
                allowNull: false,
                validate: { isIn: [SNAPSHOT_ENTITY_TYPES] },
            },

            entityUuid: {
                type: DataTypes.UUID,
                field: 'entity_uuid',
                allowNull: false,
            },

            templateId: {
                type: DataTypes.INTEGER,
                field: 'template_id',
                allowNull: false,
            },

            templateVersion: {
                type: DataTypes.INTEGER,
                field: 'template_version',
                allowNull: false,
            },

            renderedHtml: {
                type: DataTypes.TEXT,
                field: 'rendered_html',
                allowNull: false,
            },

            editorState: {
                type: DataTypes.JSONB,
                field: 'editor_state',
                allowNull: true,
            },

            renderedAt: {
                type: DataTypes.DATE,
                field: 'rendered_at',
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
            tableName: 'receipt_snapshots',
            timestamps: true,
            underscored: true,
            paranoid: true,
        }
    );

    return ReceiptSnapshot;
};
