import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

import {
    sequelize,
    User,
    Role,
    UserRole,
    RequestKey,
    Permission,
    RolePermission,
} from '../database/models/index.js';

import { GESTURE_TYPES } from '../src/constants/gesture-type.js';

describe('Barcode Idempotency - Concurrent Request Handling', () => {
    let testUser;
    let testRole;

    beforeAll(async () => {
        // Set up test user and role with permission
        await sequelize.sync({ force: true });

        // Create test role
        testRole = await Role.create({
            name: 'TEST_ROLE',
            description: 'Test role for idempotency tests',
        });

        // Create test user
        testUser = await User.create({
            username: 'test-user-idempotency',
            email: 'test-idempotency@example.com',
            passwordHash: 'hashed-password',
            firstName: 'Test',
            lastName: 'User',
            status: 'ACTIVE',
        });

        // Assign role to user
        await UserRole.create({
            userId: testUser.id,
            roleId: testRole.id,
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
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('should allow exactly one concurrent request to succeed with identical gesture_type and request_uuid', async () => {
        const requestUuid = uuidv4();
        const resultUuid1 = uuidv4();
        const resultUuid2 = uuidv4();

        // Each "request" runs its own transaction end-to-end (begin -> insert ->
        // commit, or rollback on failure) so the two run genuinely concurrently
        // via Promise.all, mirroring how two real HTTP requests would race.
        // Driving both transactions to an insert before either commits (as a
        // strictly sequential await chain would) deadlocks Postgres: the second
        // INSERT blocks waiting to see whether the first transaction's
        // conflicting row will actually be committed.
        const attempt = async (resultUuid) => {
            const transaction = await sequelize.transaction();
            try {
                await RequestKey.create(
                    {
                        gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
                        request_uuid: requestUuid,
                        result_kind: 'PDF',
                        result_uuid: resultUuid,
                        actor_user_id: testUser.id,
                    },
                    { transaction }
                );
                await transaction.commit();
                return { success: true, error: null };
            } catch (e) {
                await transaction.rollback();
                return { success: false, error: e };
            }
        };

        const [result1, result2] = await Promise.all([
            attempt(resultUuid1),
            attempt(resultUuid2),
        ]);

        const success1 = result1.success;
        const success2 = result2.success;
        const error1 = result1.error;
        const error2 = result2.error;

        // Verify exactly one succeeded and one failed
        const successCount = (success1 ? 1 : 0) + (success2 ? 1 : 0);
        expect(successCount).toBe(1); // Exactly one succeeded
        expect(error1 || error2).toBeDefined(); // At least one has an error

        // Verify only one row exists in the database
        const rowCount = await RequestKey.count({
            where: {
                gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
                request_uuid: requestUuid,
                deleted_at: null,
            },
        });

        expect(rowCount).toBe(1);
    });

    it('should return not-found on initial lookup and found on replay', async () => {
        const { lookup } = await import('../src/modules/idempotency/idempotency.service.js');

        const requestUuid = uuidv4();
        const resultUuid = uuidv4();

        // Initial lookup should return not found
        let result = await lookup(GESTURE_TYPES.BARCODE_GENERATE, requestUuid);
        expect(result.found).toBe(false);

        // Insert a request key
        const transaction = await sequelize.transaction();
        try {
            await RequestKey.create(
                {
                    gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
                    request_uuid: requestUuid,
                    result_kind: 'PDF',
                    result_uuid: resultUuid,
                    actor_user_id: testUser.id,
                },
                { transaction }
            );
            await transaction.commit();
        } catch (e) {
            await transaction.rollback();
            throw e;
        }

        // Replay lookup should return found with result info
        result = await lookup(GESTURE_TYPES.BARCODE_GENERATE, requestUuid);
        expect(result.found).toBe(true);
        expect(result.result_kind).toBe('PDF');
        expect(result.result_uuid).toBe(resultUuid);
    });

    it('should treat soft-deleted keys as not found', async () => {
        const { lookup } = await import('../src/modules/idempotency/idempotency.service.js');

        const requestUuid = uuidv4();
        const resultUuid = uuidv4();

        // Insert a request key
        const requestKey = await RequestKey.create({
            gesture_type: GESTURE_TYPES.BARCODE_GENERATE,
            request_uuid: requestUuid,
            result_kind: 'PDF',
            result_uuid: resultUuid,
            actor_user_id: testUser.id,
        });

        // Verify it's found
        let result = await lookup(GESTURE_TYPES.BARCODE_GENERATE, requestUuid);
        expect(result.found).toBe(true);

        // Soft delete the key
        await requestKey.update({ deleted_at: new Date() });

        // Lookup should now return not found
        result = await lookup(GESTURE_TYPES.BARCODE_GENERATE, requestUuid);
        expect(result.found).toBe(false);
    });
});
