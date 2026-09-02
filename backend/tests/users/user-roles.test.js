import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('User Roles Module - /api/users/:userUuid/roles', () => {
  let testDb;
  let adminToken;
  let adminUser;
  let testUser;

  beforeAll(async () => {
    testDb = await initializeTestDatabase();

    // Create admin user
    const adminData = generateTestUser({ password: 'Admin123!' });
    adminUser = await db.User.create({
      username: adminData.username,
      email: adminData.email,
      firstName: adminData.firstName,
      passwordHash: await argon2.hash(adminData.password),
    });
    const adminRole = await db.Role.findOne({ where: { name: 'ADMIN' } });
    await adminUser.addRole(adminRole);

    // Get admin token
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: adminData.username,
        password: adminData.password,
      });
    adminToken = adminLoginRes.body.data.accessToken;

    // Create test user
    const testUserData = generateTestUser();
    testUser = await db.User.create({
      username: testUserData.username,
      email: testUserData.email,
      firstName: testUserData.firstName,
      passwordHash: await argon2.hash(testUserData.password),
    });
  });

  afterEach(async () => {
    /*
     * Only clear the associations under test. Truncating the whole table also
     * stripped the admin fixture's ADMIN role, so every later request came
     * back 403.
     */
    await db.UserRole.destroy({ where: { userId: testUser.id } });
    testUser = await db.User.findByPk(testUser.id);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /users/:userUuid/roles', () => {
    it('should list user roles with ADMIN', async () => {
      const role = await db.Role.findOne({ where: { name: 'MANAGER' } });
      await testUser.addRole(role);

      const res = await request(app)
        .get(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('should return empty array if user has no roles', async () => {
      const res = await request(app)
        .get(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/users/00000000-0000-0000-0000-000000000000/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get(`/api/users/${testUser.uuid}/roles`);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /users/:userUuid/roles', () => {
    it('should assign role to user with ADMIN', async () => {
      const role = await db.Role.findOne({ where: { name: 'MANAGER' } });

      const res = await request(app)
        .post(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleUuid: role.uuid });

      expect(res.statusCode).toBe(201);
    });

    it('should assign multiple roles to user', async () => {
      const managerRole = await db.Role.findOne({ where: { name: 'MANAGER' } });
      const accountantRole = await db.Role.findOne({ where: { name: 'ACCOUNTANT' } });

      // Assign first role
      await request(app)
        .post(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleUuid: managerRole.uuid });

      // Assign second role
      const res = await request(app)
        .post(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleUuid: accountantRole.uuid });

      expect(res.statusCode).toBe(201);

      const roles = await request(app)
        .get(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(roles.body.data.length).toBe(2);
    });

    it('should return 409 for duplicate role assignment', async () => {
      const role = await db.Role.findOne({ where: { name: 'MANAGER' } });

      // Assign role first time
      await request(app)
        .post(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleUuid: role.uuid });

      // Try to assign same role again
      const res = await request(app)
        .post(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleUuid: role.uuid });

      expect(res.statusCode).toBe(409);
    });

    it('should return 404 for non-existent user', async () => {
      const role = await db.Role.findOne({ where: { name: 'MANAGER' } });

      const res = await request(app)
        .post('/api/users/00000000-0000-0000-0000-000000000000/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleUuid: role.uuid });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(app)
        .post(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleUuid: '00000000-0000-0000-0000-000000000000' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for missing roleUuid', async () => {
      const res = await request(app)
        .post(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid roleUuid format', async () => {
      const res = await request(app)
        .post(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleUuid: 'invalid-uuid' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /users/:userUuid/roles/:roleUuid', () => {
    it('should remove role from user with ADMIN', async () => {
      const role = await db.Role.findOne({ where: { name: 'MANAGER' } });

      // First assign role
      await request(app)
        .post(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleUuid: role.uuid });

      // Then remove it
      const res = await request(app)
        .delete(`/api/users/${testUser.uuid}/roles/${role.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);

      const roles = await request(app)
        .get(`/api/users/${testUser.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(roles.body.data.length).toBe(0);
    });

    it('should return 404 when removing unassigned role', async () => {
      const role = await db.Role.findOne({ where: { name: 'MANAGER' } });

      const res = await request(app)
        .delete(`/api/users/${testUser.uuid}/roles/${role.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for non-existent user', async () => {
      const role = await db.Role.findOne({ where: { name: 'MANAGER' } });

      const res = await request(app)
        .delete(`/api/users/00000000-0000-0000-0000-000000000000/roles/${role.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(app)
        .delete(`/api/users/${testUser.uuid}/roles/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for invalid user UUID format', async () => {
      const role = await db.Role.findOne({ where: { name: 'MANAGER' } });

      const res = await request(app)
        .delete(`/api/users/invalid-uuid/roles/${role.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });
});
