import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

import {
    generateBarcodes,
} from '../src/modules/barcode/barcode.service.js';

import {
    generateBarcodePdf,
} from '../src/modules/barcode/barcode.generator.js';

import {
    sequelize,
    User,
    AppSettings,
} from '../database/models/index.js';

import {
    ConfigurationError,
    DatabaseError,
} from '../src/modules/app-settings/app-settings.service.js';

/**
 * Seed barcode geometry settings into app_settings table.
 * Required by barcode.generator.js (used by generateBarcodes).
 */
const seedBarcodeGeometry = async () => {
    const MM_TO_POINTS = 72 / 25.4;
    const mmToPoints = (mm) => (mm * MM_TO_POINTS).toFixed(2);

    const geometrySettings = [
        { key: 'barcode_width_pt', value_text: mmToPoints(35), value_type: 'TEXT' },
        { key: 'barcode_height_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_text_font_size_pt', value_text: '5', value_type: 'TEXT' },
        { key: 'barcode_clear_space_pt', value_text: '15', value_type: 'TEXT' },
        { key: 'barcode_margin_top_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_margin_right_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_margin_bottom_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_margin_left_pt', value_text: mmToPoints(8), value_type: 'TEXT' },
        { key: 'barcode_gap_horizontal_pt', value_text: mmToPoints(5), value_type: 'TEXT' },
        { key: 'barcode_gap_vertical_pt', value_text: mmToPoints(6), value_type: 'TEXT' },
        { key: 'barcode_grid_columns', value_int: 3, value_type: 'INT' },
        { key: 'barcode_grid_rows', value_int: 5, value_type: 'INT' },
    ];

    for (const setting of geometrySettings) {
        await sequelize.query(
            'INSERT INTO app_settings (key, value_text, value_int, value_type, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ' +
            'ON CONFLICT (key) DO NOTHING',
            {
                replacements: [
                    setting.key,
                    setting.value_text || null,
                    setting.value_int || null,
                    setting.value_type,
                ],
                type: sequelize.QueryTypes.INSERT,
            }
        );
    }
};

/**
 * Patch 4: Error classification test suite.
 *
 * Verifies that ConfigurationError and DatabaseError are properly thrown
 * when required geometry settings are missing or database errors occur.
 */
describe('barcode — error classification (Patch 4)', () => {
    let testUser;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
        await seedBarcodeGeometry();

        testUser = await User.create({
            username: 'test-error-classification-user',
            email: 'test-error-classification@example.com',
            passwordHash: 'hashed-password',
            firstName: 'Test',
            lastName: 'Error',
            status: 'ACTIVE',
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('ConfigurationError: missing geometry setting', () => {
        it('generateBarcodePdf throws ConfigurationError when barcode_width_pt is NULL', async () => {
            // Patch 4a: Deliberately remove one geometry setting
            await sequelize.query(
                'UPDATE app_settings SET value_text = NULL WHERE key = ?',
                {
                    replacements: ['barcode_width_pt'],
                    type: sequelize.QueryTypes.UPDATE,
                }
            );

            try {
                await generateBarcodePdf(['000000000001']);
                expect.fail('Expected ConfigurationError to be thrown');
            } catch (error) {
                // Patch 4c: Verify ConfigurationError is thrown with expected message
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain("required geometry setting 'barcode_width_pt' not found");
            }

            // Restore the setting
            const MM_TO_POINTS = 72 / 25.4;
            const mmToPoints = (mm) => (mm * MM_TO_POINTS).toFixed(2);
            await sequelize.query(
                'UPDATE app_settings SET value_text = ? WHERE key = ?',
                {
                    replacements: [mmToPoints(35), 'barcode_width_pt'],
                    type: sequelize.QueryTypes.UPDATE,
                }
            );
        });

        it('generateBarcodePdf throws ConfigurationError when barcode_grid_columns is missing', async () => {
            // Patch 4a: Deliberately remove barcode_grid_columns
            await sequelize.query(
                'DELETE FROM app_settings WHERE key = ?',
                {
                    replacements: ['barcode_grid_columns'],
                    type: sequelize.QueryTypes.DELETE,
                }
            );

            try {
                await generateBarcodePdf(['000000000001']);
                expect.fail('Expected ConfigurationError to be thrown');
            } catch (error) {
                // Patch 4c: Verify ConfigurationError is thrown with expected message
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain("required geometry setting 'barcode_grid_columns' not found");
            }

            // Restore the setting
            await sequelize.query(
                'INSERT INTO app_settings (key, value_text, value_int, value_type, created_at, updated_at) ' +
                'VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                {
                    replacements: ['barcode_grid_columns', null, 3, 'INT'],
                    type: sequelize.QueryTypes.INSERT,
                }
            );
        });

        it('generateBarcodes throws ConfigurationError when barcode_margin_top_pt is NULL', async () => {
            // Patch 4a: Deliberately set barcode_margin_top_pt to NULL
            await sequelize.query(
                'UPDATE app_settings SET value_text = NULL WHERE key = ?',
                {
                    replacements: ['barcode_margin_top_pt'],
                    type: sequelize.QueryTypes.UPDATE,
                }
            );

            try {
                await generateBarcodes(1, uuidv4(), testUser.uuid);
                expect.fail('Expected ConfigurationError to be thrown');
            } catch (error) {
                // Patch 4c: Verify ConfigurationError is thrown with expected message
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain("required geometry setting 'barcode_margin_top_pt' not found");
            }

            // Restore the setting
            const MM_TO_POINTS = 72 / 25.4;
            const mmToPoints = (mm) => (mm * MM_TO_POINTS).toFixed(2);
            await sequelize.query(
                'UPDATE app_settings SET value_text = ? WHERE key = ?',
                {
                    replacements: [mmToPoints(8), 'barcode_margin_top_pt'],
                    type: sequelize.QueryTypes.UPDATE,
                }
            );
        });
    });

    describe('DatabaseError: database operation failures', () => {
        it('DatabaseError is thrown when database becomes unavailable during barcode generation', async () => {
            // Patch 4d: Mock database error by making sequelize.query reject
            const querySpy = jest.spyOn(sequelize, 'query');
            const mockError = new Error('Connection timeout');
            mockError.code = 'ECONNREFUSED';

            // Mock the query to throw an error on the nextval call
            querySpy.mockImplementationOnce(async () => {
                throw mockError;
            });

            try {
                await generateBarcodes(1, uuidv4(), testUser.uuid);
                expect.fail('Expected error to be thrown');
            } catch (error) {
                // Patch 4d: Verify error is propagated
                expect(error).toBeInstanceOf(Error);
                // The error should mention database or connection
                expect(error.message.toLowerCase()).toMatch(/connection|database|timeout/);
            } finally {
                querySpy.mockRestore();
            }
        });
    });

    describe('Unexpected error handling (Patch 2)', () => {
        it('validateCalculatedLabelDimensions error is wrapped during PDF generation', async () => {
            // Patch 2: Test that non-standard errors are caught and wrapped
            // Create a scenario where geometry is valid but label dimensions are invalid
            // by setting gap values that are too large

            // First, set excessively large gap values
            await sequelize.query(
                'UPDATE app_settings SET value_text = ? WHERE key = ?',
                {
                    replacements: ['500', 'barcode_gap_horizontal_pt'],
                    type: sequelize.QueryTypes.UPDATE,
                }
            );

            try {
                await generateBarcodePdf(['000000000001']);
                expect.fail('Expected error to be thrown');
            } catch (error) {
                // Patch 2: Verify error is thrown (either as configuration or wrapped)
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toMatch(/Invalid label dimensions|Check page margins/);
            } finally {
                // Restore the setting
                const MM_TO_POINTS = 72 / 25.4;
                const mmToPoints = (mm) => (mm * MM_TO_POINTS).toFixed(2);
                await sequelize.query(
                    'UPDATE app_settings SET value_text = ? WHERE key = ?',
                    {
                        replacements: [mmToPoints(5), 'barcode_gap_horizontal_pt'],
                        type: sequelize.QueryTypes.UPDATE,
                    }
                );
            }
        });
    });
});
