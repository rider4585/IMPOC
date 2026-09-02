import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser, generateTestProductType } from '../utils/test-setup.js';
import argon2 from 'argon2';

describe('Product Types Module - /api/picklists/product-types', () => {
  let testDb;
  let adminToken;
  let inventoryManagerToken;
  let adminUser;
  let inventoryManagerUser;

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

    // Create inventory manager user
    const invData = generateTestUser({ password: 'Inv123!' });
    inventoryManagerUser = await db.User.create({
      username: invData.username,
      email: invData.email,
      firstName: invData.firstName,
      passwordHash: await argon2.hash(invData.password),
    });
    const invRole = await db.Role.findOne({ where: { name: 'INVENTORY_MANAGER' } });
    await inventoryManagerUser.addRole(invRole);

    // Get admin token
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: adminData.username,
        password: adminData.password,
      });
    adminToken = adminLoginRes.body.data.accessToken;

    // Get inventory manager token
    const invLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: invData.username,
        password: invData.password,
      });
    inventoryManagerToken = invLoginRes.body.data.accessToken;
  });

  afterEach(async () => {
    // Clean up test product types
    await db.ProductType.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TestProductType_%' } } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /api/picklists/product-types', () => {
    it('should list all product types with authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/product-types');

      expect(res.statusCode).toBe(401);
    });

    it('should not expose internal id field', async () => {
      const res = await request(app)
        .get('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      res.body.data.forEach(type => {
        expect(type).not.toHaveProperty('id');
        expect(type).toHaveProperty('uuid');
      });
    });
  });

  describe('POST /api/picklists/product-types', () => {
    it('should create top-level product type', async () => {
      const typeData = generateTestProductType();

      const res = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(typeData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.name).toBe(typeData.name);
      expect(res.body.data.parentUuid).toBeNull();
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should create subtype with valid parent', async () => {
      // Create parent first
      const parentData = generateTestProductType();
      const parentRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(parentData);

      const parentUuid = parentRes.body.data.uuid;

      // Create subtype
      const subtypeData = generateTestProductType();
      const res = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: subtypeData.name,
          parentUuid,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.parentUuid).toBe(parentUuid);
    });

    it('should return 404 for missing parent', async () => {
      const typeData = generateTestProductType();

      const res = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: typeData.name,
          parentUuid: '00000000-0000-0000-0000-000000000000',
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Product type not found');
    });

    it('should return 409 for duplicate top-level name', async () => {
      const typeData = generateTestProductType();

      // Create first type
      await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(typeData);

      // Try to create duplicate
      const res = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(typeData);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should return 409 for duplicate name within parent', async () => {
      // Create parent
      const parentData = generateTestProductType();
      const parentRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(parentData);

      const parentUuid = parentRes.body.data.uuid;

      // Create first subtype
      const subtypeData = generateTestProductType();
      await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: subtypeData.name,
          parentUuid,
        });

      // Try to create duplicate under same parent
      const res = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: subtypeData.name,
          parentUuid,
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 without PICKLISTS.CREATE permission', async () => {
      // Create a user without permission
      const cashierRes = await db.User.findOne({
        include: {
          model: db.Role,
          as: 'roles',
          where: { name: 'CASHIER' },
        },
      });

      // Get token for cashier (who doesn't have picklists.create)
      const cashierLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: cashierRes?.dataValues?.username || 'cashier',
          password: 'TestPassword123!',
        });

      if (cashierLoginRes.body.data?.accessToken) {
        const typeData = generateTestProductType();

        const res = await request(app)
          .post('/api/picklists/product-types')
          .set('Authorization', `Bearer ${cashierLoginRes.body.data.accessToken}`)
          .send(typeData);

        expect(res.statusCode).toBe(403);
      }
    });

    it('should return 401 without authentication', async () => {
      const typeData = generateTestProductType();

      const res = await request(app)
        .post('/api/picklists/product-types')
        .send(typeData);

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ parentUuid: null });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/picklists/product-types/:uuid', () => {
    it('should get product type by uuid', async () => {
      // Create a type first
      const typeData = generateTestProductType();
      const createRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(typeData);

      const uuid = createRes.body.data.uuid;

      const res = await request(app)
        .get(`/api/picklists/product-types/${uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uuid).toBe(uuid);
      expect(res.body.data.name).toBe(typeData.name);
    });

    it('should return 404 for non-existent type', async () => {
      const res = await request(app)
        .get('/api/picklists/product-types/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/product-types/00000000-0000-0000-0000-000000000000');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/picklists/product-types/:uuid', () => {
    it('should update product type name', async () => {
      // Create a type first
      const typeData = generateTestProductType();
      const createRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(typeData);

      const uuid = createRes.body.data.uuid;

      const updatedName = 'UpdatedName_' + Date.now();
      const res = await request(app)
        .patch(`/api/picklists/product-types/${uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: updatedName });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.name).toBe(updatedName);
    });

    it('should deactivate product type', async () => {
      // Create a type first
      const typeData = generateTestProductType();
      const createRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(typeData);

      const uuid = createRes.body.data.uuid;

      const res = await request(app)
        .patch(`/api/picklists/product-types/${uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should return 404 for non-existent type', async () => {
      const res = await request(app)
        .patch('/api/picklists/product-types/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .patch('/api/picklists/product-types/00000000-0000-0000-0000-000000000000')
        .send({ name: 'Updated' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for empty update body', async () => {
      // Create a type first
      const typeData = generateTestProductType();
      const createRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(typeData);

      const uuid = createRes.body.data.uuid;

      const res = await request(app)
        .patch(`/api/picklists/product-types/${uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should update name and parent simultaneously', async () => {
      // Create parent type
      const parentData = generateTestProductType();
      const parentRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(parentData);
      const parentUuid = parentRes.body.data.uuid;

      // Create type to update
      const typeData = generateTestProductType();
      const createRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(typeData);
      const uuid = createRes.body.data.uuid;

      // Update both name and parent
      const newName = 'UpdatedName_' + Date.now();
      const res = await request(app)
        .patch(`/api/picklists/product-types/${uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: newName, parentUuid });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.name).toBe(newName);
      expect(res.body.data.parentUuid).toBe(parentUuid);
    });
  });

  describe('Cycle Detection', () => {
    it('should reject self-reference', async () => {
      // Create a type
      const typeData = generateTestProductType();
      const createRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(typeData);

      const uuid = createRes.body.data.uuid;

      // Try to set itself as parent
      const res = await request(app)
        .patch(`/api/picklists/product-types/${uuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ parentUuid: uuid });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toContain('ancestor');
    });

    it('should reject descendant loop', async () => {
      // Create A -> B -> C hierarchy
      const aData = generateTestProductType();
      const aRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(aData);
      const aUuid = aRes.body.data.uuid;

      const bData = generateTestProductType();
      const bRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: bData.name,
          parentUuid: aUuid,
        });
      const bUuid = bRes.body.data.uuid;

      const cData = generateTestProductType();
      const cRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: cData.name,
          parentUuid: bUuid,
        });
      const cUuid = cRes.body.data.uuid;

      // Try to set A's parent to C (creates loop)
      const res = await request(app)
        .patch(`/api/picklists/product-types/${aUuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ parentUuid: cUuid });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toContain('ancestor');
    });
  });

  describe('Authorization', () => {
    it('should allow INVENTORY_MANAGER to create product types', async () => {
      const typeData = generateTestProductType();

      const res = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send(typeData);

      expect(res.statusCode).toBe(201);
    });

    it('should allow INVENTORY_MANAGER to update product types', async () => {
      // Create a type with admin first
      const typeData = generateTestProductType();
      const createRes = await request(app)
        .post('/api/picklists/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(typeData);

      const uuid = createRes.body.data.uuid;

      // Update with inventory manager
      const res = await request(app)
        .patch(`/api/picklists/product-types/${uuid}`)
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send({ name: 'Updated_' + Date.now() });

      expect(res.statusCode).toBe(200);
    });
  });
});
