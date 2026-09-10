import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';

describe('Expense Types Module - /api/picklists/expense-types', () => {
  let adminToken;
  let picklitToken;

  beforeAll(async () => {
    await initializeTestDatabase();

    const adminData = generateTestUser({ password: 'Admin123!' });
    const adminUser = await db.User.create({
      username: adminData.username,
      email: adminData.email,
      firstName: adminData.firstName,
      passwordHash: await argon2.hash(adminData.password),
    });
    const adminRole = await db.Role.findOne({ where: { name: 'ADMIN' } });
    await adminUser.addRole(adminRole);

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: adminData.username,
        password: adminData.password,
      });
    adminToken = adminLoginRes.body.data.accessToken;

    const picklestData = generateTestUser({ password: 'Picklist123!' });
    const picklistUser = await db.User.create({
      username: picklestData.username,
      email: picklestData.email,
      firstName: picklestData.firstName,
      passwordHash: await argon2.hash(picklestData.password),
    });
    const managerRole = await db.Role.findOne({ where: { name: 'MANAGER' } });
    await picklistUser.addRole(managerRole);
    const picklistsCreatePerm = await db.Permission.findOne({ where: { name: 'picklists.create' } });
    const picklistsUpdatePerm = await db.Permission.findOne({ where: { name: 'picklists.update' } });
    await managerRole.addPermissions([picklistsCreatePerm, picklistsUpdatePerm]);

    const picklistLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: picklestData.username,
        password: picklestData.password,
      });
    picklitToken = picklistLoginRes.body.data.accessToken;
  });

  afterEach(async () => {
    await db.ExpenseType.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_%' } } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /expense-types', () => {
    it('should list expense types with authentication', async () => {
      await db.ExpenseType.create({ name: 'TEST_Rent' });
      await db.ExpenseType.create({ name: 'TEST_Travel' });

      const res = await request(app)
        .get('/api/picklists/expense-types')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const names = res.body.data.map((t) => t.name);
      expect(names).toContain('TEST_Rent');
      expect(names).toContain('TEST_Travel');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/expense-types');

      expect(res.statusCode).toBe(401);
    });

    it('should not expose internal id field', async () => {
      await db.ExpenseType.create({ name: 'TEST_Other' });

      const res = await request(app)
        .get('/api/picklists/expense-types')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      res.body.data.forEach((type) => {
        expect(type).not.toHaveProperty('id');
        expect(type).toHaveProperty('uuid');
        expect(type).toHaveProperty('name');
        expect(type).toHaveProperty('isActive');
      });
    });
  });

  describe('POST /expense-types', () => {
    it('should create expense type with picklists.create permission', async () => {
      const res = await request(app)
        .post('/api/picklists/expense-types')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ name: 'TEST_Entertainment' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.name).toBe('TEST_Entertainment');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 409 for duplicate active expense type name', async () => {
      await db.ExpenseType.create({ name: 'TEST_Utilities' });

      const res = await request(app)
        .post('/api/picklists/expense-types')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ name: 'TEST_Utilities' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Expense type already exists');
    });

    it('should allow creating an expense type with same name as a deactivated one', async () => {
      const type = await db.ExpenseType.create({ name: 'TEST_Medical' });
      await type.update({ isActive: false });

      const res = await request(app)
        .post('/api/picklists/expense-types')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ name: 'TEST_Medical' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_Medical');
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/picklists/expense-types')
        .send({ name: 'TEST_NoAuth' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/picklists/expense-types')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /expense-types/:uuid', () => {
    it('should update expense type name with picklists.update permission', async () => {
      const type = await db.ExpenseType.create({ name: 'TEST_Original' });

      const res = await request(app)
        .patch(`/api/picklists/expense-types/${type.uuid}`)
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('TEST_Updated');
      expect(res.body.data.uuid).toBe(type.uuid);
    });

    it('should deactivate an expense type by setting isActive to false', async () => {
      const type = await db.ExpenseType.create({ name: 'TEST_Deactivate' });

      const res = await request(app)
        .patch(`/api/picklists/expense-types/${type.uuid}`)
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ isActive: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should return 404 for non-existent expense type', async () => {
      const res = await request(app)
        .patch('/api/picklists/expense-types/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ name: 'TEST_New' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when updating to a duplicate name', async () => {
      const type1 = await db.ExpenseType.create({ name: 'TEST_Type1' });
      const type2 = await db.ExpenseType.create({ name: 'TEST_Type2' });

      const res = await request(app)
        .patch(`/api/picklists/expense-types/${type2.uuid}`)
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ name: 'TEST_Type1' });

      expect(res.statusCode).toBe(409);
    });

    it('should return 400 when update has no fields', async () => {
      const type = await db.ExpenseType.create({ name: 'TEST_Empty' });

      const res = await request(app)
        .patch(`/api/picklists/expense-types/${type.uuid}`)
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });
});
