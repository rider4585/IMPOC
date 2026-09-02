import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Vendors Module - /api/vendors', () => {
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
    // Clean up test vendors
    await db.Vendor.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_%' } } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /vendors', () => {
    it('should list all vendors with authentication', async () => {
      const res = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/vendors');

      expect(res.statusCode).toBe(401);
    });

    it('should not expose internal id field', async () => {
      // Create a test vendor first
      await db.Vendor.create({ name: 'TEST_Asha' });

      const res = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Verify no id field is exposed
      res.body.data.forEach(vendor => {
        expect(vendor).not.toHaveProperty('id');
        expect(vendor).toHaveProperty('uuid');
        expect(vendor).toHaveProperty('name');
        expect(vendor).toHaveProperty('isActive');
      });
    });

    it('should return both active and inactive vendors', async () => {
      // Create active vendor
      const activeVendor = await db.Vendor.create({ name: 'TEST_Active' });
      // Create inactive vendor
      const inactiveVendor = await db.Vendor.create({ name: 'TEST_Inactive', isActive: false });

      const res = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const vendorUuids = res.body.data.map(v => v.uuid);
      expect(vendorUuids).toContain(activeVendor.uuid);
      expect(vendorUuids).toContain(inactiveVendor.uuid);
    });
  });

  describe('POST /vendors', () => {
    it('should create vendor with all fields using inventory.create permission', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_Asha Wholesale',
          phone: '+91-9876543210',
          address: 'Plot 5, Market Rd',
          notes: 'Bulk orders OK'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.name).toBe('TEST_Asha Wholesale');
      expect(res.body.data.phone).toBe('+91-9876543210');
      expect(res.body.data.address).toBe('Plot 5, Market Rd');
      expect(res.body.data.notes).toBe('Bulk orders OK');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should create vendor with minimal fields (name only)', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Rajesh Traders' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('TEST_Rajesh Traders');
      expect(res.body.data.phone).toBeNull();
      expect(res.body.data.address).toBeNull();
      expect(res.body.data.notes).toBeNull();
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 409 when creating vendor with duplicate active name', async () => {
      // Create first active vendor
      const vendor1 = await db.Vendor.create({ name: 'TEST_Asha Wholesale' });

      // Try to create duplicate with same active name - should fail due to partial unique index
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Asha Wholesale' });

      expect(res.statusCode).toBe(409);
    });

    it('should allow creating vendor with name of soft-deleted vendor', async () => {
      // Create and soft-delete a vendor (sets deleted_at via paranoid mode)
      const vendor1 = await db.Vendor.create({ name: 'TEST_ReusableName' });
      await vendor1.destroy(); // Soft delete - sets deleted_at

      // Should succeed - can reuse names of soft-deleted vendors
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_ReusableName' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_ReusableName');
      expect(res.body.data.uuid).not.toBe(vendor1.uuid);
    });

    it('should allow creating vendor with duplicate phone', async () => {
      // Create first vendor
      const vendor1 = await db.Vendor.create({ name: 'TEST_Vendor1', phone: '+91-1234567890' });

      // Try to create another with same phone
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Vendor2', phone: '+91-1234567890' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.phone).toBe('+91-1234567890');
      expect(res.body.data.uuid).not.toBe(vendor1.uuid);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .send({ name: 'TEST_Vendor' });

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
        .post('/api/vendors')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ name: 'TEST_Vendor' });

      expect(res.statusCode).toBe(403);
    });

    it('should trim whitespace from name', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: '  TEST_Custom Vendor  ' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('TEST_Custom Vendor');
    });

    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for blank name', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: '' });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for null name', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: null });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for whitespace-only name', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: '   ' });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for whitespace-only phone', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Vendor', phone: '   ' });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for name exceeding max length', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'A'.repeat(101) });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /vendors/:uuid', () => {
    it('should get vendor by uuid with authentication', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SingleVendor' });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uuid).toBe(vendor.uuid);
      expect(res.body.data.name).toBe('TEST_SingleVendor');
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 404 for non-existent vendor', async () => {
      const res = await request(app)
        .get('/api/vendors/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Vendor not found');
    });

    it('should return 401 without authentication', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_NoAuth' });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}`);

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/vendors/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /vendors/:uuid', () => {
    it('should update vendor name with inventory.update permission', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_OriginalName' });

      const res = await request(app)
        .patch(`/api/vendors/${vendor.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_UpdatedName' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('TEST_UpdatedName');
      expect(res.body.data.uuid).toBe(vendor.uuid);
    });

    it('should update vendor phone only', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_Phone', phone: '+91-1111111111' });

      const res = await request(app)
        .patch(`/api/vendors/${vendor.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ phone: '+91-2222222222' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.phone).toBe('+91-2222222222');
      expect(res.body.data.name).toBe('TEST_Phone');
    });

    it('should update vendor address only', async () => {
      const vendor = await db.Vendor.create({
        name: 'TEST_Address',
        address: 'Old Address'
      });

      const res = await request(app)
        .patch(`/api/vendors/${vendor.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ address: 'New Address' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.address).toBe('New Address');
      expect(res.body.data.name).toBe('TEST_Address');
    });

    it('should update vendor notes only', async () => {
      const vendor = await db.Vendor.create({
        name: 'TEST_Notes',
        notes: 'Old notes'
      });

      const res = await request(app)
        .patch(`/api/vendors/${vendor.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ notes: 'New notes' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.notes).toBe('New notes');
      expect(res.body.data.name).toBe('TEST_Notes');
    });

    it('should deactivate vendor by setting isActive to false', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_Deactivate' });

      const res = await request(app)
        .patch(`/api/vendors/${vendor.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ isActive: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(false);
      // Verify deleted_at remains null (not a hard delete)
      const updated = await db.Vendor.findOne({ where: { uuid: vendor.uuid } });
      expect(updated.deletedAt).toBeNull();
    });

    it('should reactivate vendor by setting isActive to true', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_Reactivate', isActive: false });

      const res = await request(app)
        .patch(`/api/vendors/${vendor.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ isActive: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 409 when updating to duplicate active vendor name', async () => {
      const vendor1 = await db.Vendor.create({ name: 'TEST_Name1' });
      const vendor2 = await db.Vendor.create({ name: 'TEST_Name2' });

      // Try to update vendor2 to have the same name as vendor1
      const res = await request(app)
        .patch(`/api/vendors/${vendor2.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Name1' });

      expect(res.statusCode).toBe(409);
    });

    it('should return 404 for non-existent vendor', async () => {
      const res = await request(app)
        .patch('/api/vendors/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_NewName' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_NoAuth' });

      const res = await request(app)
        .patch(`/api/vendors/${vendor.uuid}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 without inventory.update permission', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_NoPermission' });

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
        .patch(`/api/vendors/${vendor.uuid}`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(403);
    });

    it('should return 400 when update has no fields', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_EmptyUpdate' });

      const res = await request(app)
        .patch(`/api/vendors/${vendor.uuid}`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .patch('/api/vendors/invalid-uuid')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ name: 'TEST_Updated' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /vendors/:uuid/history', () => {
    it('should return 404 for non-existent vendor', async () => {
      const res = await request(app)
        .get('/api/vendors/00000000-0000-0000-0000-000000000000/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Vendor not found');
    });

    it('should return 401 without authentication', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_History' });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`);

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/vendors/invalid-uuid/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });

    it('should return empty trips array for vendor with no trips', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_NoTrips' });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.uuid).toBe(vendor.uuid);
      expect(res.body.data.vendor.name).toBe('TEST_NoTrips');
      expect(Array.isArray(res.body.data.trips)).toBe(true);
      expect(res.body.data.trips.length).toBe(0);
    });

    it('should return vendor history with trips/lots/units sorted correctly', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_HistoryVendor' });

      // Create a trip (stock intake)
      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL001',
        totalPaidPaise: 100000,
      });

      // Create a product type
      const productType = await db.ProductType.create({
        name: 'TEST_Product',
        category: 'TEST_Category',
      });

      // Create a lot (stock intake line)
      const lot = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
      });

      // Create colour and size
      const colour = await db.Colour.create({ name: 'TEST_Red' });
      const size = await db.Size.create({ name: 'TEST_M' });

      // Create units
      const unit = await db.Unit.create({
        stockIntakeLineId: lot.id,
        barcode: '123456789012',
        colourId: colour.id,
        sizeId: size.id,
        status: 'IN_STOCK',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor.uuid).toBe(vendor.uuid);
      expect(res.body.data.trips).toHaveLength(1);

      const tripData = res.body.data.trips[0];
      expect(tripData.uuid).toBe(trip.uuid);
      expect(tripData.purchasedOn).toBe('2026-08-20');
      expect(tripData.totalPaidPaise).toBe('100000');
      expect(typeof tripData.variancePaise).toBe('string');
      expect(tripData.lines).toHaveLength(1);

      const lotData = tripData.lines[0];
      expect(lotData.uuid).toBe(lot.uuid);
      expect(lotData.productTypeUuid).toBe(productType.uuid);
      expect(lotData.quantity).toBe(10);
      expect(lotData.buyingPricePaise).toBe('5000');
      expect(lotData.sellingPricePaise).toBe('8000');
      expect(lotData.floorPricePaise).toBe('7000');
      expect(lotData.channel).toBe('RETAIL');
      expect(lotData.units).toHaveLength(1);

      const unitData = lotData.units[0];
      expect(unitData.uuid).toBe(unit.uuid);
      expect(unitData.barcode).toBe('123456789012');
      expect(unitData.status).toBe('IN_STOCK');
      expect(unitData.channel).toBe('RETAIL');
      expect(unitData.colour).toBe(colour.uuid);
      expect(unitData.size).toBe(size.uuid);
      expect(unitData.buyingPricePaise).toBe('5000');
    });

    it('should compute variance correctly: totalPaidPaise - sum(quantity * buyingPricePaise)', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_VarianceVendor' });

      // Trip with totalPaidPaise = 100000
      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL002',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product2',
        category: 'TEST_Category',
      });

      // Lot 1: quantity=10, buyingPricePaise=5000 => 50000
      const lot1 = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
      });

      // Lot 2: quantity=5, buyingPricePaise=8000 => 40000
      const lot2 = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 5,
        buyingPricePaise: 8000,
        sellingPricePaise: 10000,
        floorPricePaise: 9000,
        channel: 'RETAIL',
      });

      // Expected variance = 100000 - (10*5000 + 5*8000) = 100000 - 90000 = 10000

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const tripData = res.body.data.trips[0];
      expect(tripData.variancePaise).toBe('10000');
    });

    it('should return empty lines array for trip with no lots', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_TripNoLots' });

      // Create a trip with no lots
      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL003',
        totalPaidPaise: 50000,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const tripData = res.body.data.trips[0];
      expect(tripData.lines).toHaveLength(0);
      // Variance should equal totalPaidPaise when there are no lots
      expect(tripData.variancePaise).toBe('50000');
    });

    it('should return empty units array for lot with no units', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_LotNoUnits' });

      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL004',
        totalPaidPaise: 50000,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product3',
        category: 'TEST_Category',
      });

      // Create a lot with no units
      const lot = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const lotData = res.body.data.trips[0].lines[0];
      expect(lotData.units).toHaveLength(0);
    });

    it('should return full history for deactivated vendor', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_DeactivatedVendor', isActive: false });

      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL005',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product4',
        category: 'TEST_Category',
      });

      const lot = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.vendor.isActive).toBe(false);
      // Full history is still returned for deactivated vendor
      expect(res.body.data.trips).toHaveLength(1);
      expect(res.body.data.trips[0].lines).toHaveLength(1);
    });

    it('should filter out soft-deleted trips', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SoftDeleteTrip' });

      // Create two trips
      const trip1 = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL006',
        totalPaidPaise: 100000,
      });

      const trip2 = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-21',
        billReference: 'BILL007',
        totalPaidPaise: 50000,
      });

      // Soft delete trip1
      await trip1.destroy();

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      // Only trip2 should appear (trip1 is soft-deleted)
      expect(res.body.data.trips).toHaveLength(1);
      expect(res.body.data.trips[0].uuid).toBe(trip2.uuid);
    });

    it('should filter out soft-deleted lots', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SoftDeleteLot' });

      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL008',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product5',
        category: 'TEST_Category',
      });

      // Create two lots
      const lot1 = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
      });

      const lot2 = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 5,
        buyingPricePaise: 8000,
        sellingPricePaise: 10000,
        floorPricePaise: 9000,
        channel: 'RETAIL',
      });

      // Soft delete lot1
      await lot1.destroy();

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      // Only lot2 should appear (lot1 is soft-deleted)
      expect(res.body.data.trips[0].lines).toHaveLength(1);
      expect(res.body.data.trips[0].lines[0].uuid).toBe(lot2.uuid);
      // Variance should be recalculated: 100000 - (5 * 8000) = 60000
      expect(res.body.data.trips[0].variancePaise).toBe('60000');
    });

    it('should filter out soft-deleted units', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SoftDeleteUnit' });

      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL009',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product6',
        category: 'TEST_Category',
      });

      const lot = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
      });

      const colour = await db.Colour.create({ name: 'TEST_Blue' });
      const size = await db.Size.create({ name: 'TEST_L' });

      // Create two units
      const unit1 = await db.Unit.create({
        stockIntakeLineId: lot.id,
        barcode: '111111111111',
        colourId: colour.id,
        sizeId: size.id,
        status: 'IN_STOCK',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      const unit2 = await db.Unit.create({
        stockIntakeLineId: lot.id,
        barcode: '222222222222',
        colourId: colour.id,
        sizeId: size.id,
        status: 'IN_STOCK',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      // Soft delete unit1
      await unit1.destroy();

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      // Only unit2 should appear (unit1 is soft-deleted)
      expect(res.body.data.trips[0].lines[0].units).toHaveLength(1);
      expect(res.body.data.trips[0].lines[0].units[0].uuid).toBe(unit2.uuid);
    });

    it('should return all money fields as strings for precision', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_MoneyStrings' });

      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL010',
        totalPaidPaise: 12345678,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product7',
        category: 'TEST_Category',
      });

      const lot = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 9876543,
        sellingPricePaise: 11111111,
        floorPricePaise: 10000000,
        channel: 'RETAIL',
        rentPerDayPaise: 1000,
        depositPaise: 50000,
        overduePerDayPaise: 200,
      });

      const colour = await db.Colour.create({ name: 'TEST_Green' });
      const size = await db.Size.create({ name: 'TEST_XL' });

      const unit = await db.Unit.create({
        stockIntakeLineId: lot.id,
        barcode: '333333333333',
        colourId: colour.id,
        sizeId: size.id,
        status: 'IN_STOCK',
        channel: 'RETAIL',
        buyingPricePaise: 9876543,
        sellingPricePaise: 11111111,
        floorPricePaise: 10000000,
        rentPerDayPaise: 1000,
        depositPaise: 50000,
        overduePerDayPaise: 200,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);

      const tripData = res.body.data.trips[0];
      expect(typeof tripData.totalPaidPaise).toBe('string');
      expect(tripData.totalPaidPaise).toBe('12345678');
      expect(typeof tripData.variancePaise).toBe('string');

      const lotData = tripData.lines[0];
      expect(typeof lotData.buyingPricePaise).toBe('string');
      expect(lotData.buyingPricePaise).toBe('9876543');
      expect(typeof lotData.sellingPricePaise).toBe('string');
      expect(lotData.sellingPricePaise).toBe('11111111');
      expect(typeof lotData.floorPricePaise).toBe('string');
      expect(lotData.floorPricePaise).toBe('10000000');
      expect(typeof lotData.rentPerDayPaise).toBe('string');
      expect(lotData.rentPerDayPaise).toBe('1000');
      expect(typeof lotData.depositPaise).toBe('string');
      expect(lotData.depositPaise).toBe('50000');
      expect(typeof lotData.overduePerDayPaise).toBe('string');
      expect(lotData.overduePerDayPaise).toBe('200');

      const unitData = lotData.units[0];
      expect(typeof unitData.buyingPricePaise).toBe('string');
      expect(unitData.buyingPricePaise).toBe('9876543');
      expect(typeof unitData.sellingPricePaise).toBe('string');
      expect(unitData.sellingPricePaise).toBe('11111111');
      expect(typeof unitData.floorPricePaise).toBe('string');
      expect(unitData.floorPricePaise).toBe('10000000');
      expect(typeof unitData.rentPerDayPaise).toBe('string');
      expect(unitData.rentPerDayPaise).toBe('1000');
      expect(typeof unitData.depositPaise).toBe('string');
      expect(unitData.depositPaise).toBe('50000');
      expect(typeof unitData.overduePerDayPaise).toBe('string');
      expect(unitData.overduePerDayPaise).toBe('200');
    });

    it('should return null for optional price fields when not set', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_NullPrices' });

      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL011',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product8',
        category: 'TEST_Category',
      });

      // Create lot without rental fields
      const lot = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
        rentPerDayPaise: null,
        depositPaise: null,
        overduePerDayPaise: null,
      });

      const colour = await db.Colour.create({ name: 'TEST_Yellow' });
      const size = await db.Size.create({ name: 'TEST_S' });

      const unit = await db.Unit.create({
        stockIntakeLineId: lot.id,
        barcode: '444444444444',
        colourId: colour.id,
        sizeId: size.id,
        status: 'IN_STOCK',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        rentPerDayPaise: null,
        depositPaise: null,
        overduePerDayPaise: null,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const lotData = res.body.data.trips[0].lines[0];
      expect(lotData.rentPerDayPaise).toBeNull();
      expect(lotData.depositPaise).toBeNull();
      expect(lotData.overduePerDayPaise).toBeNull();

      const unitData = lotData.units[0];
      expect(unitData.rentPerDayPaise).toBeNull();
      expect(unitData.depositPaise).toBeNull();
      expect(unitData.overduePerDayPaise).toBeNull();
    });

    it('should preserve unit prices unchanged from lot edit (AD-24)', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_PriceDifference' });

      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL012',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product9',
        category: 'TEST_Category',
      });

      // Create lot with original prices
      const lot = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
      });

      const colour = await db.Colour.create({ name: 'TEST_Purple' });
      const size = await db.Size.create({ name: 'TEST_XXL' });

      // Unit created with original prices
      const unit = await db.Unit.create({
        stockIntakeLineId: lot.id,
        barcode: '555555555555',
        colourId: colour.id,
        sizeId: size.id,
        status: 'IN_STOCK',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      // Edit the lot to change prices (Story 3.2)
      await lot.update({
        buyingPricePaise: 6000,
        sellingPricePaise: 9000,
        floorPricePaise: 8000,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const lotData = res.body.data.trips[0].lines[0];
      const unitData = lotData.units[0];

      // Unit prices should remain at original intake values
      expect(unitData.buyingPricePaise).toBe('5000');
      expect(unitData.sellingPricePaise).toBe('8000');
      expect(unitData.floorPricePaise).toBe('7000');

      // Lot prices should be updated
      expect(lotData.buyingPricePaise).toBe('6000');
      expect(lotData.sellingPricePaise).toBe('9000');
      expect(lotData.floorPricePaise).toBe('8000');

      // Verify they differ (AD-24 assertion)
      expect(unitData.buyingPricePaise).not.toBe(lotData.buyingPricePaise);
    });

    it('should return trips sorted by purchasedOn DESC (most recent first)', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SortTrips' });

      // Create trips in non-sorted order
      const trip1 = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-19',
        billReference: 'BILL013',
        totalPaidPaise: 50000,
      });

      const trip2 = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-21',
        billReference: 'BILL014',
        totalPaidPaise: 75000,
      });

      const trip3 = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL015',
        totalPaidPaise: 100000,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.trips).toHaveLength(3);

      // Should be sorted by purchasedOn DESC: trip2 (21st), trip3 (20th), trip1 (19th)
      expect(res.body.data.trips[0].uuid).toBe(trip2.uuid);
      expect(res.body.data.trips[1].uuid).toBe(trip3.uuid);
      expect(res.body.data.trips[2].uuid).toBe(trip1.uuid);
    });

    it('should return lots sorted by createdAt ASC (creation order)', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SortLots' });

      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL016',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product10',
        category: 'TEST_Category',
      });

      // Create lots and capture their creation times
      const lot1 = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
      });

      // Add a slight delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const lot2 = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 5,
        buyingPricePaise: 8000,
        sellingPricePaise: 10000,
        floorPricePaise: 9000,
        channel: 'RETAIL',
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const lotDatas = res.body.data.trips[0].lines;
      expect(lotDatas).toHaveLength(2);

      // Should be sorted by createdAt ASC: lot1 first, then lot2
      expect(lotDatas[0].uuid).toBe(lot1.uuid);
      expect(lotDatas[1].uuid).toBe(lot2.uuid);
    });

    it('should return units sorted by createdAt ASC (scan order)', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SortUnits' });

      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL017',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product11',
        category: 'TEST_Category',
      });

      const lot = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
      });

      const colour = await db.Colour.create({ name: 'TEST_Orange' });
      const size = await db.Size.create({ name: 'TEST_2XL' });

      // Create units and capture their creation times
      const unit1 = await db.Unit.create({
        stockIntakeLineId: lot.id,
        barcode: '666666666666',
        colourId: colour.id,
        sizeId: size.id,
        status: 'IN_STOCK',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      // Add a slight delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const unit2 = await db.Unit.create({
        stockIntakeLineId: lot.id,
        barcode: '777777777777',
        colourId: colour.id,
        sizeId: size.id,
        status: 'IN_STOCK',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const unitDatas = res.body.data.trips[0].lines[0].units;
      expect(unitDatas).toHaveLength(2);

      // Should be sorted by createdAt ASC: unit1 first, then unit2
      expect(unitDatas[0].uuid).toBe(unit1.uuid);
      expect(unitDatas[1].uuid).toBe(unit2.uuid);
    });

    it('should not expose internal id fields', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_NoInternalId' });

      const trip = await db.StockIntake.create({
        vendorId: vendor.id,
        purchasedOn: '2026-08-20',
        billReference: 'BILL018',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({
        name: 'TEST_Product12',
        category: 'TEST_Category',
      });

      const lot = await db.StockIntakeLine.create({
        stockIntakeId: trip.id,
        productTypeId: productType.id,
        quantity: 10,
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
        channel: 'RETAIL',
      });

      const colour = await db.Colour.create({ name: 'TEST_Pink' });
      const size = await db.Size.create({ name: 'TEST_3XL' });

      const unit = await db.Unit.create({
        stockIntakeLineId: lot.id,
        barcode: '888888888888',
        colourId: colour.id,
        sizeId: size.id,
        status: 'IN_STOCK',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);

      // Verify vendor doesn't expose id
      expect(res.body.data.vendor).not.toHaveProperty('id');
      expect(res.body.data.vendor).toHaveProperty('uuid');

      const tripData = res.body.data.trips[0];
      expect(tripData).not.toHaveProperty('id');
      expect(tripData).toHaveProperty('uuid');

      const lotData = tripData.lines[0];
      expect(lotData).not.toHaveProperty('id');
      expect(lotData).toHaveProperty('uuid');
      expect(lotData).not.toHaveProperty('productTypeId');
      expect(lotData).toHaveProperty('productTypeUuid');

      const unitData = lotData.units[0];
      expect(unitData).not.toHaveProperty('id');
      expect(unitData).toHaveProperty('uuid');
      expect(unitData).not.toHaveProperty('colourId');
      expect(unitData).toHaveProperty('colour');
      expect(unitData).not.toHaveProperty('sizeId');
      expect(unitData).toHaveProperty('size');
    });
  });
});
