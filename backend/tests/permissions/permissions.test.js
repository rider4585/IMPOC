import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser, generateTestPermission } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Permissions Module - /api/permissions', () => {
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
    // Clean up test permissions
    await db.Permission.destroy({ where: { name: { [db.Sequelize.Op.like]: 'test.%' } } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /permissions', () => {
    it('should list all permissions with ADMIN', async () => {
      const res = await request(app)
        .get('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/permissions');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /permissions', () => {
    it('should create new permission with ADMIN', async () => {
      const permData = generateTestPermission();

      const res = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(permData);

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.name).toBe(permData.name);
    });

    it('should return 409 for duplicate permission name', async () => {
      const permData = generateTestPermission();

      // Create first permission
      await db.Permission.create(permData);

      // Try to create duplicate
      const res = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(permData);

      expect(res.statusCode).toBe(409);
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Test permission' });

      expect(res.statusCode).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const permData = generateTestPermission();

      const res = await request(app)
        .post('/api/permissions')
        .send(permData);

      expect(res.statusCode).toBe(401);
    });

    it('should allow optional description', async () => {
      const permData = {
        name: 'test.nodesc',
      };

      const res = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(permData);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('test.nodesc');
    });
  });

  describe('GET /permissions/:uuid', () => {
    it('should get permission by uuid with ADMIN', async () => {
      const permData = generateTestPermission();
      const permission = await db.Permission.create(permData);

      const res = await request(app)
        .get(`/api/permissions/${permission.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.uuid).toBe(permission.uuid);
      expect(res.body.data.name).toBe(permData.name);
    });

    it('should return 404 for non-existent permission', async () => {
      const res = await request(app)
        .get('/api/permissions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/permissions/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /permissions/:uuid', () => {
    it('should update permission with ADMIN', async () => {
      const permData = generateTestPermission();
      const permission = await db.Permission.create(permData);

      const res = await request(app)
        .patch(`/api/permissions/${permission.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated description' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.description).toBe('Updated description');
    });

    it('should return 404 for non-existent permission', async () => {
      const res = await request(app)
        .patch('/api/permissions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when updating to duplicate name', async () => {
      const permData1 = generateTestPermission();
      const permData2 = generateTestPermission();

      const perm1 = await db.Permission.create(permData1);
      const perm2 = await db.Permission.create(permData2);

      const res = await request(app)
        .patch(`/api/permissions/${perm2.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: perm1.name });

      expect(res.statusCode).toBe(409);
    });

    it('should allow updating only description', async () => {
      const permData = generateTestPermission();
      const permission = await db.Permission.create(permData);

      const res = await request(app)
        .patch(`/api/permissions/${permission.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'New description' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.name).toBe(permData.name);
      expect(res.body.data.description).toBe('New description');
    });
  });

  describe('DELETE /permissions/:uuid', () => {
    it('should delete permission with ADMIN', async () => {
      const permData = generateTestPermission();
      const permission = await db.Permission.create(permData);

      const res = await request(app)
        .delete(`/api/permissions/${permission.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);

      // Verify deletion
      const deleted = await db.Permission.findByPk(permission.id);
      expect(deleted).toBeNull();
    });

    it('should return 409 when deleting permission assigned to roles', async () => {
      const permData = generateTestPermission();
      const permission = await db.Permission.create(permData);

      // Assign permission to a role
      const role = await db.Role.findOne({ where: { name: 'ADMIN' } });
      await role.addPermission(permission);

      const res = await request(app)
        .delete(`/api/permissions/${permission.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(409);
    });

    it('should return 404 for non-existent permission', async () => {
      const res = await request(app)
        .delete('/api/permissions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Security & Validation Tests', () => {
    /*
     * Injection safety here comes from Sequelize parameterising the insert, not
     * from rejecting the input: the payload is stored verbatim as an ordinary
     * name and no SQL runs. This test used to assert 400, i.e. that the API
     * rejects names containing SQL metacharacters. createPermissionSchema
     * enforces length only, so 400 was never the behaviour, and a 400 would not
     * have been what makes this safe anyway. Asserting the payload round-trips
     * as a literal string is the stronger check, because a successful injection
     * could not also return the text intact.
     */
    it('should store SQL metacharacters as a literal name instead of executing them', async () => {
      const injectionName = "test'; DROP TABLE permissions; --";

      const res = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: injectionName,
          description: 'Test',
        });

      expect(res.statusCode).toBe(201);
      // The service lower-cases permission names; the payload is otherwise intact.
      expect(res.body.data.name).toBe(injectionName.toLowerCase());

      // Verify permissions table still exists and is readable
      const perms = await request(app)
        .get('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(perms.statusCode).toBe(200);
      expect(Array.isArray(perms.body.data)).toBe(true);

      // The generic 'test.%' cleanup does not match this name.
      await db.Permission.destroy({ where: { name: injectionName.toLowerCase() } });
    });

    it('should handle XSS attempt in description', async () => {
      const permData = {
        name: 'test.xss',
        description: '<script>alert("XSS")</script>',
      };

      const res = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(permData);

      expect(res.statusCode).toBe(201);
      // Description should be stored safely (not executed)
      expect(res.body.data.description).toBe(permData.description);
    });

    it('should trim whitespace from name', async () => {
      const res = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '  test.trimmed  ',
          description: 'Test',
        });

      expect(res.statusCode).toBe(201);
      // Should be trimmed
      expect(res.body.data.name).toBe('test.trimmed');
    });

    it('should not return password in error responses', async () => {
      const res = await request(app)
        .get('/api/permissions/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });
  });
});
