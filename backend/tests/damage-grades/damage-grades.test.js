import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Damage Grades Module - /api/picklists/damage-grades', () => {
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
    // Clean up test damage grades
    await db.DamageGrade.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_%' } } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /damage-grades', () => {
    it('should list all damage grades with authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/damage-grades');

      expect(res.statusCode).toBe(401);
    });

    it('should not expose internal id field', async () => {
      // Create a test damage grade first
      await db.DamageGrade.create({
        name: 'TEST_Mint',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });

      const res = await request(app)
        .get('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Verify no id field is exposed
      res.body.data.forEach(grade => {
        expect(grade).not.toHaveProperty('id');
        expect(grade).toHaveProperty('uuid');
        expect(grade).toHaveProperty('name');
        expect(grade).toHaveProperty('defaultChargePaise');
        expect(grade).toHaveProperty('outcome');
        expect(grade).toHaveProperty('isActive');
      });
    });

    it('should list all grades including inactive ones', async () => {
      // Create active grade
      await db.DamageGrade.create({
        name: 'TEST_Active',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });

      // Create and deactivate a grade
      const inactive = await db.DamageGrade.create({
        name: 'TEST_Inactive',
        defaultChargePaise: 5000,
        outcome: 'SEND_TO_MAINTENANCE'
      });
      await inactive.update({ isActive: false });

      const res = await request(app)
        .get('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const names = res.body.data.map(g => g.name);
      expect(names).toContain('TEST_Active');
      expect(names).toContain('TEST_Inactive');
    });
  });

  describe('POST /damage-grades', () => {
    it('should create damage grade with all three outcomes', async () => {
      const outcomes = ['RETURN_TO_STOCK', 'SEND_TO_MAINTENANCE', 'RETIRE'];

      for (const outcome of outcomes) {
        const res = await request(app)
          .post('/api/picklists/damage-grades')
          .set('Authorization', `Bearer ${inventoryToken}`)
          .send({
            name: `TEST_${outcome}`,
            defaultChargePaise: 1000,
            outcome
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('uuid');
        expect(res.body.data.name).toBe(`TEST_${outcome}`);
        expect(res.body.data.outcome).toBe(outcome);
        expect(res.body.data.defaultChargePaise).toBe(1000);
        expect(res.body.data.isActive).toBe(true);
        expect(res.body.data).toHaveProperty('createdAt');
        expect(res.body.data).toHaveProperty('updatedAt');
        expect(res.body.data).not.toHaveProperty('id');
      }
    });

    it('should create damage grade with zero charge', async () => {
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_Zero',
          defaultChargePaise: 0,
          outcome: 'RETURN_TO_STOCK'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.defaultChargePaise).toBe(0);
    });

    it('should create damage grade with large charge', async () => {
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_Expensive',
          defaultChargePaise: 999999999,
          outcome: 'SEND_TO_MAINTENANCE'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.defaultChargePaise).toBe(999999999);
    });

    it('should return 409 for duplicate active damage grade name', async () => {
      // Create first grade
      await db.DamageGrade.create({
        name: 'TEST_Duplicate',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_Duplicate',
          defaultChargePaise: 1000,
          outcome: 'RETIRE'
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Damage grade already exists');
    });

    it('should allow creating grade with same name as deactivated grade', async () => {
      // Create and deactivate a grade
      const grade = await db.DamageGrade.create({
        name: 'TEST_Reusable',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });
      await grade.update({ isActive: false });

      // Try to create new grade with same name
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_Reusable',
          defaultChargePaise: 5000,
          outcome: 'RETIRE'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_Reusable');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.outcome).toBe('RETIRE');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .send({
          name: 'TEST_NoAuth',
          defaultChargePaise: 0,
          outcome: 'RETURN_TO_STOCK'
        });

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
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          name: 'TEST_NoPermission',
          defaultChargePaise: 0,
          outcome: 'RETURN_TO_STOCK'
        });

      expect(res.statusCode).toBe(403);
    });

    it('should trim whitespace from name', async () => {
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: '  TEST_Trimmed  ',
          defaultChargePaise: 0,
          outcome: 'RETURN_TO_STOCK'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_Trimmed');
    });

    it('should return 400 for negative charge', async () => {
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_Negative',
          defaultChargePaise: -100,
          outcome: 'RETURN_TO_STOCK'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid outcome', async () => {
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_InvalidOutcome',
          defaultChargePaise: 0,
          outcome: 'INVALID_OUTCOME'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          defaultChargePaise: 0,
          outcome: 'RETURN_TO_STOCK'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for missing defaultChargePaise', async () => {
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_Missing',
          outcome: 'RETURN_TO_STOCK'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for missing outcome', async () => {
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_Missing',
          defaultChargePaise: 0
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for name exceeding max length', async () => {
      const res = await request(app)
        .post('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'A'.repeat(101),
          defaultChargePaise: 0,
          outcome: 'RETURN_TO_STOCK'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /damage-grades/:uuid', () => {
    it('should get damage grade by uuid with authentication', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_GetOne',
        defaultChargePaise: 2500,
        outcome: 'SEND_TO_MAINTENANCE'
      });

      const res = await request(app)
        .get(`/api/picklists/damage-grades/${grade.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uuid).toBe(grade.uuid);
      expect(res.body.data.name).toBe('TEST_GetOne');
      expect(res.body.data.defaultChargePaise).toBe(2500);
      expect(res.body.data.outcome).toBe('SEND_TO_MAINTENANCE');
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 404 for non-existent grade', async () => {
      const res = await request(app)
        .get('/api/picklists/damage-grades/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Damage grade not found');
    });

    it('should return 401 without authentication', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_NoAuth',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });

      const res = await request(app)
        .get(`/api/picklists/damage-grades/${grade.uuid}`);

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/picklists/damage-grades/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /damage-grades/:uuid', () => {
    it('should update damage grade name', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_UpdateName',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });

      const res = await request(app)
        .patch(`/api/picklists/damage-grades/${grade.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_UpdatedName' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('TEST_UpdatedName');
      expect(res.body.data.defaultChargePaise).toBe(0);
      expect(res.body.data.outcome).toBe('RETURN_TO_STOCK');
      expect(res.body.data.uuid).toBe(grade.uuid);
    });

    it('should update damage grade charge', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_UpdateCharge',
        defaultChargePaise: 1000,
        outcome: 'RETIRE'
      });

      const res = await request(app)
        .patch(`/api/picklists/damage-grades/${grade.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ defaultChargePaise: 5000 });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.defaultChargePaise).toBe(5000);
      expect(res.body.data.name).toBe('TEST_UpdateCharge');
      expect(res.body.data.outcome).toBe('RETIRE');
    });

    it('should update damage grade outcome', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_UpdateOutcome',
        defaultChargePaise: 3000,
        outcome: 'RETURN_TO_STOCK'
      });

      const res = await request(app)
        .patch(`/api/picklists/damage-grades/${grade.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ outcome: 'SEND_TO_MAINTENANCE' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.outcome).toBe('SEND_TO_MAINTENANCE');
      expect(res.body.data.name).toBe('TEST_UpdateOutcome');
      expect(res.body.data.defaultChargePaise).toBe(3000);
    });

    it('should deactivate grade by setting isActive to false', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_Deactivate',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });

      const res = await request(app)
        .patch(`/api/picklists/damage-grades/${grade.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ isActive: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should reactivate grade by setting isActive to true', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_Reactivate',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK',
        isActive: false
      });

      const res = await request(app)
        .patch(`/api/picklists/damage-grades/${grade.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ isActive: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 404 for non-existent grade', async () => {
      const res = await request(app)
        .patch('/api/picklists/damage-grades/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_New' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when updating to duplicate name', async () => {
      const grade1 = await db.DamageGrade.create({
        name: 'TEST_Grade1',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });
      const grade2 = await db.DamageGrade.create({
        name: 'TEST_Grade2',
        defaultChargePaise: 1000,
        outcome: 'RETIRE'
      });

      const res = await request(app)
        .patch(`/api/picklists/damage-grades/${grade2.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Grade1' });

      expect(res.statusCode).toBe(409);
    });

    it('should return 401 without authentication', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_NoAuth',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });

      const res = await request(app)
        .patch(`/api/picklists/damage-grades/${grade.uuid}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 without inventory.update permission', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_NoPermission',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });

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
        .patch(`/api/picklists/damage-grades/${grade.uuid}`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(403);
    });

    it('should return 400 when update has no fields', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_EmptyUpdate',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });

      const res = await request(app)
        .patch(`/api/picklists/damage-grades/${grade.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for negative charge on update', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_NegativeUpdate',
        defaultChargePaise: 1000,
        outcome: 'RETURN_TO_STOCK'
      });

      const res = await request(app)
        .patch(`/api/picklists/damage-grades/${grade.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ defaultChargePaise: -500 });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid outcome on update', async () => {
      const grade = await db.DamageGrade.create({
        name: 'TEST_InvalidOutcomeUpdate',
        defaultChargePaise: 0,
        outcome: 'RETURN_TO_STOCK'
      });

      const res = await request(app)
        .patch(`/api/picklists/damage-grades/${grade.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ outcome: 'INVALID' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Soft Delete Verification (paranoid mode)', () => {
    it('should not return soft-deleted grades in list', async () => {
      // Create a damage grade
      const grade = await db.DamageGrade.create({
        name: 'TEST_SoftDeleted',
        defaultChargePaise: 1000,
        outcome: 'RETURN_TO_STOCK'
      });

      // Verify it appears in the list
      let res = await request(app)
        .get('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.map(g => g.uuid)).toContain(grade.uuid);

      // Soft delete the grade using paranoid destroy
      await grade.destroy();

      // Verify it no longer appears in the list
      res = await request(app)
        .get('/api/picklists/damage-grades')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.map(g => g.uuid)).not.toContain(grade.uuid);
    });

    it('should return 404 for soft-deleted grade by uuid', async () => {
      // Create and soft-delete a damage grade
      const grade = await db.DamageGrade.create({
        name: 'TEST_SoftDeletedByUuid',
        defaultChargePaise: 500,
        outcome: 'SEND_TO_MAINTENANCE'
      });

      const gradeUuid = grade.uuid;

      // Verify it can be fetched before deletion
      let res = await request(app)
        .get(`/api/picklists/damage-grades/${gradeUuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.uuid).toBe(gradeUuid);

      // Soft delete the grade
      await grade.destroy();

      // Verify it returns 404 after deletion
      res = await request(app)
        .get(`/api/picklists/damage-grades/${gradeUuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
