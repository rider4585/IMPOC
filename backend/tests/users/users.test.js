import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Users Module - /api/users', () => {
  let testDb;
  let adminToken;
  let managerToken;
  let inventoryManagerToken;
  let cashierToken;
  let accountantToken;
  let testUsers = {};
  let adminUser;
  let defaultRoleUuid;

  beforeAll(async () => {
    testDb = await initializeTestDatabase();

    // Create admin user with all roles
    const adminData = generateTestUser({ password: 'Admin123!' });
    adminUser = await db.User.create({
      username: adminData.username,
      email: adminData.email,
      firstName: adminData.firstName,
      passwordHash: await argon2.hash(adminData.password),
    });
    const adminRole = await db.Role.findOne({ where: { name: 'ADMIN' } });
    await adminUser.addRole(adminRole);

    // POST /users requires roleUuid; every user is created with a role.
    const cashierRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
    defaultRoleUuid = cashierRole.uuid;

    // Create users with different roles
    const roleNames = ['MANAGER', 'INVENTORY_MANAGER', 'CASHIER', 'ACCOUNTANT'];
    for (const roleName of roleNames) {
      const userData = generateTestUser({ password: 'Password123!' });
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
      });
      const role = await db.Role.findOne({ where: { name: roleName } });
      await user.addRole(role);
      testUsers[roleName] = user;
    }

    // Get auth tokens for all users
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: adminData.username,
        password: adminData.password,
      });
    adminToken = adminLoginRes.body.data.accessToken;

    for (const [role, user] of Object.entries(testUsers)) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: user.username,
          password: 'Password123!',
        });
      if (role === 'MANAGER') managerToken = loginRes.body.data.accessToken;
      if (role === 'INVENTORY_MANAGER') inventoryManagerToken = loginRes.body.data.accessToken;
      if (role === 'CASHIER') cashierToken = loginRes.body.data.accessToken;
      if (role === 'ACCOUNTANT') accountantToken = loginRes.body.data.accessToken;
    }
  });

  afterEach(async () => {
    /*
     * Remove only the users an individual test created. The fixture users from
     * beforeAll also match 'testuser_%', and deleting them invalidated the
     * tokens held for the whole describe block, so every later request came
     * back 401.
     */
    const fixtureUsernames = [
      adminUser.username,
      ...Object.values(testUsers).map((user) => user.username),
    ];

    await db.User.destroy({
      where: {
        username: {
          [db.Sequelize.Op.like]: 'testuser_%',
          [db.Sequelize.Op.notIn]: fixtureUsernames,
        },
      },
    });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /users', () => {
    it('should list all users with ADMIN role', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should include roles array for each user', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const foundAdmin = res.body.data.find((u) => u.username === adminUser.username);
      expect(foundAdmin).toBeDefined();
      expect(Array.isArray(foundAdmin.roles)).toBe(true);
      expect(foundAdmin.roles.some((r) => r.name === 'ADMIN')).toBe(true);
    });

    it('should return 403 for unauthorized CASHIER role', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${cashierToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should return 403 for unauthorized ACCOUNTANT role', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${accountantToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/users');

      expect(res.statusCode).toBe(401);
    });

    it('should exclude soft-deleted users', async () => {
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
        status: 'DELETED',
      });

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      const usernames = res.body.data.map(u => u.username);
      expect(usernames).not.toContain(userData.username);
    });
  });

  describe('POST /users', () => {
    it('should create new user with ADMIN role', async () => {
      const userData = generateTestUser();

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: userData.username,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          password: userData.password,
          phone: userData.phone,
          roleUuid: defaultRoleUuid,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.username).toBe(userData.username);
    });

    it('should return 403 for unauthorized MANAGER role', async () => {
      const userData = generateTestUser();

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          username: userData.username,
          email: userData.email,
          firstName: userData.firstName,
          password: userData.password,
        });

      expect(res.statusCode).toBe(403);
    });

    it('should return 409 for duplicate username', async () => {
      const userData = generateTestUser();

      // Create first user
      await db.User.create({
        username: userData.username,
        email: `${userData.username}@example.com`,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
      });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: userData.username,
          email: `other@example.com`,
          firstName: 'Different',
          password: userData.password,
          roleUuid: defaultRoleUuid,
        });

      expect(res.statusCode).toBe(409);
    });

    it('should return 409 for duplicate email', async () => {
      const userData1 = generateTestUser();
      const userData2 = generateTestUser();

      // Create first user
      await db.User.create({
        username: userData1.username,
        email: userData1.email,
        firstName: userData1.firstName,
        passwordHash: await argon2.hash(userData1.password),
      });

      // Try to create with same email
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: userData2.username,
          email: userData1.email,
          firstName: userData2.firstName,
          password: userData2.password,
          roleUuid: defaultRoleUuid,
        });

      expect(res.statusCode).toBe(409);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'testuser',
          // missing email, firstName, password
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const userData = generateTestUser();

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: userData.username,
          email: 'invalid-email',
          firstName: userData.firstName,
          password: userData.password,
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for password too short', async () => {
      const userData = generateTestUser();

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: userData.username,
          email: userData.email,
          firstName: userData.firstName,
          password: 'short',
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for username exceeding max length', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'a'.repeat(51),
          email: 'test@example.com',
          firstName: 'Test',
          password: 'TestPassword123!',
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /users/:uuid', () => {
    it('should get user by uuid with ADMIN role', async () => {
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
      });

      const res = await request(app)
        .get(`/api/users/${user.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.uuid).toBe(user.uuid);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/users/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /users/:uuid', () => {
    it('should update user with ADMIN role', async () => {
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
      });

      const res = await request(app)
        .patch(`/api/users/${user.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.firstName).toBe('Updated');
    });

    it('should return 403 for unauthorized CASHIER role', async () => {
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
      });

      const res = await request(app)
        .patch(`/api/users/${user.uuid}`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          firstName: 'Updated',
        });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .patch('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Updated',
        });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /users/:uuid/status', () => {
    it('should update user status to INACTIVE with ADMIN role', async () => {
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
        status: 'ACTIVE',
      });

      const res = await request(app)
        .patch(`/api/users/${user.uuid}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('INACTIVE');
    });

    it('should update user status to SUSPENDED with ADMIN role', async () => {
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
        status: 'ACTIVE',
      });

      const res = await request(app)
        .patch(`/api/users/${user.uuid}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');
    });

    it('should return 409 when setting same status twice', async () => {
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
        status: 'ACTIVE',
      });

      // Update to ACTIVE (same status)
      const res = await request(app)
        .patch(`/api/users/${user.uuid}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.statusCode).toBe(409);
    });

    it('should return 400 for invalid status value', async () => {
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
      });

      const res = await request(app)
        .patch(`/api/users/${user.uuid}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /users/:uuid', () => {
    it('should soft delete user with ADMIN role', async () => {
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
      });

      const res = await request(app)
        .delete(`/api/users/${user.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);

      // Verify soft delete (status should be DELETED)
      const deletedUser = await db.User.findByPk(user.id);
      expect(deletedUser.status).toBe('DELETED');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .delete('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 403 for unauthorized role', async () => {
      const userData = generateTestUser();
      const user = await db.User.create({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        passwordHash: await argon2.hash(userData.password),
      });

      const res = await request(app)
        .delete(`/api/users/${user.uuid}`)
        .set('Authorization', `Bearer ${cashierToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Staff PII scoping (SEC-L-2)', () => {
    const createPiiUser = async () => {
      const data = generateTestUser({ phone: '+919876543210' });
      return db.User.create({
        username: data.username,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        passwordHash: await argon2.hash(data.password),
      });
    };

    it('MANAGER (users.view, no users.view_pii) sees email/phone redacted in list', async () => {
      const user = await createPiiUser();

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(200);

      const row = res.body.data.find((u) => u.uuid === user.uuid);
      expect(row).toBeDefined();
      expect(row.email).toBeNull();
      expect(row.phone).toBeNull();
    });

    it('ADMIN (users.view_pii) sees email/phone in list', async () => {
      const user = await createPiiUser();

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);

      const row = res.body.data.find((u) => u.uuid === user.uuid);
      expect(row).toBeDefined();
      expect(row.email).toBe(user.email);
      expect(row.phone).toBe(user.phone);
    });

    it('MANAGER sees email/phone redacted on GET /users/:uuid', async () => {
      const user = await createPiiUser();

      const res = await request(app)
        .get(`/api/users/${user.uuid}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.email).toBeNull();
      expect(res.body.data.phone).toBeNull();
    });
  });
});
