import request from 'supertest';
import app from '../../../../app.js';
import * as db from '../../../../database/models/index.js';
import {
    initializeTestDatabase,
    closeDatabase,
    generateTestUser,
} from '../../../../tests/utils/test-setup.js';
import argon2 from 'argon2';

describe('Admin Sessions Module - /api/admin/sessions', () => {
    let adminToken;
    let adminUser;
    let cashierToken;
    let cashierUser;
    let testTargetUser;

    beforeAll(async () => {
        await initializeTestDatabase();

        // 1. Create Admin User (holds users.view and users.update via ADMIN role)
        const adminData = generateTestUser({ password: 'AdminPassword123!' });
        adminUser = await db.User.create({
            username: adminData.username,
            email: adminData.email,
            firstName: adminData.firstName,
            lastName: adminData.lastName,
            passwordHash: await argon2.hash(adminData.password),
        });
        const adminRole = await db.Role.findOne({ where: { name: 'ADMIN' } });
        await adminUser.addRole(adminRole);

        // 2. Create Cashier User (lacks users.view and users.update)
        const cashierData = generateTestUser({ password: 'CashierPassword123!' });
        cashierUser = await db.User.create({
            username: cashierData.username,
            email: cashierData.email,
            firstName: cashierData.firstName,
            lastName: cashierData.lastName,
            passwordHash: await argon2.hash(cashierData.password),
        });
        const cashierRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
        await cashierUser.addRole(cashierRole);

        // 3. Create target user for revocation tests
        const targetData = generateTestUser({ password: 'TargetPassword123!' });
        testTargetUser = await db.User.create({
            username: targetData.username,
            email: targetData.email,
            firstName: targetData.firstName,
            lastName: targetData.lastName,
            passwordHash: await argon2.hash(targetData.password),
        });
        await testTargetUser.addRole(cashierRole);

        // Login Admin
        const adminLoginRes = await request(app)
            .post('/api/auth/login')
            .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')
            .set('X-Forwarded-For', '192.168.1.50')
            .send({
                username: adminData.username,
                password: adminData.password,
            });
        expect(adminLoginRes.status).toBe(200);
        adminToken = adminLoginRes.body.data.accessToken;

        // Login Cashier
        const cashierLoginRes = await request(app)
            .post('/api/auth/login')
            .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1')
            .set('X-Forwarded-For', '10.0.0.25')
            .send({
                username: cashierData.username,
                password: cashierData.password,
            });
        expect(cashierLoginRes.status).toBe(200);
        cashierToken = cashierLoginRes.body.data.accessToken;

        // Login Target User twice (to have multiple sessions)
        await request(app)
            .post('/api/auth/login')
            .set('User-Agent', 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')
            .set('X-Forwarded-For', '172.16.0.10')
            .send({
                username: targetData.username,
                password: targetData.password,
            });

        await request(app)
            .post('/api/auth/login')
            .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0')
            .set('X-Forwarded-For', '172.16.0.11')
            .send({
                username: targetData.username,
                password: targetData.password,
            });
    });

    afterAll(async () => {
        await closeDatabase();
    });

    describe('RBAC & Authentication', () => {
        it('returns 401 unauthenticated when no token is provided', async () => {
            const res = await request(app).get('/api/admin/sessions');
            expect(res.status).toBe(401);
        });

        it('returns 403 unauthorized when user lacks users.view permission', async () => {
            const res = await request(app)
                .get('/api/admin/sessions')
                .set('Authorization', `Bearer ${cashierToken}`);
            expect(res.status).toBe(403);
        });

        it('returns 403 unauthorized when user lacks users.update permission for revocation', async () => {
            const res = await request(app)
                .delete('/api/admin/sessions/some-uuid')
                .set('Authorization', `Bearer ${cashierToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/admin/sessions', () => {
        it('returns sessions list and telemetry stats for authorized admin', async () => {
            const res = await request(app)
                .get('/api/admin/sessions')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();

            const { sessions, stats } = res.body.data;
            expect(Array.isArray(sessions)).toBe(true);
            expect(sessions.length).toBeGreaterThanOrEqual(4);

            // Verify stats structure
            expect(stats).toBeDefined();
            expect(typeof stats.activeSessions).toBe('number');
            expect(typeof stats.uniqueUsersCount).toBe('number');
            expect(stats.deviceBreakdown).toBeDefined();
            expect(typeof stats.deviceBreakdown.desktop).toBe('number');
            expect(typeof stats.deviceBreakdown.mobile).toBe('number');
            expect(typeof stats.deviceBreakdown.tablet).toBe('number');

            // Verify DTO fields on each session
            for (const s of sessions) {
                expect(s.uuid).toBeDefined();
                expect(s.user).toBeDefined();
                expect(s.user.uuid).toBeDefined();
                expect(s.user.username).toBeDefined();
                expect(s.user.fullName).toBeDefined();
                expect(s.ipAddress).toBeDefined();
                expect(s.deviceType).toBeDefined();
                expect(s.browser).toBeDefined();
                expect(s.os).toBeDefined();
                expect(s.status).toMatch(/^(ACTIVE|REVOKED|EXPIRED)$/);
            }
        });

        it('correctly sets isCurrent to true matching caller session and false for others', async () => {
            const res = await request(app)
                .get('/api/admin/sessions')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            const { sessions } = res.body.data;

            const currentSessions = sessions.filter((s) => s.isCurrent === true);
            expect(currentSessions).toHaveLength(1);
            expect(currentSessions[0].user.username).toBe(adminUser.username);
            expect(currentSessions[0].deviceType).toBe('desktop');
            expect(currentSessions[0].os).toBe('macOS');
            expect(currentSessions[0].browser).toBe('Chrome');
            expect(currentSessions[0].ipAddress).toBe('192.168.1.50');

            const otherSessions = sessions.filter((s) => s.isCurrent === false);
            expect(otherSessions.length).toBeGreaterThanOrEqual(3);
        });

        it('filters sessions by ?activeOnly=true', async () => {
            // Create one expired session and one manually revoked session
            await db.AuthSession.create({
                userId: testTargetUser.id,
                refreshTokenHash: 'hash-expired',
                expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
                deviceType: 'desktop',
                browser: 'Firefox',
                os: 'Linux',
                ipAddress: '10.10.10.10',
            });

            await db.AuthSession.create({
                userId: testTargetUser.id,
                refreshTokenHash: 'hash-revoked',
                expiresAt: new Date(Date.now() + 3600000),
                revokedAt: new Date(),
                deviceType: 'mobile',
                browser: 'Safari',
                os: 'iOS',
                ipAddress: '10.10.10.11',
            });

            // Fetch with activeOnly=true
            const activeRes = await request(app)
                .get('/api/admin/sessions?activeOnly=true')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(activeRes.status).toBe(200);
            const activeSessions = activeRes.body.data.sessions;
            for (const s of activeSessions) {
                expect(s.status).toBe('ACTIVE');
                expect(s.revokedAt).toBeNull();
                expect(new Date(s.expiresAt).getTime()).toBeGreaterThan(Date.now());
            }

            // Fetch with activeOnly=false (all sessions)
            const allRes = await request(app)
                .get('/api/admin/sessions?activeOnly=false')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(allRes.status).toBe(200);
            const allSessions = allRes.body.data.sessions;
            expect(allSessions.length).toBeGreaterThan(activeSessions.length);

            const hasExpired = allSessions.some((s) => s.status === 'EXPIRED');
            const hasRevoked = allSessions.some((s) => s.status === 'REVOKED');
            expect(hasExpired).toBe(true);
            expect(hasRevoked).toBe(true);
        });
    });

    describe('DELETE /api/admin/sessions/:sessionUuid', () => {
        it('revokes a single active session', async () => {
            // Find an active session for testTargetUser
            const listRes = await request(app)
                .get('/api/admin/sessions?activeOnly=true')
                .set('Authorization', `Bearer ${adminToken}`);

            const targetSession = listRes.body.data.sessions.find(
                (s) => s.user.username === testTargetUser.username && s.status === 'ACTIVE'
            );
            expect(targetSession).toBeDefined();

            const revokeRes = await request(app)
                .delete(`/api/admin/sessions/${targetSession.uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(revokeRes.status).toBe(200);
            expect(revokeRes.body.success).toBe(true);
            expect(revokeRes.body.message).toBe('Session revoked');

            // Verify in database that revokedAt is set
            const dbSession = await db.AuthSession.findOne({
                where: { uuid: targetSession.uuid },
            });
            expect(dbSession.revokedAt).not.toBeNull();
        });

        it('returns 404 when sessionUuid is not found or already revoked', async () => {
            const fakeUuid = '00000000-0000-0000-0000-000000000000';
            const res = await request(app)
                .delete(`/api/admin/sessions/${fakeUuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/admin/sessions/users/:userUuid', () => {
        it('revokes all active sessions for a user', async () => {
            // Verify testTargetUser has at least one active session before revokeAll
            // Create a fresh session for target user
            await db.AuthSession.create({
                userId: testTargetUser.id,
                refreshTokenHash: 'hash-active-target',
                expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
                deviceType: 'tablet',
                browser: 'Safari',
                os: 'iOS',
                ipAddress: '192.168.1.99',
            });

            const revokeAllRes = await request(app)
                .delete(`/api/admin/sessions/users/${testTargetUser.uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(revokeAllRes.status).toBe(200);
            expect(revokeAllRes.body.success).toBe(true);
            expect(revokeAllRes.body.message).toBe('All user sessions revoked');

            // Verify all sessions for testTargetUser are now revoked
            const activeSessions = await db.AuthSession.findAll({
                where: {
                    userId: testTargetUser.id,
                    revokedAt: null,
                },
            });
            expect(activeSessions).toHaveLength(0);
        });

        it('returns 404 when userUuid is not found', async () => {
            const fakeUserUuid = '00000000-0000-0000-0000-000000000000';
            const res = await request(app)
                .delete(`/api/admin/sessions/users/${fakeUserUuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });
    });
});
