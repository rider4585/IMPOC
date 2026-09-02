import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser, generateTestRole, generateTestPermission } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Role Permissions Module - /api/roles/:roleUuid/permissions', () => {
  let testDb;
  let adminToken;
  let testRole;
  let testPermissions;

  beforeAll(async () => {
    testDb = await initializeTestDatabase();

    // Create admin user
    const adminData = generateTestUser({ password: 'Admin123!' });
    const adminUser = await db.User.create({
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

    // Create test role
    testRole = await db.Role.create(generateTestRole());

    // Create test permissions
    testPermissions = await db.Permission.bulkCreate([
      generateTestPermission({ name: 'test.read' }),
      generateTestPermission({ name: 'test.write' }),
      generateTestPermission({ name: 'test.delete' }),
    ]);
  });

  afterEach(async () => {
    // Clean up role permissions
    await db.RolePermission.destroy({ where: { role_id: testRole.id } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /roles/:roleUuid/permissions', () => {
    it('should list role permissions with ADMIN', async () => {
      // Assign permissions to role
      await testRole.addPermissions([testPermissions[0], testPermissions[1]]);

      const res = await request(app)
        .get(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('should return empty array if role has no permissions', async () => {
      const res = await request(app)
        .get(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(app)
        .get('/api/roles/00000000-0000-0000-0000-000000000000/permissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get(`/api/roles/${testRole.uuid}/permissions`);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /roles/:roleUuid/permissions', () => {
    it('should assign permission to role with ADMIN', async () => {
      const res = await request(app)
        .post(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionUuid: testPermissions[0].uuid });

      expect(res.statusCode).toBe(201);
    });

    it('should assign multiple permissions to role', async () => {
      // Assign first permission
      await request(app)
        .post(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionUuid: testPermissions[0].uuid });

      // Assign second permission
      const res = await request(app)
        .post(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionUuid: testPermissions[1].uuid });

      expect(res.statusCode).toBe(201);

      const permissions = await request(app)
        .get(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(permissions.body.data.length).toBe(2);
    });

    it('should return 409 for duplicate permission assignment', async () => {
      // Assign permission first time
      await request(app)
        .post(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionUuid: testPermissions[0].uuid });

      // Try to assign same permission again
      const res = await request(app)
        .post(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionUuid: testPermissions[0].uuid });

      expect(res.statusCode).toBe(409);
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(app)
        .post('/api/roles/00000000-0000-0000-0000-000000000000/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionUuid: testPermissions[0].uuid });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for non-existent permission', async () => {
      const res = await request(app)
        .post(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionUuid: '00000000-0000-0000-0000-000000000000' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for missing permissionUuid', async () => {
      const res = await request(app)
        .post(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid permissionUuid format', async () => {
      const res = await request(app)
        .post(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionUuid: 'invalid-uuid' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /roles/:roleUuid/permissions/:permissionUuid', () => {
    it('should remove permission from role with ADMIN', async () => {
      // First assign permission
      await request(app)
        .post(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionUuid: testPermissions[0].uuid });

      // Then remove it
      const res = await request(app)
        .delete(`/api/roles/${testRole.uuid}/permissions/${testPermissions[0].uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);

      const permissions = await request(app)
        .get(`/api/roles/${testRole.uuid}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(permissions.body.data.length).toBe(0);
    });

    it('should return 404 when removing unassigned permission', async () => {
      const res = await request(app)
        .delete(`/api/roles/${testRole.uuid}/permissions/${testPermissions[0].uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(app)
        .delete(`/api/roles/00000000-0000-0000-0000-000000000000/permissions/${testPermissions[0].uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for non-existent permission', async () => {
      const res = await request(app)
        .delete(`/api/roles/${testRole.uuid}/permissions/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for invalid role UUID format', async () => {
      const res = await request(app)
        .delete(`/api/roles/invalid-uuid/permissions/${testPermissions[0].uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid permission UUID format', async () => {
      const res = await request(app)
        .delete(`/api/roles/${testRole.uuid}/permissions/invalid-uuid`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });
});
