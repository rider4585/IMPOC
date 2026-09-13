'use strict';

/**
 * R-50: single-row table holding the barcode label-sheet layout (mm), replacing
 * the loose barcode_* keys in app_settings as the generator's source of truth.
 * CHECK (id = 1) enforces exactly one row. Seeded with today's sheet so output
 * is byte-for-byte unchanged until someone edits it on the Label layout page.
 */
const migration = {
    async up(queryInterface, Sequelize) {
        const mm = (v) => ({ type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: v });

        await queryInterface.createTable('barcode_layouts', {
            id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false },
            page_size: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'A4' },
            orientation: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'portrait' },
            columns: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
            rows: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 5 },
            margin_top_mm: mm(8),
            margin_right_mm: mm(8),
            margin_bottom_mm: mm(8),
            margin_left_mm: mm(8),
            gap_horizontal_mm: mm(5),
            gap_vertical_mm: mm(6),
            barcode_width_mm: mm(35),
            barcode_height_mm: mm(8),
            text_font_size_pt: mm(5),
            text_margin_top_mm: mm(1.4),
            show_text: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            label_padding_top_mm: mm(2.8),
            label_padding_bottom_mm: mm(2.1),
            label_padding_x_mm: mm(3.5),
            border_width_pt: mm(1),
            border_radius_mm: mm(0),
            show_divider: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            info_box_min_height_mm: mm(5),
            updated_by: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'SET NULL',
            },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        });

        await queryInterface.sequelize.query(
            'ALTER TABLE barcode_layouts ADD CONSTRAINT barcode_layouts_single_row CHECK (id = 1)',
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE barcode_layouts ADD CONSTRAINT barcode_layouts_page_size_check CHECK (page_size IN ('A4','A5','LETTER'))",
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE barcode_layouts ADD CONSTRAINT barcode_layouts_orientation_check CHECK (orientation IN ('portrait','landscape'))",
        );
        await queryInterface.sequelize.query(
            'ALTER TABLE barcode_layouts ADD CONSTRAINT barcode_layouts_grid_check CHECK (columns BETWEEN 1 AND 10 AND rows BETWEEN 1 AND 10)',
        );

        // Seed the one row with column defaults (= today's app_settings sheet).
        await queryInterface.sequelize.query('INSERT INTO barcode_layouts (id) VALUES (1)');
    },

    async down(queryInterface) {
        await queryInterface.dropTable('barcode_layouts');
    },
};

export const up = migration.up.bind(migration);
export const down = migration.down.bind(migration);
