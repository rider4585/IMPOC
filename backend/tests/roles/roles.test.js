import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser, generateTestRole } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Roles Module - /api/roles', () => {
  let testDb;
  let adminToken;
  let adminUser;

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
  });

  afterEach(async () => {
    // Clean up test roles
    await db.Role.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_ROLE_%' } } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /roles', () => {
    it('should list all roles with ADMIN', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/roles');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /roles', () => {
    it('should create new role with ADMIN', async () => {
      const roleData = generateTestRole();

      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(roleData);

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.name).toBe(roleData.name);
    });

    it('should return 409 for duplicate role name', async () => {
      const roleData = generateTestRole();

      // Create first role
      await db.Role.create(roleData);

      // Try to create duplicate
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(roleData);

      expect(res.statusCode).toBe(409);
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Test role' });

      expect(res.statusCode).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const roleData = generateTestRole();

      const res = await request(app)
        .post('/api/roles')
        .send(roleData);

      expect(res.statusCode).toBe(401);
    });

    it('should uppercase role name', async () => {
      const roleData = {
        name: 'test_new_role',
        description: 'Test role',
      };

      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(roleData);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_NEW_ROLE');
    });
  });

  describe('GET /roles/:uuid', () => {
    it('should get role by uuid with ADMIN', async () => {
      const roleData = generateTestRole();
      const role = await db.Role.create(roleData);

      const res = await request(app)
        .get(`/api/roles/${role.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.uuid).toBe(role.uuid);
      expect(res.body.data.name).toBe(roleData.name);
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(app)
        .get('/api/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/roles/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /roles/:uuid', () => {
    it('should update role with ADMIN', async () => {
      const roleData = generateTestRole();
      const role = await db.Role.create(roleData);

      const res = await request(app)
        .patch(`/api/roles/${role.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated description' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.description).toBe('Updated description');
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(app)
        .patch('/api/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when updating to duplicate name', async () => {
      const roleData1 = generateTestRole();
      const roleData2 = generateTestRole();

      const role1 = await db.Role.create(roleData1);
      const role2 = await db.Role.create(roleData2);

      const res = await request(app)
        .patch(`/api/roles/${role2.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: role1.name });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('DELETE /roles/:uuid', () => {
    it('should delete role with ADMIN', async () => {
      const roleData = generateTestRole();
      const role = await db.Role.create(roleData);

      const res = await request(app)
        .delete(`/api/roles/${role.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);

      // Verify deletion
      const deleted = await db.Role.findByPk(role.id);
      expect(deleted).toBeNull();
    });

    it('should return 409 when deleting role with assigned users', async () => {
      const roleData = generateTestRole();
      const role = await db.Role.create(roleData);

      // Assign role to a user
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
      });
      await user.addRole(role);

      const res = await request(app)
        .delete(`/api/roles/${role.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(409);
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(app)
        .delete('/api/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });
  });
});
