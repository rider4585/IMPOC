import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Stock Intakes Module - /api/stock-intakes', () => {
  let testDb;
  let adminToken;
  let inventoryToken;
  let adminUser;
  let inventoryUser;
  let activeVendor;
  let inactiveVendor;

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

    // Create test vendors
    activeVendor = await db.Vendor.create({ name: 'TEST_ActiveVendor', isActive: true });
    inactiveVendor = await db.Vendor.create({ name: 'TEST_InactiveVendor', isActive: false });
  });

  afterEach(async () => {
    // Clean up test stock intakes
    await db.StockIntake.destroy({ where: { billReference: { [db.Sequelize.Op.like]: 'TEST_%' } }, force: true });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /stock-intakes', () => {
    it('should list all stock intakes with authentication', async () => {
      // Create a test intake
      await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-26',
        billReference: 'TEST_INV-001',
        totalPaidPaise: 50000,
      });

      const res = await request(app)
        .get('/api/stock-intakes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Should be ordered by purchasedOn DESC
      if (res.body.data.length > 1) {
        for (let i = 0; i < res.body.data.length - 1; i++) {
          expect(new Date(res.body.data[i].purchasedOn) >= new Date(res.body.data[i + 1].purchasedOn)).toBe(true);
        }
      }
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/stock-intakes');

      expect(res.statusCode).toBe(401);
    });

    it('should not expose internal id field', async () => {
      const intake = await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-26',
        billReference: 'TEST_INV-002',
        totalPaidPaise: 100000,
      });

      const res = await request(app)
        .get('/api/stock-intakes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Verify no id field is exposed
      res.body.data.forEach(intake => {
        expect(intake).not.toHaveProperty('id');
        expect(intake).toHaveProperty('uuid');
        expect(intake).toHaveProperty('vendorUuid');
        expect(intake).toHaveProperty('purchasedOn');
        expect(intake).toHaveProperty('totalPaidPaise');
        expect(intake).toHaveProperty('variancePaise');
      });
    });

    it('should compute variancePaise as totalPaidPaise when no lots exist', async () => {
      const intake = await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-26',
        billReference: 'TEST_INV-003',
        totalPaidPaise: 75000,
      });

      const res = await request(app)
        .get('/api/stock-intakes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const foundIntake = res.body.data.find(i => i.uuid === intake.uuid);
      expect(foundIntake).toBeDefined();
      expect(foundIntake.variancePaise).toBe(75000);
    });
  });

  describe('POST /stock-intakes', () => {
    it('should create stock intake with all fields using inventory.create permission', async () => {
      const res = await request(app)
        .post('/api/stock-intakes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: activeVendor.uuid,
          purchasedOn: '2026-08-26',
          billReference: 'TEST_INV-004',
          totalPaidPaise: 50000,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.vendorUuid).toBe(activeVendor.uuid);
      expect(res.body.data.purchasedOn).toBe('2026-08-26');
      expect(res.body.data.billReference).toBe('TEST_INV-004');
      expect(res.body.data.totalPaidPaise).toBe(50000);
      expect(res.body.data.variancePaise).toBe(50000); // No lots yet
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should create stock intake without billReference', async () => {
      const res = await request(app)
        .post('/api/stock-intakes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: activeVendor.uuid,
          purchasedOn: '2026-08-26',
          totalPaidPaise: 120000,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendorUuid).toBe(activeVendor.uuid);
      expect(res.body.data.billReference).toBeNull();
      expect(res.body.data.totalPaidPaise).toBe(120000);
      expect(res.body.data.variancePaise).toBe(120000);
    });

    it('should return 404 when vendor does not exist', async () => {
      const res = await request(app)
        .post('/api/stock-intakes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: '00000000-0000-0000-0000-000000000000',
          purchasedOn: '2026-08-26',
          billReference: 'TEST_INV-005',
          totalPaidPaise: 50000,
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Vendor not found');
    });

    it('should return 400 when vendor is inactive', async () => {
      const res = await request(app)
        .post('/api/stock-intakes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: inactiveVendor.uuid,
          purchasedOn: '2026-08-26',
          billReference: 'TEST_INV-006',
          totalPaidPaise: 50000,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('inactive');
    });

    it('should return 400 when purchasedOn is missing', async () => {
      const res = await request(app)
        .post('/api/stock-intakes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: activeVendor.uuid,
          billReference: 'TEST_INV-007',
          totalPaidPaise: 50000,
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when purchasedOn is blank', async () => {
      const res = await request(app)
        .post('/api/stock-intakes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: activeVendor.uuid,
          purchasedOn: '',
          billReference: 'TEST_INV-008',
          totalPaidPaise: 50000,
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when totalPaidPaise is negative', async () => {
      const res = await request(app)
        .post('/api/stock-intakes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: activeVendor.uuid,
          purchasedOn: '2026-08-26',
          billReference: 'TEST_INV-009',
          totalPaidPaise: -1000,
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 409 when duplicate bill reference for same vendor', async () => {
      // Create first intake
      await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-26',
        billReference: 'TEST_INV-DUP',
        totalPaidPaise: 50000,
      });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/stock-intakes')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: activeVendor.uuid,
          purchasedOn: '2026-08-26',
          billReference: 'TEST_INV-DUP',
          totalPaidPaise: 60000,
        });

      expect(res.statusCode).toBe(409);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/stock-intakes')
        .send({
          vendorUuid: activeVendor.uuid,
          purchasedOn: '2026-08-26',
          billReference: 'TEST_INV-010',
          totalPaidPaise: 50000,
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
        .post('/api/stock-intakes')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          vendorUuid: activeVendor.uuid,
          purchasedOn: '2026-08-26',
          billReference: 'TEST_INV-011',
          totalPaidPaise: 50000,
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /stock-intakes/:uuid', () => {
    it('should get stock intake by uuid with authentication', async () => {
      const intake = await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-26',
        billReference: 'TEST_INV-012',
        totalPaidPaise: 85000,
      });

      const res = await request(app)
        .get(`/api/stock-intakes/${intake.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uuid).toBe(intake.uuid);
      expect(res.body.data.vendorUuid).toBe(activeVendor.uuid);
      expect(res.body.data.purchasedOn).toBe('2026-08-26');
      expect(res.body.data.billReference).toBe('TEST_INV-012');
      expect(res.body.data.totalPaidPaise).toBe(85000);
      expect(res.body.data.variancePaise).toBe(85000); // No lots yet
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 404 for non-existent stock intake', async () => {
      const res = await request(app)
        .get('/api/stock-intakes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Trip not found');
    });

    it('should return 401 without authentication', async () => {
      const intake = await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-26',
        billReference: 'TEST_INV-013',
        totalPaidPaise: 50000,
      });

      const res = await request(app)
        .get(`/api/stock-intakes/${intake.uuid}`);

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/stock-intakes/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Stock intake ordering', () => {
    it('should return intakes ordered by purchasedOn DESC', async () => {
      // Create intakes with different dates
      const intake1 = await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-24',
        billReference: 'TEST_DATE-001',
        totalPaidPaise: 10000,
      });

      const intake2 = await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-26',
        billReference: 'TEST_DATE-002',
        totalPaidPaise: 20000,
      });

      const intake3 = await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-25',
        billReference: 'TEST_DATE-003',
        totalPaidPaise: 15000,
      });

      const res = await request(app)
        .get('/api/stock-intakes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      // Find our test intakes in the response
      const uuids = res.body.data.map(i => i.uuid);
      const intake2Index = uuids.indexOf(intake2.uuid);
      const intake3Index = uuids.indexOf(intake3.uuid);
      const intake1Index = uuids.indexOf(intake1.uuid);

      // Should be ordered: 2026-08-26, 2026-08-25, 2026-08-24
      if (intake2Index !== -1 && intake3Index !== -1 && intake1Index !== -1) {
        expect(intake2Index < intake3Index).toBe(true);
        expect(intake3Index < intake1Index).toBe(true);
      }
    });
  });

  describe('Soft delete behavior', () => {
    it('should not expose soft-deleted intakes', async () => {
      const intake = await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-26',
        billReference: 'TEST_SOFT-DELETE',
        totalPaidPaise: 50000,
      });

      // Soft delete the intake
      await intake.destroy();

      const res = await request(app)
        .get('/api/stock-intakes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const uuids = res.body.data.map(i => i.uuid);
      expect(uuids).not.toContain(intake.uuid);
    });

    it('should return 404 when trying to get soft-deleted intake', async () => {
      const intake = await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-26',
        billReference: 'TEST_SOFT-DELETE-2',
        totalPaidPaise: 50000,
      });

      // Soft delete the intake
      await intake.destroy();

      const res = await request(app)
        .get(`/api/stock-intakes/${intake.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /stock-intakes/:tripUuid/clone-last-lot', () => {
    let testProductType;
    let testTrip;

    beforeEach(async () => {
      // Create test product type
      testProductType = await db.ProductType.create({
        name: 'TEST_CloneProductType',
        isActive: true,
      });

      // Create a test trip
      testTrip = await db.StockIntake.create({
        vendorId: activeVendor.id,
        purchasedOn: '2026-08-26',
        billReference: 'TEST_CLONE_TRIP',
        totalPaidPaise: 100000,
      });
    });

    afterEach(async () => {
      // Clean up test data
      await db.StockIntakeLine.destroy({
        where: { productTypeId: testProductType.id },
        force: true,
      });
      await db.ProductType.destroy({
        where: { name: 'TEST_CloneProductType' },
        force: true,
      });
      await db.StockIntake.destroy({
        where: { billReference: 'TEST_CLONE_TRIP' },
        force: true,
      });
    });

    it('should return 200 with last lot data for happy path', async () => {
      // Create a RETAIL lot
      const lot = await db.StockIntakeLine.create({
        stockIntakeId: testTrip.id,
        productTypeId: testProductType.id,
        quantity: 10,
        buyingPricePaise: 1000,
        sellingPricePaise: 2000,
        floorPricePaise: 1500,
        channel: 'RETAIL',
      });

      const res = await request(app)
        .get(`/api/stock-intakes/${testTrip.uuid}/clone-last-lot`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('productTypeUuid', testProductType.uuid);
      expect(res.body.data).toHaveProperty('quantity', 10);
      expect(res.body.data).toHaveProperty('buyingPricePaise', '1000');
      expect(res.body.data).toHaveProperty('sellingPricePaise', '2000');
      expect(res.body.data).toHaveProperty('floorPricePaise', '1500');
      expect(res.body.data).toHaveProperty('channel', 'RETAIL');
      expect(res.body.data.rentPerDayPaise).toBeNull();
      expect(res.body.data.depositPaise).toBeNull();
      expect(res.body.data.overduePerDayPaise).toBeNull();
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).not.toHaveProperty('id');
      expect(res.body.data).not.toHaveProperty('uuid'); // Should not expose lot uuid
    });

    it('should return 200 with RENTAL lot including rental terms', async () => {
      // Create a RENTAL lot
      const lot = await db.StockIntakeLine.create({
        stockIntakeId: testTrip.id,
        productTypeId: testProductType.id,
        quantity: 5,
        buyingPricePaise: 5000,
        sellingPricePaise: 10000,
        floorPricePaise: 8000,
        channel: 'RENTAL',
        rentPerDayPaise: 500,
        depositPaise: 3000,
        overduePerDayPaise: 1000,
      });

      const res = await request(app)
        .get(`/api/stock-intakes/${testTrip.uuid}/clone-last-lot`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('channel', 'RENTAL');
      expect(res.body.data).toHaveProperty('rentPerDayPaise', '500');
      expect(res.body.data).toHaveProperty('depositPaise', '3000');
      expect(res.body.data).toHaveProperty('overduePerDayPaise', '1000');
    });

    it('should return the most recent lot when multiple lots exist', async () => {
      // Create first lot
      const lot1 = await db.StockIntakeLine.create({
        stockIntakeId: testTrip.id,
        productTypeId: testProductType.id,
        quantity: 5,
        buyingPricePaise: 1000,
        sellingPricePaise: 2000,
        floorPricePaise: 1500,
        channel: 'RETAIL',
      });

      // Wait a tiny bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create second lot
      const lot2 = await db.StockIntakeLine.create({
        stockIntakeId: testTrip.id,
        productTypeId: testProductType.id,
        quantity: 15,
        buyingPricePaise: 2000,
        sellingPricePaise: 3000,
        floorPricePaise: 2500,
        channel: 'RETAIL',
      });

      const res = await request(app)
        .get(`/api/stock-intakes/${testTrip.uuid}/clone-last-lot`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('quantity', 15);
      expect(res.body.data).toHaveProperty('buyingPricePaise', '2000');
      expect(res.body.data).toHaveProperty('sellingPricePaise', '3000');
    });

    it('should exclude soft-deleted lots', async () => {
      // Create and delete first lot
      const lot1 = await db.StockIntakeLine.create({
        stockIntakeId: testTrip.id,
        productTypeId: testProductType.id,
        quantity: 5,
        buyingPricePaise: 1000,
        sellingPricePaise: 2000,
        floorPricePaise: 1500,
        channel: 'RETAIL',
      });
      await lot1.destroy();

      // Create second lot
      const lot2 = await db.StockIntakeLine.create({
        stockIntakeId: testTrip.id,
        productTypeId: testProductType.id,
        quantity: 10,
        buyingPricePaise: 1500,
        sellingPricePaise: 2500,
        floorPricePaise: 2000,
        channel: 'RETAIL',
      });

      const res = await request(app)
        .get(`/api/stock-intakes/${testTrip.uuid}/clone-last-lot`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('quantity', 10);
      expect(res.body.data).toHaveProperty('buyingPricePaise', '1500');
    });

    it('should return 404 when no lots exist in trip', async () => {
      const res = await request(app)
        .get(`/api/stock-intakes/${testTrip.uuid}/clone-last-lot`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('No lots found to clone for this trip');
    });

    it('should return 404 when trip does not exist', async () => {
      const res = await request(app)
        .get('/api/stock-intakes/00000000-0000-0000-0000-000000000000/clone-last-lot')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Trip not found');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get(`/api/stock-intakes/${testTrip.uuid}/clone-last-lot`);

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/stock-intakes/invalid-uuid/clone-last-lot')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });

    it('should preserve price precision as strings', async () => {
      // Create lot with large paise values
      const lot = await db.StockIntakeLine.create({
        stockIntakeId: testTrip.id,
        productTypeId: testProductType.id,
        quantity: 1,
        buyingPricePaise: 123456789012345,
        sellingPricePaise: 234567890123456,
        floorPricePaise: 111111111111111,
        channel: 'RENTAL',
        rentPerDayPaise: 987654321098765,
        depositPaise: 555555555555555,
        overduePerDayPaise: 111111111111112,
      });

      const res = await request(app)
        .get(`/api/stock-intakes/${testTrip.uuid}/clone-last-lot`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      // All paise values should be strings to preserve precision
      expect(res.body.data.buyingPricePaise).toBe('123456789012345');
      expect(res.body.data.sellingPricePaise).toBe('234567890123456');
      expect(res.body.data.floorPricePaise).toBe('111111111111111');
      expect(res.body.data.rentPerDayPaise).toBe('987654321098765');
      expect(res.body.data.depositPaise).toBe('555555555555555');
      expect(res.body.data.overduePerDayPaise).toBe('111111111111112');
      // Verify they are strings, not numbers
      expect(typeof res.body.data.buyingPricePaise).toBe('string');
      expect(typeof res.body.data.sellingPricePaise).toBe('string');
      expect(typeof res.body.data.floorPricePaise).toBe('string');
    });
  });
});
