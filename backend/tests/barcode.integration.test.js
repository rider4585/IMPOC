import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

import app from '../app.js';

import {
    sequelize,
    User,
    Role,
    UserRole,
    RequestKey,
    Permission,
    RolePermission,
    AuthSession,
} from '../database/models/index.js';

import { GESTURE_TYPES } from '../src/constants/gesture-type.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';
import { formatBarcodeValue } from '../src/modules/barcode/barcode.service.js';
import { BARCODE_FORMAT } from '../src/modules/barcode/barcode.constants.js';

/**
 * Seed barcode geometry settings into app_settings table.
 * Required by Story 1.5: all barcode rendering depends on these values.
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

describe('Barcode Generation Integration Tests', () => {
    let testUser;
    let accessToken;
    let sessionUuid;

    beforeAll(async () => {
        // Initialize database
        await sequelize.sync({ force: true });

        // Seed barcode geometry settings (required by Story 1.5)
        await seedBarcodeGeometry();

        // Create test role with permission
        const testRole = await Role.create({
            name: 'TEST_ROLE',
            description: 'Test role for integration tests',
        });

        // Create permission
        const permission = await Permission.create({
            name: 'inventory.barcode_generate',
            description: 'Permission to generate barcodes',
        });

        // Assign permission to role
        await RolePermission.create({
            roleId: testRole.id,
            permissionId: permission.id,
        });

        // Create test user
        testUser = await User.create({
            username: 'test-barcode-user',
            email: 'test-barcode@example.com',
            passwordHash: 'hashed-password-123',
            firstName: 'Test',
            lastName: 'User',
            status: 'ACTIVE',
        });

        // Assign role to user
        await UserRole.create({
            userId: testUser.id,
            roleId: testRole.id,
        });

        // Create a mock auth session and generate token for testing
        const session = await AuthSession.create({
            userId: testUser.id,
            refreshTokenHash: 'mock-hash',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
        sessionUuid = session.uuid;

        // Generate access token for testing
        accessToken = generateAccessToken({
            userUuid: testUser.uuid,
            sessionUuid: sessionUuid,
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('should reject request without requestUuid with 400 validation error', async () => {
        // This test validates that requestUuid is required before any business logic runs
        const response = await request(app)
            .get('/api/barcodes/generate')
            .query({ pages: 1 })
            // No requestUuid provided
            .set('Authorization', `Bearer ${accessToken}`);

        // Should fail at validation with 400 (not 401 auth failure), before any
        // business logic (barcode allocation / PDF render) runs. The shared
        // error middleware (error.middleware.js) surfaces the first Zod issue's
        // own message rather than a generic "Validation" string, so assert on
        // the documented ZodError contract (400, success:false, field errors)
        // instead of message text.
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.length).toBeGreaterThan(0);
        expect(response.body.errors.some((e) => e.field === 'requestUuid')).toBe(true);
    });

    it('should reject request with invalid requestUuid format', async () => {
        // Invalid UUID format should be caught at validation
        const response = await request(app)
            .get('/api/barcodes/generate')
            .query({ pages: 1, requestUuid: 'not-a-uuid' })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((e) => e.field === 'requestUuid')).toBe(true);
    });

    it('should reject /test-sheet request without requestUuid with 400 validation error', async () => {
        const response = await request(app)
            .get('/api/barcodes/test-sheet')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((e) => e.field === 'requestUuid')).toBe(true);
    });

    it('should reject /test-sheet request with invalid requestUuid format', async () => {
        const response = await request(app)
            .get('/api/barcodes/test-sheet')
            .query({ requestUuid: 'invalid-uuid' })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((e) => e.field === 'requestUuid')).toBe(true);
    });

    it('should reject /generate request with non-numeric pages', async () => {
        const response = await request(app)
            .get('/api/barcodes/generate')
            .query({ pages: 'abc', requestUuid: uuidv4() })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((e) => e.field === 'pages')).toBe(true);
    });

    it('should reject /generate request with pages zero', async () => {
        const response = await request(app)
            .get('/api/barcodes/generate')
            .query({ pages: 0, requestUuid: uuidv4() })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((e) => e.field === 'pages')).toBe(true);
    });

    it('should reject /generate request with negative pages', async () => {
        const response = await request(app)
            .get('/api/barcodes/generate')
            .query({ pages: -5, requestUuid: uuidv4() })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors.some((e) => e.field === 'pages')).toBe(true);
    });

    it('should accept /generate request with valid numeric string pages', async () => {
        const requestUuid = uuidv4();

        const response = await request(app)
            .get('/api/barcodes/generate')
            .query({ pages: '5', requestUuid })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/pdf/);

        const pdfBuffer = response.body;
        expect(pdfBuffer).toBeInstanceOf(Buffer);
        expect(pdfBuffer.length).toBeGreaterThan(0);

        const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
        expect(pdfHeader).toBe('%PDF');
    });

    it('should generate barcode with valid requestUuid and not create a request_keys row', async () => {
        // This test validates that a first barcode generation request:
        // 1. Accepts valid requestUuid
        // 2. Generates PDF
        // 3. Writes NO request_keys row (idempotency removed, R-64)
        // 4. Returns 200 with PDF

        const requestUuid = uuidv4();

        // Call the barcode generation endpoint
        const response = await request(app)
            .get('/api/barcodes/generate')
            .query({ pages: 1, requestUuid })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/pdf/);

        // Verify PDF is readable (not corrupted)
        const pdfBuffer = response.body;
        expect(pdfBuffer).toBeInstanceOf(Buffer);
        expect(pdfBuffer.length).toBeGreaterThan(0);

        // Verify PDF header
        const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
        expect(pdfHeader).toBe('%PDF');

        // Verify NO request_keys row was created (R-64)
        const createdKey = await RequestKey.findOne({
            where: {
                gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
                request_uuid: requestUuid,
                deleted_at: null,
            },
        });

        expect(createdKey).toBeNull();
    });

    it('should stream a fresh PDF on replay with same requestUuid', async () => {
        // R-64: a pre-existing request_keys row must NOT cause a cached JSON
        // replay — every request streams a fresh PDF.

        const requestUuid = uuidv4();
        const resultUuid = uuidv4();

        // Pre-populate a request_keys row
        await RequestKey.create({
            gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
            request_uuid: requestUuid,
            result_kind: 'PDF',
            result_uuid: resultUuid,
            actor_user_id: testUser.id,
        });

        // Call the endpoint with same requestUuid
        const response = await request(app)
            .get('/api/barcodes/generate')
            .query({ pages: 1, requestUuid })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/pdf/);

        const pdfBuffer = response.body;
        expect(pdfBuffer).toBeInstanceOf(Buffer);
        expect(pdfBuffer.toString('ascii', 0, 4)).toBe('%PDF');
    });

    it('should stream a fresh PDF on /test-sheet replay with same requestUuid', async () => {
        const requestUuid = uuidv4();
        const resultUuid = uuidv4();

        // Pre-populate a request_keys row for test sheet
        await RequestKey.create({
            gesture_type: GESTURE_TYPES.BARCODE_GENERATE_TEST,
            request_uuid: requestUuid,
            result_kind: 'PDF_TEST_SHEET',
            result_uuid: resultUuid,
            actor_user_id: testUser.id,
        });

        // Call the test-sheet endpoint with same requestUuid
        const response = await request(app)
            .get('/api/barcodes/test-sheet')
            .query({ requestUuid })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/pdf/);

        const pdfBuffer = response.body;
        expect(pdfBuffer).toBeInstanceOf(Buffer);
        expect(pdfBuffer.toString('ascii', 0, 4)).toBe('%PDF');
    });

    it('should generate test sheet PDF with geometry from app_settings', async () => {
        // This test validates that the /test-sheet endpoint works correctly
        // with Story 1.5 geometry settings seeded in beforeAll.
        const requestUuid = uuidv4();

        const response = await request(app)
            .get('/api/barcodes/test-sheet')
            .query({ requestUuid })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/pdf/);

        // Verify PDF is readable
        const pdfBuffer = response.body;
        expect(pdfBuffer).toBeInstanceOf(Buffer);
        expect(pdfBuffer.length).toBeGreaterThan(0);

        // Verify PDF header
        const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
        expect(pdfHeader).toBe('%PDF');

        // Verify NO request_keys row was created for the test sheet (R-64)
        const createdKey = await RequestKey.findOne({
            where: {
                gesture_type: GESTURE_TYPES.BARCODE_GENERATE_TEST,
                request_uuid: requestUuid,
                deleted_at: null,
            },
        });

        expect(createdKey).toBeNull();
    });

    it('should handle concurrent barcode requests with same requestUuid', async () => {
        // R-64: both concurrent requests with the same requestUuid stream a
        // fresh PDF and write NO request_keys row (no idempotency).

        const requestUuid = uuidv4();

        // Send two concurrent requests with same requestUuid
        const [response1, response2] = await Promise.all([
            request(app)
                .get('/api/barcodes/generate')
                .query({ pages: 1, requestUuid })
                .set('Authorization', `Bearer ${accessToken}`),
            request(app)
                .get('/api/barcodes/generate')
                .query({ pages: 1, requestUuid })
                .set('Authorization', `Bearer ${accessToken}`),
        ]);

        // Both should succeed (200) with a fresh PDF
        for (const response of [response1, response2]) {
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/pdf/);
            const pdfBuffer = response.body;
            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.toString('ascii', 0, 4)).toBe('%PDF');
        }

        // No request_keys row should exist (R-64)
        const rowCount = await RequestKey.count({
            where: {
                gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
                request_uuid: requestUuid,
                deleted_at: null,
            },
        });

        expect(rowCount).toBe(0);
    });
    it('should format barcode values as SHREE + timestamp + counter (R-48)', () => {
        const nowMs = Date.UTC(2026, 8, 13, 5, 0, 0);
        const value = formatBarcodeValue(1, nowMs);

        expect(value).toMatch(/^SHREE[0-9A-Z]{6}[0-9A-Z]{4}$/);
        expect(value.length).toBe(BARCODE_FORMAT.length);
        expect(value.endsWith('0001')).toBe(true);
    });

    it('should keep barcode values unique across a sequence reset', () => {
        // Labels printed before a reset...
        const before = [1, 2, 3].map((seq) => formatBarcodeValue(seq, Date.UTC(2026, 8, 13, 5, 0, 0)));
        // ...and the same counter values drawn again one second later.
        const after = [1, 2, 3].map((seq) => formatBarcodeValue(seq, Date.UTC(2026, 8, 13, 5, 0, 1)));

        const all = new Set([...before, ...after]);
        expect(all.size).toBe(6);
    });
});
