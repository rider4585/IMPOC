'use strict';

/**
 * Seeder migration for barcode geometry configuration.
 *
 * Seeds app_settings table with all barcode layout dimensions.
 * Values are derived from BARCODE_TEST_CONFIG (A4, millimeter-based) and
 * converted to PDF points once at seed time.
 *
 * Conversion factor: MM_TO_POINTS = 72 / 25.4 ≈ 2.834645669291339
 *
 * All geometry values are stored as TEXT to preserve precision for point calculations.
 * Grid dimensions (columns, rows) are stored as INT.
 */

const MM_TO_POINTS = 72 / 25.4;

const mmToPoints = (mm) => (mm * MM_TO_POINTS).toFixed(2);

export async function up(queryInterface, Sequelize) {
    // Insert barcode geometry settings with idempotency (INSERT ... ON CONFLICT DO NOTHING)
    const geometrySettings = [
        // Barcode dimensions in points
        {
            key: 'barcode_width_pt',
            value_text: mmToPoints(35),  // 35mm (from CAP-1)
            value_type: 'TEXT',
        },
        {
            key: 'barcode_height_pt',
            value_text: mmToPoints(8),   // 8mm (from CAP-1)
            value_type: 'TEXT',
        },

        // Text and clear space in points (per spec)
        {
            key: 'barcode_text_font_size_pt',
            value_text: '5',              // 5pt
            value_type: 'TEXT',
        },
        {
            key: 'barcode_clear_space_pt',
            value_text: '15',             // 15pt
            value_type: 'TEXT',
        },

        // Page margins in points (from BARCODE_TEST_CONFIG: 8mm margins)
        {
            key: 'barcode_margin_top_pt',
            value_text: mmToPoints(8),
            value_type: 'TEXT',
        },
        {
            key: 'barcode_margin_right_pt',
            value_text: mmToPoints(8),
            value_type: 'TEXT',
        },
        {
            key: 'barcode_margin_bottom_pt',
            value_text: mmToPoints(8),
            value_type: 'TEXT',
        },
        {
            key: 'barcode_margin_left_pt',
            value_text: mmToPoints(8),
            value_type: 'TEXT',
        },

        // Grid gaps in points (from BARCODE_TEST_CONFIG)
        {
            key: 'barcode_gap_horizontal_pt',
            value_text: mmToPoints(5),    // 5mm horizontal
            value_type: 'TEXT',
        },
        {
            key: 'barcode_gap_vertical_pt',
            value_text: mmToPoints(6),    // 6mm vertical
            value_type: 'TEXT',
        },

        // Grid dimensions (from BARCODE_TEST_CONFIG: 3 columns, 5 rows)
        {
            key: 'barcode_grid_columns',
            value_int: 3,
            value_type: 'INT',
        },
        {
            key: 'barcode_grid_rows',
            value_int: 5,
            value_type: 'INT',
        },
    ];

    // Use raw SQL with ON CONFLICT for idempotency
    for (const setting of geometrySettings) {
        const { key, value_text, value_int, value_type } = setting;

        const sql = `
            INSERT INTO app_settings (key, value_text, value_int, value_type, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO NOTHING
        `;

        await queryInterface.sequelize.query(sql, {
            replacements: [key, value_text || null, value_int || null, value_type],
            type: queryInterface.sequelize.QueryTypes.INSERT,
        });
    }
}

export async function down(queryInterface, Sequelize) {
    // Remove all barcode geometry settings
    const keys = [
        'barcode_width_pt',
        'barcode_height_pt',
        'barcode_text_font_size_pt',
        'barcode_clear_space_pt',
        'barcode_margin_top_pt',
        'barcode_margin_right_pt',
        'barcode_margin_bottom_pt',
        'barcode_margin_left_pt',
        'barcode_gap_horizontal_pt',
        'barcode_gap_vertical_pt',
        'barcode_grid_columns',
        'barcode_grid_rows',
    ];

    const placeholders = keys.map(() => '?').join(', ');
    const sql = `DELETE FROM app_settings WHERE key IN (${placeholders})`;

    await queryInterface.sequelize.query(sql, {
        replacements: keys,
        type: queryInterface.sequelize.QueryTypes.DELETE,
    });
}
