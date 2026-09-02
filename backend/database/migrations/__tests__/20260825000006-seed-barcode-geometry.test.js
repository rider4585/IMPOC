/**
 * Tests for the seed-barcode-geometry migration.
 *
 * Verifies:
 * 1. Migration up() seeds exactly 12 barcode geometry keys
 * 2. Migration down() deletes only the barcode geometry keys
 * 3. Migration down() does not affect non-barcode keys
 * 4. Migration is idempotent (re-running does not duplicate rows)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import seedBarcodeGeometry from '../20260825000006-seed-barcode-geometry.js';

// Mock sequelize utilities
const createMockQueryInterface = () => {
    const data = {};

    return {
        sequelize: {
            query: async (sql, options) => {
                if (sql.includes('INSERT INTO app_settings')) {
                    const { replacements } = options;
                    const [key, value_text, value_int, value_type] = replacements;
                    if (!data[key]) {
                        data[key] = { value_text, value_int, value_type };
                    }
                    return [];
                } else if (sql.includes('DELETE FROM app_settings')) {
                    const { replacements } = options;
                    replacements.forEach((key) => {
                        delete data[key];
                    });
                    return [];
                } else if (sql.includes('SELECT')) {
                    // For verification queries
                    return Object.entries(data).map(([key, value]) => ({
                        key,
                        ...value,
                    }));
                }
                return [];
            },
            QueryTypes: {
                INSERT: 'INSERT',
                DELETE: 'DELETE',
                SELECT: 'SELECT',
            },
        },
        tableExists: async () => true,
        getData: () => data,
    };
};

describe('20260825000006-seed-barcode-geometry migration', () => {
    it('should seed exactly 12 barcode geometry keys with correct values', async () => {
        const queryInterface = createMockQueryInterface();

        await seedBarcodeGeometry.up(queryInterface, {});

        const data = queryInterface.getData();
        const keys = Object.keys(data);

        // Verify exactly 12 keys are seeded
        expect(keys.length).toBe(12);

        // Verify all expected keys are present
        const expectedKeys = [
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

        expectedKeys.forEach((key) => {
            expect(data[key]).toBeDefined();
        });

        // Verify value types
        expect(data.barcode_grid_columns.value_type).toBe('INT');
        expect(data.barcode_grid_rows.value_type).toBe('INT');
        expect(data.barcode_width_pt.value_type).toBe('TEXT');
        expect(data.barcode_margin_top_pt.value_type).toBe('TEXT');

        // Verify sample values (rough range)
        const width = parseFloat(data.barcode_width_pt.value_text);
        const height = parseFloat(data.barcode_height_pt.value_text);
        expect(width).toBeCloseTo(99.21, 0);  // 35mm in points
        expect(height).toBeCloseTo(22.68, 0); // 8mm in points
    });

    it('should delete only barcode geometry keys, leaving other keys untouched', async () => {
        const queryInterface = createMockQueryInterface();

        // Seed migration first
        await seedBarcodeGeometry.up(queryInterface, {});

        // Manually add a non-barcode key
        const data = queryInterface.getData();
        data.some_other_setting = { value_text: 'foo', value_type: 'TEXT' };

        expect(Object.keys(data).length).toBe(13); // 12 barcode + 1 other

        // Run down migration
        await seedBarcodeGeometry.down(queryInterface, {});

        // Verify all barcode keys are deleted
        const updatedData = queryInterface.getData();
        const keys = Object.keys(updatedData);

        expect(keys.length).toBe(1);
        expect(keys[0]).toBe('some_other_setting');
        expect(updatedData.some_other_setting.value_text).toBe('foo');
    });

    it('should be idempotent (re-running up does not duplicate rows)', async () => {
        const queryInterface = createMockQueryInterface();

        // Run migration up
        await seedBarcodeGeometry.up(queryInterface, {});
        const data1 = { ...queryInterface.getData() };

        // Run migration up again
        await seedBarcodeGeometry.up(queryInterface, {});
        const data2 = queryInterface.getData();

        // Verify no duplicates (same number of keys)
        expect(Object.keys(data1).length).toBe(Object.keys(data2).length);

        // Verify values are unchanged
        Object.keys(data1).forEach((key) => {
            expect(data2[key]).toEqual(data1[key]);
        });
    });
});
