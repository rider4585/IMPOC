import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

import {
    generateBarcodes,
    generateBarcodeTestSheet,
} from '../src/modules/barcode/barcode.service.js';

import {
    sequelize,
    User,
    RequestKey,
    AppSettings,
} from '../database/models/index.js';

/**
 * Seed barcode geometry settings into app_settings table.
 * Required by barcode.generator.js (used by generateBarcodes) — mirrors the
 * helper in barcode.integration.test.js.
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
 * Regression coverage for the transaction-wiring fix in barcode.service.js:
 * User.findOne(...) must receive `transaction` inside its single options
 * object — the same way the raw nextval() query does — rather than as a
 * second, silently-ignored positional argument.
 *
 * Sequelize's Model.findOne(options) only ever reads one argument. Passing
 * `User.findOne({ where, attributes }, { transaction })` compiles and runs
 * without error, but the lookup executes on a connection outside the
 * gesture's transaction, breaking the "all gesture work commits or rolls
 * back together" guarantee (see
 * spec-1-4-create-request-keys-table-and-idempotency-helper.md, Design
 * Notes: "Transaction ordering (critical)"). No prior test caught this: the
 * concurrency test in barcode.idempotency.test.js never calls the real
 * service functions, and the HTTP integration test can't observe which
 * connection a read used.
 *
 * These tests spy on the real Sequelize calls (letting them run against the
 * test database) and assert the transaction instance is identical across
 * User.findOne and — for generateBarcodes — the nextval draw. They also pin
 * R-64: barcode generation no longer writes a request_keys row at all, so
 * RequestKey.create must never be called. If the fix is reverted,
 * findOneOptions.transaction is undefined and the `.toBe(transaction)`
 * assertions fail.
 */
describe('barcode.service — gesture transaction wiring', () => {
    let testUser;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
        await seedBarcodeGeometry();

        testUser = await User.create({
            username: 'test-barcode-service-user',
            email: 'test-barcode-service@example.com',
            passwordHash: 'hashed-password',
            firstName: 'Test',
            lastName: 'Service',
            status: 'ACTIVE',
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('generateBarcodes: User.findOne and the nextval draw run in the same transaction; no request_keys write (R-64)', async () => {
        const findOneSpy = jest.spyOn(User, 'findOne');
        const createSpy = jest.spyOn(RequestKey, 'create');
        const querySpy = jest.spyOn(sequelize, 'query');

        const result = await generateBarcodes(1, uuidv4(), testUser.uuid);

        expect(findOneSpy).toHaveBeenCalledTimes(1);
        expect(createSpy).not.toHaveBeenCalled();

        // User.findOne must be called with a single options object carrying
        // `transaction` — not a second positional argument (which Sequelize
        // silently ignores).
        const findOneCall = findOneSpy.mock.calls[0];
        expect(findOneCall).toHaveLength(1);
        const findOneOptions = findOneCall[0];
        const transaction = findOneOptions.transaction;

        const nextvalCall = querySpy.mock.calls.find(
            (call) => typeof call[0] === 'string' && call[0].includes('nextval')
        );
        expect(nextvalCall).toBeDefined();
        const nextvalOptions = nextvalCall[1];

        expect(transaction).toBeDefined();
        expect(findOneOptions.transaction).toBe(transaction);
        expect(nextvalOptions.transaction).toBe(transaction);

        // Always a fresh PDF — no resultUuid marker (R-64).
        expect(result).toHaveProperty('pdfBuffer');
        expect(result).not.toHaveProperty('resultUuid');
    });

    it('generateBarcodeTestSheet: User.findOne runs inside the transaction; no request_keys write (R-64)', async () => {
        const findOneSpy = jest.spyOn(User, 'findOne');
        const createSpy = jest.spyOn(RequestKey, 'create');

        const result = await generateBarcodeTestSheet(uuidv4(), testUser.uuid);

        expect(findOneSpy).toHaveBeenCalledTimes(1);
        expect(createSpy).not.toHaveBeenCalled();

        const findOneCall = findOneSpy.mock.calls[0];
        expect(findOneCall).toHaveLength(1);
        const findOneOptions = findOneCall[0];

        expect(findOneOptions.transaction).toBeDefined();

        expect(result).toHaveProperty('pdfBuffer');
        expect(result).not.toHaveProperty('resultUuid');
    });

    it('pg pool config: money column (INT app_setting) reads from database as JavaScript number, not string', async () => {
        // Regression guard for AD-43: verify that the pg pool is configured to parse
        // PostgreSQL int8 (BIGINT) columns as JavaScript numbers, not strings.
        // This test fails if the pool config is removed or reverted.
        const setting = await AppSettings.findOne({
            where: { key: 'barcode_grid_columns' },
            raw: true,
        });

        expect(setting).toBeDefined();
        expect(setting.value_int).toBeDefined();
        expect(typeof setting.value_int).toBe('number');
        expect(setting.value_int).toBe(3);
    });
});
