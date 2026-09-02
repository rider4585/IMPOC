import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Sizes Module - /api/picklists/sizes', () => {
  let testDb;
  let adminToken;
  let inventoryToken;
  let adminUser;
  let inventoryUser;

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

    // Create inventory manager user (has inventory.create and inventory.update)
    const inventoryData = generateTestUser({ password: 'Inventory123!' });
    inventoryUser = await db.User.create({
      username: inventoryData.username,
      email: inventoryData.email,
      firstName: inventoryData.firstName,
      passwordHash: await argon2.hash(inventoryData.password),
    });
    const invRole = await db.Role.findOne({ where: { name: 'INVENTORY_MANAGER' } });
    await inventoryUser.addRole(invRole);

    // Get inventory token
    const inventoryLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: inventoryData.username,
        password: inventoryData.password,
      });
    inventoryToken = inventoryLoginRes.body.data.accessToken;
  });

  afterEach(async () => {
    // Clean up test sizes
    await db.Size.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_%' } } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /sizes', () => {
    it('should list all sizes with authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/sizes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/sizes');

      expect(res.statusCode).toBe(401);
    });

    it('should not expose internal id field', async () => {
      // Create a test size first
      await db.Size.create({ name: 'TEST_Small' });

      const res = await request(app)
        .get('/api/picklists/sizes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Verify no id field is exposed
      res.body.data.forEach(size => {
        expect(size).not.toHaveProperty('id');
        expect(size).toHaveProperty('uuid');
        expect(size).toHaveProperty('name');
        expect(size).toHaveProperty('isActive');
      });
    });
  });

  describe('POST /sizes', () => {
    it('should create size with inventory.create permission', async () => {
      const res = await request(app)
        .post('/api/picklists/sizes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Medium' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.name).toBe('TEST_Medium');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 409 for duplicate active size name', async () => {
      // Create first size
      await db.Size.create({ name: 'TEST_Large' });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/picklists/sizes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Large' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Size already exists');
    });

    it('should allow creating size with same name as deactivated size', async () => {
      // Create and deactivate a size
      const size = await db.Size.create({ name: 'TEST_XLarge' });
      await size.update({ isActive: false });

      // Try to create new size with same name
      const res = await request(app)
        .post('/api/picklists/sizes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_XLarge' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_XLarge');
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/picklists/sizes')
        .send({ name: 'TEST_Free' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 without inventory.create permission', async () => {
      // Create a cashier user (no create permission)
      const cashierData = generateTestUser({ password: 'Cashier123!' });
      const cashierUser = await db.User.create({
        username: cashierData.username,
        email: cashierData.email,
        firstName: cashierData.firstName,
        passwordHash: await argon2.hash(cashierData.password),
      });
      const cashierRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
      await cashierUser.addRole(cashierRole);

      const cashierLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: cashierData.username,
          password: cashierData.password,
        });
      const cashierToken = cashierLoginRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/picklists/sizes')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ name: 'TEST_OneSize' });

      expect(res.statusCode).toBe(403);
    });

    it('should trim whitespace from name', async () => {
      const res = await request(app)
        .post('/api/picklists/sizes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: '  TEST_Custom  ' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_Custom');
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/picklists/sizes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for name exceeding max length', async () => {
      const res = await request(app)
        .post('/api/picklists/sizes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'A'.repeat(101) });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /sizes/:uuid', () => {
    it('should get size by uuid with authentication', async () => {
      const size = await db.Size.create({ name: 'TEST_Regular' });

      const res = await request(app)
        .get(`/api/picklists/sizes/${size.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uuid).toBe(size.uuid);
      expect(res.body.data.name).toBe('TEST_Regular');
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 404 for non-existent size', async () => {
      const res = await request(app)
        .get('/api/picklists/sizes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Size not found');
    });

    it('should return 401 without authentication', async () => {
      const size = await db.Size.create({ name: 'TEST_Mini' });

      const res = await request(app)
        .get(`/api/picklists/sizes/${size.uuid}`);

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/picklists/sizes/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /sizes/:uuid', () => {
    it('should update size name with inventory.update permission', async () => {
      const size = await db.Size.create({ name: 'TEST_OriginalSize' });

      const res = await request(app)
        .patch(`/api/picklists/sizes/${size.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_UpdatedSize' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('TEST_UpdatedSize');
      expect(res.body.data.uuid).toBe(size.uuid);
    });

    it('should deactivate size by setting isActive to false', async () => {
      const size = await db.Size.create({ name: 'TEST_DeactivateSize' });

      const res = await request(app)
        .patch(`/api/picklists/sizes/${size.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ isActive: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should reactivate size by setting isActive to true', async () => {
      const size = await db.Size.create({ name: 'TEST_ReactivateSize', isActive: false });

      const res = await request(app)
        .patch(`/api/picklists/sizes/${size.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ isActive: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 404 for non-existent size', async () => {
      const res = await request(app)
        .patch('/api/picklists/sizes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_NewSize' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when updating to duplicate name', async () => {
      const size1 = await db.Size.create({ name: 'TEST_Size1' });
      const size2 = await db.Size.create({ name: 'TEST_Size2' });

      const res = await request(app)
        .patch(`/api/picklists/sizes/${size2.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Size1' });

      expect(res.statusCode).toBe(409);
    });

    it('should return 401 without authentication', async () => {
      const size = await db.Size.create({ name: 'TEST_NoAuth' });

      const res = await request(app)
        .patch(`/api/picklists/sizes/${size.uuid}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 without inventory.update permission', async () => {
      const size = await db.Size.create({ name: 'TEST_NoPermission' });

      // Create a cashier user (no update permission)
      const cashierData = generateTestUser({ password: 'Cashier123!' });
      const cashierUser = await db.User.create({
        username: cashierData.username,
        email: cashierData.email,
        firstName: cashierData.firstName,
        passwordHash: await argon2.hash(cashierData.password),
      });
      const cashierRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
      await cashierUser.addRole(cashierRole);

      const cashierLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: cashierData.username,
          password: cashierData.password,
        });
      const cashierToken = cashierLoginRes.body.data.accessToken;

      const res = await request(app)
        .patch(`/api/picklists/sizes/${size.uuid}`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(403);
    });

    it('should return 400 when update has no fields', async () => {
      const size = await db.Size.create({ name: 'TEST_EmptyUpdate' });

      const res = await request(app)
        .patch(`/api/picklists/sizes/${size.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });
});
