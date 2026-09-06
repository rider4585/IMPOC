import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';

describe('Payment Methods Module - /api/picklists/payment-methods', () => {
  let adminToken;
  let inventoryToken;

  beforeAll(async () => {
    await initializeTestDatabase();

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

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: adminData.username,
        password: adminData.password,
      });
    adminToken = adminLoginRes.body.data.accessToken;

    // Create inventory manager user (has inventory.create and inventory.update)
    const inventoryData = generateTestUser({ password: 'Inventory123!' });
    const inventoryUser = await db.User.create({
      username: inventoryData.username,
      email: inventoryData.email,
      firstName: inventoryData.firstName,
      passwordHash: await argon2.hash(inventoryData.password),
    });
    const invRole = await db.Role.findOne({ where: { name: 'INVENTORY_MANAGER' } });
    await inventoryUser.addRole(invRole);

    const inventoryLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: inventoryData.username,
        password: inventoryData.password,
      });
    inventoryToken = inventoryLoginRes.body.data.accessToken;
  });

  afterEach(async () => {
    // Clean up test payment methods
    await db.PaymentMethod.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_%' } } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /payment-methods', () => {
    it('should list cash-handling defaults with authentication', async () => {
      await db.PaymentMethod.create({ name: 'Cash' });
      await db.PaymentMethod.create({ name: 'UPI' });

      const res = await request(app)
        .get('/api/picklists/payment-methods')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const names = res.body.data.map((m) => m.name);
      expect(names).toContain('Cash');
      expect(names).toContain('UPI');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/payment-methods');

      expect(res.statusCode).toBe(401);
    });

    it('should not expose internal id field', async () => {
      await db.PaymentMethod.create({ name: 'TEST_Wallet' });

      const res = await request(app)
        .get('/api/picklists/payment-methods')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      res.body.data.forEach((method) => {
        expect(method).not.toHaveProperty('id');
        expect(method).toHaveProperty('uuid');
        expect(method).toHaveProperty('name');
        expect(method).toHaveProperty('isActive');
      });
    });
  });

  describe('POST /payment-methods', () => {
    it('should create payment method with inventory.create permission', async () => {
      const res = await request(app)
        .post('/api/picklists/payment-methods')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Card' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.name).toBe('TEST_Card');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 409 for duplicate active payment method name', async () => {
      await db.PaymentMethod.create({ name: 'TEST_Gpay' });

      const res = await request(app)
        .post('/api/picklists/payment-methods')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Gpay' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Payment method already exists');
    });

    it('should allow creating a payment method with same name as a deactivated one', async () => {
      const method = await db.PaymentMethod.create({ name: 'TEST_Cheque' });
      await method.update({ isActive: false });

      const res = await request(app)
        .post('/api/picklists/payment-methods')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Cheque' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_Cheque');
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/picklists/payment-methods')
        .send({ name: 'TEST_NoAuth' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/picklists/payment-methods')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /payment-methods/:uuid', () => {
    it('should update payment method name with inventory.update permission', async () => {
      const method = await db.PaymentMethod.create({ name: 'TEST_Original' });

      const res = await request(app)
        .patch(`/api/picklists/payment-methods/${method.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('TEST_Updated');
      expect(res.body.data.uuid).toBe(method.uuid);
    });

    it('should deactivate a payment method by setting isActive to false', async () => {
      const method = await db.PaymentMethod.create({ name: 'TEST_Deactivate' });

      const res = await request(app)
        .patch(`/api/picklists/payment-methods/${method.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ isActive: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should return 404 for non-existent payment method', async () => {
      const res = await request(app)
        .patch('/api/picklists/payment-methods/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_New' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when updating to a duplicate name', async () => {
      const method1 = await db.PaymentMethod.create({ name: 'TEST_Method1' });
      const method2 = await db.PaymentMethod.create({ name: 'TEST_Method2' });

      const res = await request(app)
        .patch(`/api/picklists/payment-methods/${method2.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Method1' });

      expect(res.statusCode).toBe(409);
    });

    it('should return 400 when update has no fields', async () => {
      const method = await db.PaymentMethod.create({ name: 'TEST_Empty' });

      const res = await request(app)
        .patch(`/api/picklists/payment-methods/${method.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });
});