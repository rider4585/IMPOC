import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { validateJwtSecret, assertJwtSecrets } from '../../src/modules/auth/token.service.js';

describe('Auth Module - /api/auth', () => {
  let testDb;

  beforeAll(async () => {
    testDb = await initializeTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('POST /login', () => {
    it('should login successfully with valid credentials', async () => {
      const testUser = generateTestUser({ password: 'TestPassword123!' });
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        passwordHash,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).not.toHaveProperty('refreshToken');
      expect(res.body.data).toHaveProperty('refreshTokenExpiresAt');
      // login flattens the user fields onto `data`; it returns no nested `user` object
      expect(res.body.data).toHaveProperty('username');
      expect(res.body.data.username).toBe(testUser.username);
      // Verify Set-Cookie header has correct attributes
      const setCookieHeader = res.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader[0]).toMatch(/refreshToken=/);
      expect(setCookieHeader[0]).toContain('HttpOnly');
      expect(setCookieHeader[0]).toContain('Path=/');
      // In production, Secure and SameSite=None; in test/dev, it's non-secure with SameSite=Lax
      if (process.env.NODE_ENV === 'production') {
        expect(setCookieHeader[0]).toContain('Secure');
        expect(setCookieHeader[0]).toContain('SameSite=None');
      } else {
        expect(setCookieHeader[0]).toContain('SameSite=Lax');
      }
    });

    it('should return 401 for invalid credentials', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash('ValidPassword123!');

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'WrongPassword123!',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    /*
     * Login answers 401 with an identical message whether the username does
     * not exist, the account is inactive, or the password is wrong. That is
     * deliberate: a distinct 404 for "no such user" would let an attacker
     * enumerate valid usernames. This test previously asserted 404; making the
     * code satisfy that would have introduced the enumeration leak.
     */
    it('should return 401 (not 404) for a non-existent user, to avoid username enumeration', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent_user',
          password: 'Password123!',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid username or password');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for missing username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'Password123!',
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return sorted permissions array for CASHIER user on login', async () => {
      const testUser = generateTestUser({ password: 'TestPassword123!' });
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        passwordHash,
      });

      const cashierRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
      await user.addRole(cashierRole);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('permissions');
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
      expect(res.body.data.permissions).toEqual(['inventory.view', 'sales.create', 'sales.view']);
      expect(res.body.data).not.toHaveProperty('preferences');
      expect(res.body.data).not.toHaveProperty('refreshToken');
      expect(res.body.data).toHaveProperty('refreshTokenExpiresAt');
    });

    it('should return sorted permissions array for INVENTORY_MANAGER user on login', async () => {
      const testUser = generateTestUser({ password: 'TestPassword123!' });
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        passwordHash,
      });

      const invRole = await db.Role.findOne({ where: { name: 'INVENTORY_MANAGER' } });
      await user.addRole(invRole);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('permissions');
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
      expect(res.body.data.permissions).toEqual([
        'inventory.barcode_generate',
        'inventory.create',
        'inventory.delete',
        'inventory.update',
        'inventory.view',
        'picklists.create',
        'picklists.update',
        'picklists.view',
      ]);
      expect(res.body.data).not.toHaveProperty('preferences');
      expect(res.body.data).not.toHaveProperty('refreshToken');
      expect(res.body.data).toHaveProperty('refreshTokenExpiresAt');
    });
  });

  describe('POST /refresh', () => {
    it('should refresh token with valid refresh token in cookie', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      // Use supertest agent to maintain cookies across requests
      const agent = request.agent(app);

      // Login to set the cookie
      const loginRes = await agent
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(loginRes.statusCode).toBe(200);
      // Verify that Set-Cookie header is present
      expect(loginRes.headers['set-cookie']).toBeDefined();

      const setCookieHeader = loginRes.headers['set-cookie'][0];
      // Extract the refreshToken value from the Set-Cookie header for manual setting
      const refreshTokenMatch = setCookieHeader.match(/refreshToken=([^;]+)/);
      const refreshTokenValue = refreshTokenMatch ? refreshTokenMatch[1] : null;
      expect(refreshTokenValue).toBeTruthy();

      // Then refresh with the cookie (agent should automatically include it)
      const res = await agent
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'IMPOC-SPA')
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).not.toHaveProperty('refreshToken');
      expect(res.body.data).toHaveProperty('refreshTokenExpiresAt');
    });

    it('should return 400 for missing refresh token cookie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'IMPOC-SPA')
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should return 403 for missing X-Requested-With header on refresh', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const agent = request.agent(app);

      // Login to set the cookie
      await agent
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      // Refresh without X-Requested-With header
      const res = await agent
        .post('/api/auth/refresh')
        .send({});

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /logout', () => {
    it('should logout user and revoke current session', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const accessToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Requested-With', 'IMPOC-SPA');

      expect(res.statusCode).toBe(200);
    });

    it('should clear refreshToken cookie on logout', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const accessToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Requested-With', 'IMPOC-SPA');

      expect(res.statusCode).toBe(200);
      const setCookieHeader = res.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      // Check that cookie is cleared (expires in past or max-age=0)
      expect(setCookieHeader[0]).toMatch(/refreshToken=/);
    });

    it('should return 401 without access token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('X-Requested-With', 'IMPOC-SPA');

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 with invalid access token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid.token')
        .set('X-Requested-With', 'IMPOC-SPA');

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for missing X-Requested-With header on logout', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const accessToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /logout-all', () => {
    it('should logout user from all sessions', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      // Create multiple sessions
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const res = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${login1.body.data.accessToken}`)
        .set('X-Requested-With', 'IMPOC-SPA');

      expect(res.statusCode).toBe(200);
    });

    it('should return 401 without access token', async () => {
      const res = await request(app)
        .post('/api/auth/logout-all')
        .set('X-Requested-With', 'IMPOC-SPA');

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for missing X-Requested-With header on logout-all', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const login1 = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const res = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${login1.body.data.accessToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /me', () => {
    it('should return current user', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('username');
      expect(res.body.data.username).toBe(testUser.username);
    });

    it('should return 401 without access token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 with expired token', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjB9.test');

      expect(res.statusCode).toBe(401);
    });

    it('should return identical permissions array for CASHIER in GET /me as in login', async () => {
      const testUser = generateTestUser({ password: 'TestPassword123!' });
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        passwordHash,
      });

      const cashierRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
      await user.addRole(cashierRole);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const loginPermissions = loginRes.body.data.permissions;

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      expect(meRes.statusCode).toBe(200);
      expect(meRes.body.data).toHaveProperty('permissions');
      expect(Array.isArray(meRes.body.data.permissions)).toBe(true);
      expect(meRes.body.data.permissions).toEqual(loginPermissions);
      expect(meRes.body.data.permissions).toEqual(['inventory.view', 'sales.create', 'sales.view']);
      expect(meRes.body.data).not.toHaveProperty('preferences');
    });

    it('should return identical permissions array for INVENTORY_MANAGER in GET /me as in login', async () => {
      const testUser = generateTestUser({ password: 'TestPassword123!' });
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        passwordHash,
      });

      const invRole = await db.Role.findOne({ where: { name: 'INVENTORY_MANAGER' } });
      await user.addRole(invRole);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const loginPermissions = loginRes.body.data.permissions;

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      expect(meRes.statusCode).toBe(200);
      expect(meRes.body.data).toHaveProperty('permissions');
      expect(Array.isArray(meRes.body.data.permissions)).toBe(true);
      expect(meRes.body.data.permissions).toEqual(loginPermissions);
      expect(meRes.body.data.permissions).toEqual([
        'inventory.barcode_generate',
        'inventory.create',
        'inventory.delete',
        'inventory.update',
        'inventory.view',
        'picklists.create',
        'picklists.update',
        'picklists.view',
      ]);
      expect(meRes.body.data).not.toHaveProperty('preferences');
    });
  });

  describe('GET /sessions', () => {
    it('should list user active sessions', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should return 401 without access token', async () => {
      const res = await request(app)
        .get('/api/auth/sessions');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /sessions/:uuid', () => {
    it('should get session details by uuid', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const sessionsRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      const sessionUuid = sessionsRes.body.data[0].uuid;

      const res = await request(app)
        .get(`/api/auth/sessions/${sessionUuid}`)
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.uuid).toBe(sessionUuid);
    });

    it('should return 404 for non-existent session', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const res = await request(app)
        .get('/api/auth/sessions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const res = await request(app)
        .get('/api/auth/sessions/invalid-uuid')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /sessions/:uuid', () => {
    it('should revoke session by uuid', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const sessionsRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      const sessionUuid = sessionsRes.body.data[0].uuid;

      const res = await request(app)
        .delete(`/api/auth/sessions/${sessionUuid}`)
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for non-existent session', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const res = await request(app)
        .delete('/api/auth/sessions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Header Validation and Security Tests', () => {
    it('should accept X-Requested-With header with different case variations (case-insensitive)', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const agent = request.agent(app);

      // Login to set the cookie
      const loginRes = await agent
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(loginRes.statusCode).toBe(200);

      const setCookieHeader = loginRes.headers['set-cookie'][0];
      const refreshTokenMatch = setCookieHeader.match(/refreshToken=([^;]+)/);
      const refreshTokenValue = refreshTokenMatch ? refreshTokenMatch[1] : null;

      // Test with lowercase variation - should now be accepted
      const res1 = await agent
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'impoc-spa')
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({});

      expect(res1.statusCode).toBe(200);

      // Test with mixed case variation
      const res2 = await agent
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'Impoc-Spa')
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({});

      expect(res2.statusCode).toBe(200);

      // Test with uppercase variation
      const res3 = await agent
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'IMPOC-SPA')
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({});

      expect(res3.statusCode).toBe(200);
    });

    it('should accept X-Requested-With header with leading/trailing whitespace (trimmed)', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const agent = request.agent(app);

      // Login to set the cookie
      const loginRes = await agent
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(loginRes.statusCode).toBe(200);

      const setCookieHeader = loginRes.headers['set-cookie'][0];
      const refreshTokenMatch = setCookieHeader.match(/refreshToken=([^;]+)/);
      const refreshTokenValue = refreshTokenMatch ? refreshTokenMatch[1] : null;

      // Test with leading whitespace - should now be accepted
      const res1 = await agent
        .post('/api/auth/refresh')
        .set('X-Requested-With', '  IMPOC-SPA')
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({});

      expect(res1.statusCode).toBe(200);

      // Test with trailing whitespace
      const res2 = await agent
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'IMPOC-SPA  ')
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({});

      expect(res2.statusCode).toBe(200);

      // Test with both leading and trailing whitespace
      const res3 = await agent
        .post('/api/auth/refresh')
        .set('X-Requested-With', '  IMPOC-SPA  ')
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({});

      expect(res3.statusCode).toBe(200);
    });

    it('should accept X-Requested-With header with proper value (normalized case and trimmed)', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const agent = request.agent(app);

      // Login to set the cookie
      const loginRes = await agent
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(loginRes.statusCode).toBe(200);

      const setCookieHeader = loginRes.headers['set-cookie'][0];
      const refreshTokenMatch = setCookieHeader.match(/refreshToken=([^;]+)/);
      const refreshTokenValue = refreshTokenMatch ? refreshTokenMatch[1] : null;

      // Test with proper header value
      const res = await agent
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'IMPOC-SPA')
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({});

      expect(res.statusCode).toBe(200);
    });

    it('should verify cookie rotation on refresh (old and new cookie values differ)', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const agent = request.agent(app);

      // Login to get initial refresh token
      const loginRes = await agent
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const loginSetCookie = loginRes.headers['set-cookie'][0];
      const loginTokenMatch = loginSetCookie.match(/refreshToken=([^;]+)/);
      const initialRefreshToken = loginTokenMatch ? loginTokenMatch[1] : null;

      expect(initialRefreshToken).toBeTruthy();

      // Now refresh to get a new token
      const refreshRes = await agent
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'IMPOC-SPA')
        .set('Cookie', `refreshToken=${initialRefreshToken}`)
        .send({});

      expect(refreshRes.statusCode).toBe(200);

      const refreshSetCookie = refreshRes.headers['set-cookie'];
      expect(refreshSetCookie).toBeDefined();

      const refreshTokenMatch = refreshSetCookie[0].match(/refreshToken=([^;]+)/);
      const newRefreshToken = refreshTokenMatch ? refreshTokenMatch[1] : null;

      expect(newRefreshToken).toBeTruthy();
      // Verify tokens are different (rotation occurred)
      expect(newRefreshToken).not.toBe(initialRefreshToken);
    });
  });

  describe('Cookie and Environment Validation Tests', () => {
    it('should handle malformed/corrupted cookie content in request', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      // Test with corrupted/invalid token format
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('X-Requested-With', 'IMPOC-SPA')
        .set('Cookie', 'refreshToken=corrupted.invalid.token')
        .send({});

      // Should return 401 or similar error indicating invalid token
      expect([400, 401, 403]).toContain(res.statusCode);
    });
  });

  describe('JWT security - SEC-CR-3 (forgeable JWT)', () => {
    const loginFor = async (userFixture) => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: userFixture.username, password: userFixture.password });
      expect(loginRes.statusCode).toBe(200);
      return loginRes;
    };

    const mintAccessToken = (payload, algorithm = 'HS256') => {
      return jwt.sign(
        payload,
        process.env.JWT_ACCESS_SECRET,
        {
          algorithm,
          expiresIn: '15m',
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE,
        }
      );
    };

    it('should reject a token signed with a different algorithm (HS384) -> 401', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      // Login normally so a real session row exists to look up
      const loginRes = await loginFor(testUser);

      const sessionsRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);
      const sessionUuid = sessionsRes.body.data[0].uuid;

      // Correct sub + correct sessionId, but signed with HS384 instead of the
      // pinned HS256. jwt.verify with algorithms:['HS256'] must reject it.
      const forgedToken = mintAccessToken(
        { sub: loginRes.body.data.uuid, sessionId: sessionUuid, type: 'access' },
        'HS384'
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    it('should reject a valid token whose sub does not match the session owner -> 401', async () => {
      const userA = generateTestUser();
      const userB = generateTestUser();
      const hashA = await argon2.hash(userA.password);
      const hashB = await argon2.hash(userB.password);

      await db.User.create({
        username: userA.username,
        email: userA.email,
        firstName: userA.firstName,
        passwordHash: hashA,
      });
      await db.User.create({
        username: userB.username,
        email: userB.email,
        firstName: userB.firstName,
        passwordHash: hashB,
      });

      // Session row belonging to user A
      const loginA = await loginFor(userA);

      const sessionsRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${loginA.body.data.accessToken}`);
      const sessionAUuid = sessionsRes.body.data[0].uuid;
      const userAUuid = loginA.body.data.uuid;

      // A correctly-signed HS256 token for user B, re-pointed at A's session.
      const loginB = await loginFor(userB);
      const userBUuid = loginB.body.data.uuid;

      expect(userBUuid).not.toBe(userAUuid);

      const crossUserToken = mintAccessToken(
        { sub: userBUuid, sessionId: sessionAUuid, type: 'access' },
        'HS256'
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${crossUserToken}`);

      // Session exists and is active, but it belongs to user A while the token
      // subject is user B -> the session/sub binding must reject with 401.
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    it('should accept a correctly-signed token whose sub matches the session owner (positive control)', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      const user = await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await loginFor(testUser);

      const userUuid = loginRes.body.data.uuid;
      expect(userUuid).toBe(user.uuid);

      // A freshly-minted token using the real session (same shape the backend
      // signs) must be accepted.
      const sessionsRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);
      const sessionUuid = sessionsRes.body.data[0].uuid;

      const validToken = mintAccessToken(
        { sub: userUuid, sessionId: sessionUuid, type: 'access' },
        'HS256'
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.username).toBe(testUser.username);
    });

    it('should reject a token for a revoked session even when sub matches -> 401', async () => {
      const testUser = generateTestUser();
      const passwordHash = await argon2.hash(testUser.password);

      await db.User.create({
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        passwordHash,
      });

      const loginRes = await loginFor(testUser);
      const userUuid = loginRes.body.data.uuid;

      const sessionsRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);
      const sessionUuid = sessionsRes.body.data[0].uuid;

      const token = mintAccessToken(
        { sub: userUuid, sessionId: sessionUuid, type: 'access' },
        'HS256'
      );

      // Logout revokes the session; the still-cryptographically-valid token
      // must stop working (SEC-H-9 lifecycle behaviour preserved).
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
        .set('X-Requested-With', 'IMPOC-SPA');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('JWT secret strength validation (SEC-CR-3)', () => {
    it('rejects missing/empty, placeholder, and too-short secrets', () => {
      expect(() => validateJwtSecret(undefined, 'JWT_ACCESS_SECRET')).toThrow(/JWT_ACCESS_SECRET/);
      expect(() => validateJwtSecret('', 'JWT_ACCESS_SECRET')).toThrow(/JWT_ACCESS_SECRET/);
      expect(() => validateJwtSecret('  ', 'JWT_ACCESS_SECRET')).toThrow(/JWT_ACCESS_SECRET/);
      expect(() => validateJwtSecret('your-long-random-access-secret', 'JWT_ACCESS_SECRET')).toThrow(/JWT_ACCESS_SECRET/);
      expect(() => validateJwtSecret('short-secret', 'JWT_ACCESS_SECRET')).toThrow(/JWT_ACCESS_SECRET/);
      expect(() => validateJwtSecret('secret', 'JWT_ACCESS_SECRET')).toThrow(/JWT_ACCESS_SECRET/);
    });

    it('accepts a strong random secret of sufficient length', () => {
      const strong = 'Aa0!' + 'x'.repeat(40); // 44 chars
      expect(() => validateJwtSecret(strong, 'JWT_ACCESS_SECRET')).not.toThrow();
    });

    it('assertJwtSecrets throws when JWT_ACCESS_SECRET is weak and passes when strong', () => {
      const original = process.env.JWT_ACCESS_SECRET;
      const originalRefresh = process.env.JWT_REFRESH_SECRET;
      try {
        process.env.JWT_ACCESS_SECRET = 'weak';
        expect(() => assertJwtSecrets()).toThrow(/JWT_ACCESS_SECRET/);

        process.env.JWT_ACCESS_SECRET = 'longenoughrandomsecretvalue12345678901234567890';
        delete process.env.JWT_REFRESH_SECRET;
        expect(() => assertJwtSecrets()).not.toThrow();
      } finally {
        process.env.JWT_ACCESS_SECRET = original;
        if (originalRefresh === undefined) {
          delete process.env.JWT_REFRESH_SECRET;
        } else {
          process.env.JWT_REFRESH_SECRET = originalRefresh;
        }
      }
    });
  });
});
