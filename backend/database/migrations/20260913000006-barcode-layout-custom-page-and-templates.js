'use strict';

/**
 * R-56: custom page sizes + saved layout templates for the barcode sheet.
 *  - barcode_layouts.page_custom_width_mm / page_custom_height_mm (used when
 *    page_size = 'CUSTOM'); page_size check widened to A3/A4/A5/LETTER/CUSTOM.
 *  - barcode_layout_templates: named snapshots of a layout (JSONB), soft-deleted.
 */
const migration = {
    async up(queryInterface, Sequelize) {
        for (const [column, defaultValue] of [['page_custom_width_mm', 101.6], ['page_custom_height_mm', 152.4]]) {
            await queryInterface.addColumn('barcode_layouts', column, {
                type: Sequelize.DECIMAL(7, 2),
                allowNull: false,
                defaultValue,
            });
        }
        await queryInterface.sequelize.query(
            'ALTER TABLE barcode_layouts ADD CONSTRAINT barcode_layouts_custom_page_check CHECK (page_custom_width_mm BETWEEN 50 AND 2000 AND page_custom_height_mm BETWEEN 50 AND 2000)',
        );
        await queryInterface.sequelize.query('ALTER TABLE barcode_layouts DROP CONSTRAINT IF EXISTS barcode_layouts_page_size_check');
        await queryInterface.sequelize.query(
            "ALTER TABLE barcode_layouts ADD CONSTRAINT barcode_layouts_page_size_check CHECK (page_size IN ('A3','A4','A5','LETTER','CUSTOM'))",
        );

        await queryInterface.createTable('barcode_layout_templates', {
            id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
            uuid: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), allowNull: false, unique: true },
            name: { type: Sequelize.STRING(100), allowNull: false },
            layout: { type: Sequelize.JSONB, allowNull: false },
            created_by: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
            deleted_at: { type: Sequelize.DATE, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        });
        await queryInterface.sequelize.query(
            'CREATE UNIQUE INDEX idx_barcode_layout_templates_name ON barcode_layout_templates (lower(name)) WHERE deleted_at IS NULL',
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('barcode_layout_templates');
        await queryInterface.sequelize.query('ALTER TABLE barcode_layouts DROP CONSTRAINT IF EXISTS barcode_layouts_custom_page_check');
        await queryInterface.sequelize.query('ALTER TABLE barcode_layouts DROP CONSTRAINT IF EXISTS barcode_layouts_page_size_check');
        // A3 / CUSTOM did not exist before this migration: fall back to A4 so the old CHECK can be re-added.
        await queryInterface.sequelize.query("UPDATE barcode_layouts SET page_size = 'A4' WHERE page_size IN ('A3', 'CUSTOM')");
        await queryInterface.sequelize.query(
            "ALTER TABLE barcode_layouts ADD CONSTRAINT barcode_layouts_page_size_check CHECK (page_size IN ('A4','A5','LETTER'))",
        );
        await queryInterface.removeColumn('barcode_layouts', 'page_custom_width_mm');
        await queryInterface.removeColumn('barcode_layouts', 'page_custom_height_mm');
    },
};

export const up = migration.up.bind(migration);
export const down = migration.down.bind(migration);
