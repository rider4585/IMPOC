import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Colours Module - /api/picklists/colours', () => {
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
    // Clean up test colours
    await db.Colour.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_%' } } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /colours', () => {
    it('should list all colours with authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/colours')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/colours');

      expect(res.statusCode).toBe(401);
    });

    it('should not expose internal id field', async () => {
      // Create a test colour first
      await db.Colour.create({ name: 'TEST_Red' });

      const res = await request(app)
        .get('/api/picklists/colours')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Verify no id field is exposed
      res.body.data.forEach(colour => {
        expect(colour).not.toHaveProperty('id');
        expect(colour).toHaveProperty('uuid');
        expect(colour).toHaveProperty('name');
        expect(colour).toHaveProperty('isActive');
      });
    });
  });

  describe('POST /colours', () => {
    it('should create colour with inventory.create permission', async () => {
      const res = await request(app)
        .post('/api/picklists/colours')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Red' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.name).toBe('TEST_Red');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 409 for duplicate active colour name', async () => {
      // Create first colour
      await db.Colour.create({ name: 'TEST_Blue' });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/picklists/colours')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Blue' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Colour already exists');
    });

    it('should allow creating colour with same name as deactivated colour', async () => {
      // Create and deactivate a colour
      const colour = await db.Colour.create({ name: 'TEST_Green' });
      await colour.update({ isActive: false });

      // Try to create new colour with same name
      const res = await request(app)
        .post('/api/picklists/colours')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Green' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_Green');
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/picklists/colours')
        .send({ name: 'TEST_Yellow' });

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
        .post('/api/picklists/colours')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ name: 'TEST_Purple' });

      expect(res.statusCode).toBe(403);
    });

    it('should trim whitespace from name', async () => {
      const res = await request(app)
        .post('/api/picklists/colours')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: '  TEST_Orange  ' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_Orange');
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/picklists/colours')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for name exceeding max length', async () => {
      const res = await request(app)
        .post('/api/picklists/colours')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'A'.repeat(101) });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /colours/:uuid', () => {
    it('should get colour by uuid with authentication', async () => {
      const colour = await db.Colour.create({ name: 'TEST_Pink' });

      const res = await request(app)
        .get(`/api/picklists/colours/${colour.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uuid).toBe(colour.uuid);
      expect(res.body.data.name).toBe('TEST_Pink');
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 404 for non-existent colour', async () => {
      const res = await request(app)
        .get('/api/picklists/colours/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Colour not found');
    });

    it('should return 401 without authentication', async () => {
      const colour = await db.Colour.create({ name: 'TEST_Brown' });

      const res = await request(app)
        .get(`/api/picklists/colours/${colour.uuid}`);

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/picklists/colours/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /colours/:uuid', () => {
    it('should update colour name with inventory.update permission', async () => {
      const colour = await db.Colour.create({ name: 'TEST_Original' });

      const res = await request(app)
        .patch(`/api/picklists/colours/${colour.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('TEST_Updated');
      expect(res.body.data.uuid).toBe(colour.uuid);
    });

    it('should deactivate colour by setting isActive to false', async () => {
      const colour = await db.Colour.create({ name: 'TEST_Deactivate' });

      const res = await request(app)
        .patch(`/api/picklists/colours/${colour.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ isActive: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should reactivate colour by setting isActive to true', async () => {
      const colour = await db.Colour.create({ name: 'TEST_Reactivate', isActive: false });

      const res = await request(app)
        .patch(`/api/picklists/colours/${colour.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ isActive: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 404 for non-existent colour', async () => {
      const res = await request(app)
        .patch('/api/picklists/colours/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_New' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when updating to duplicate name', async () => {
      const colour1 = await db.Colour.create({ name: 'TEST_Colour1' });
      const colour2 = await db.Colour.create({ name: 'TEST_Colour2' });

      const res = await request(app)
        .patch(`/api/picklists/colours/${colour2.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Colour1' });

      expect(res.statusCode).toBe(409);
    });

    it('should return 401 without authentication', async () => {
      const colour = await db.Colour.create({ name: 'TEST_NoAuth' });

      const res = await request(app)
        .patch(`/api/picklists/colours/${colour.uuid}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 without inventory.update permission', async () => {
      const colour = await db.Colour.create({ name: 'TEST_NoPermission' });

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
        .patch(`/api/picklists/colours/${colour.uuid}`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(403);
    });

    it('should return 400 when update has no fields', async () => {
      const colour = await db.Colour.create({ name: 'TEST_EmptyUpdate' });

      const res = await request(app)
        .patch(`/api/picklists/colours/${colour.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });
});
