import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

import { generateBarcodes } from '../src/modules/barcode/barcode.service.js';
import { generateBarcodePdf } from '../src/modules/barcode/barcode.generator.js';

import {
    sequelize,
    User,
    BarcodeLayout,
} from '../database/models/index.js';

import { DEFAULT_LAYOUT } from '../src/modules/barcode-layouts/barcode-layout.geometry.js';

/**
 * Error classification for barcode generation.
 *
 * R-50 moved the sheet geometry from loose app_settings keys to the single
 * barcode_layouts row, so "missing geometry setting" can no longer happen —
 * a missing row is created from DEFAULT_LAYOUT. What remains:
 *  - a saved layout that cannot be printed -> clear "Cannot generate" error
 *  - database failures during generation -> propagated
 */
describe('barcode — error classification', () => {
    let testUser;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
        await sequelize.query(
            'CREATE SEQUENCE IF NOT EXISTS public.barcode_seq AS bigint INCREMENT BY 1 START WITH 1 NO CYCLE CACHE 1 OWNED BY NONE;'
        );
        testUser = await User.create({
            username: 'error-test-user',
            email: 'error-test@example.com',
            passwordHash: 'hashed',
            firstName: 'Error',
            lastName: 'Test',
            status: 'ACTIVE',
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('creates the default layout row when none exists and renders fine', async () => {
        expect(await BarcodeLayout.count()).toBe(0);
        const pdf = await generateBarcodePdf(['SHREE0000000001']);
        expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
        expect(await BarcodeLayout.count()).toBe(1);
    });

    it('throws a clear error when the saved layout cannot be printed', async () => {
        // Bypass the API validation and corrupt the row directly (e.g. a manual DB edit)
        await BarcodeLayout.update({ gapHorizontalMm: 500 }, { where: { id: 1 } });

        try {
            await expect(generateBarcodePdf(['SHREE0000000001'])).rejects.toThrow(/Cannot generate barcode sheet: .*does not fit/);
        } finally {
            await BarcodeLayout.update({ ...DEFAULT_LAYOUT }, { where: { id: 1 } });
        }
    });

    it('propagates a database failure during the sequence draw', async () => {
        const querySpy = jest.spyOn(sequelize, 'query');
        const mockError = new Error('Connection timeout');
        mockError.code = 'ECONNREFUSED';
        querySpy.mockImplementationOnce(async () => {
            throw mockError;
        });

        try {
            await expect(generateBarcodes(1, uuidv4(), testUser.uuid)).rejects.toThrow(/connection|database|timeout/i);
        } finally {
            querySpy.mockRestore();
        }
    });
});
