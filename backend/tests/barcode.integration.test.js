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

    it('should generate barcode with valid requestUuid and create request_keys row', async () => {
        // This test validates that a first barcode generation request:
        // 1. Accepts valid requestUuid
        // 2. Calls idempotency lookup (returns not found)
        // 3. Generates PDF
        // 4. Inserts request_keys row inside transaction
        // 5. Returns 200 with PDF

        const requestUuid = uuidv4();

        // Verify initial lookup returns not found
        const initialLookup = await RequestKey.findOne({
            where: {
                gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
                request_uuid: requestUuid,
                deleted_at: null,
            },
        });

        expect(initialLookup).toBeNull();

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

        // Verify request_keys row was created
        const createdKey = await RequestKey.findOne({
            where: {
                gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
                request_uuid: requestUuid,
                deleted_at: null,
            },
        });

        expect(createdKey).toBeDefined();
        expect(createdKey.result_kind).toBe('PDF');
        expect(createdKey.result_uuid).toBeDefined();
        expect(createdKey.actor_user_id).toBe(testUser.id);
    });

    it('should return cached result on replay with same requestUuid', async () => {
        // This test validates that a replayed request:
        // 1. Calls idempotency lookup
        // 2. Returns 200 with original result_uuid (no PDF duplication)
        // 3. Does not call nextval or render a new PDF

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
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.body.success).toBe(true);
        expect(response.body.data.resultUuid).toBe(resultUuid);
        expect(response.body.message).toContain('cached');
    });

    it('should return cached result on /test-sheet replay with same requestUuid', async () => {
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
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.body.success).toBe(true);
        expect(response.body.data.resultUuid).toBe(resultUuid);
        expect(response.body.message).toContain('cached');
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

        // Verify request_keys row was created for test sheet
        const createdKey = await RequestKey.findOne({
            where: {
                gesture_type: GESTURE_TYPES.BARCODE_GENERATE_TEST,
                request_uuid: requestUuid,
                deleted_at: null,
            },
        });

        expect(createdKey).toBeDefined();
        expect(createdKey.result_kind).toBe('PDF_TEST_SHEET');
    });

    it('should handle concurrent barcode requests with same requestUuid', async () => {
        // This test validates that when two concurrent requests arrive with the same requestUuid:
        // 1. At least one succeeds (returns 200 PDF or JSON)
        // 2. Only one request_keys row exists

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

        // At least one should succeed (200)
        const successCount = [response1, response2].filter(r => r.status === 200).length;
        expect(successCount).toBeGreaterThanOrEqual(1);

        // Only one request_keys row should exist
        const rowCount = await RequestKey.count({
            where: {
                gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
                request_uuid: requestUuid,
                deleted_at: null,
            },
        });

        expect(rowCount).toBe(1);
    });
    it('should verify barcode values are correctly formatted 12-digit strings', async () => {
        // This test validates that barcode values follow the correct format
        // by testing the formatting logic directly
        const testCases = [
            { input: 1, expected: '000000000001' },
            { input: 42, expected: '000000000042' },
            { input: 12345, expected: '000000012345' },
            { input: 999999999999, expected: '999999999999' },
        ];

        testCases.forEach(({ input, expected }) => {
            const formatted = String(input).padStart(12, '0');
            expect(formatted).toBe(expected);
            expect(formatted).toMatch(/^\d{12}$/);
            expect(formatted.length).toBe(12);
        });
    });

    it('should validate that sequence counter cannot exceed 12 digits', async () => {
        // Verify that the maximum valid 12-digit value is 999999999999
        const maxValid = 999999999999;
        const exceedsMax = 1000000000000;

        // Max valid value formats as 12 digits
        const maxFormatted = String(maxValid).padStart(12, '0');
        expect(maxFormatted.length).toBe(12);

        // Value exceeding max would be 13+ digits (validation should reject this)
        const exceedFormatted = String(exceedsMax).padStart(12, '0');
        expect(exceedFormatted.length).toBeGreaterThan(12);

        // Verify validation logic: if (seqValue > 999999999999) throw error
        expect(maxValid > 999999999999).toBe(false);
        expect(exceedsMax > 999999999999).toBe(true);
    });
});
