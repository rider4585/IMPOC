import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
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

    it('should return vendor history with everything nested and sorted correctly', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_HistoryVendor' });

      // Trip + TripVendor bill
      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL001',
        totalPaidPaise: 100000,
      });

      // Create a product type
      const productType = await db.ProductType.create({ name: 'TEST_Product' });

      // Create a stock
      const stock = await createTestStock({
        trip,
        tripVendor,
        vendor,
        productType,
        overrides: {
          quantity: 10,
          buyingPricePaise: 5000,
          sellingPricePaise: 8000,
          floorPricePaise: 7000,
          channel: 'RETAIL',
        },
      });

      // Create colour and size
      const colour = await db.Colour.create({ name: 'TEST_Red' });
      const size = await db.Size.create({ name: 'TEST_M' });

      // Create a unit
      const unit = await db.Unit.create({
        stockId: stock.id,
        barcode: '123456789012',
        colourId: colour.id,
        sizeId: size.id,
        status: 'in_stock',
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
      expect(tripData.tripVendorUuid).toBe(tripVendor.uuid);
      expect(tripData.name).toBeTruthy();
      expect(tripData.purchasedOn).toBe('2026-08-20');
      expect(tripData.totalPaidPaise).toBe('100000');
      expect(typeof tripData.variancePaise).toBe('string');
      expect(tripData.stocks).toHaveLength(1);

      const stockData = tripData.stocks[0];
      expect(stockData.uuid).toBe(stock.uuid);
      expect(stockData.productTypeUuid).toBe(productType.uuid);
      expect(stockData.quantity).toBe(10);
      expect(stockData.buyingPricePaise).toBe('5000');
      expect(stockData.sellingPricePaise).toBe('8000');
      expect(stockData.floorPricePaise).toBe('7000');
      expect(stockData.channel).toBe('RETAIL');
      expect(stockData.units).toHaveLength(1);

      const unitData = stockData.units[0];
      expect(unitData.uuid).toBe(unit.uuid);
      expect(unitData.barcode).toBe('123456789012');
      expect(unitData.status).toBe('in_stock');
      expect(unitData.channel).toBe('RETAIL');
      expect(unitData.colour).toBe(colour.uuid);
      expect(unitData.size).toBe(size.uuid);
      expect(unitData.buyingPricePaise).toBe('5000');
    });

    it('should compute variance correctly: totalPaidPaise - sum(quantity * buyingPricePaise)', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_VarianceVendor' });

      // Trip with totalPaidPaise = 100000
      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL002',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product2' });

      // Stock 1: quantity=10, buyingPricePaise=5000 => 50000
      await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 10, buyingPricePaise: 5000, sellingPricePaise: 8000, floorPricePaise: 7000, channel: 'RETAIL' },
      });

      // Stock 2: quantity=5, buyingPricePaise=8000 => 40000
      await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 5, buyingPricePaise: 8000, sellingPricePaise: 10000, floorPricePaise: 9000, channel: 'RETAIL' },
      });

      // Expected variance = 100000 - (10*5000 + 5*8000) = 100000 - 90000 = 10000

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const tripData = res.body.data.trips[0];
      expect(tripData.variancePaise).toBe('10000');
    });

    it('should return empty stocks array for trip bill with no stocks', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_TripNoStocks' });

      // Create a trip + bill with no stocks
      const { trip } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL003',
        totalPaidPaise: 50000,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const tripData = res.body.data.trips[0];
      expect(tripData.stocks).toHaveLength(0);
      // Variance should equal totalPaidPaise when there are no stocks
      expect(tripData.variancePaise).toBe('50000');
    });

    it('should return empty units array for stock with no units', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_StockNoUnits' });

      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL004',
        totalPaidPaise: 50000,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product3' });

      // Create a stock with no units
      await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 10, buyingPricePaise: 5000, sellingPricePaise: 8000, floorPricePaise: 7000, channel: 'RETAIL' },
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const stockData = res.body.data.trips[0].stocks[0];
      expect(stockData.units).toHaveLength(0);
    });

    it('should return full history for deactivated vendor', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_DeactivatedVendor', isActive: false });

      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL005',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product4' });

      await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 10, buyingPricePaise: 5000, sellingPricePaise: 8000, floorPricePaise: 7000, channel: 'RETAIL' },
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.vendor.isActive).toBe(false);
      // Full history is still returned for deactivated vendor
      expect(res.body.data.trips).toHaveLength(1);
      expect(res.body.data.trips[0].stocks).toHaveLength(1);
    });

    it('should filter out trip bills that were removed from a vendor', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SoftDeleteTrip' });

      // Create two trip bills for this vendor
      const { tripVendor: tv1 } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL006',
        totalPaidPaise: 100000,
      });

      const { trip: trip2, tripVendor: tv2 } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-21',
        billReference: 'BILL007',
        totalPaidPaise: 50000,
      });

      // Soft delete the first trip_vendor link
      await tv1.destroy();

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      // Only the surviving bill should appear (tv1 is soft-deleted)
      expect(res.body.data.trips).toHaveLength(1);
      expect(res.body.data.trips[0].uuid).toBe(trip2.uuid);
    });

    it('should filter out soft-deleted stocks', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SoftDeleteStock' });

      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL008',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product5' });

      // Create two stocks
      const stock1 = await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 10, buyingPricePaise: 5000, sellingPricePaise: 8000, floorPricePaise: 7000, channel: 'RETAIL' },
      });

      const stock2 = await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 5, buyingPricePaise: 8000, sellingPricePaise: 10000, floorPricePaise: 9000, channel: 'RETAIL' },
      });

      // Soft delete stock1
      await stock1.destroy();

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      // Only stock2 should appear (stock1 is soft-deleted)
      expect(res.body.data.trips[0].stocks).toHaveLength(1);
      expect(res.body.data.trips[0].stocks[0].uuid).toBe(stock2.uuid);
      // Variance should be recalculated: 100000 - (5 * 8000) = 60000
      expect(res.body.data.trips[0].variancePaise).toBe('60000');
    });

    it('should filter out soft-deleted units', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SoftDeleteUnit' });

      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL009',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product6' });

      const stock = await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 10, buyingPricePaise: 5000, sellingPricePaise: 8000, floorPricePaise: 7000, channel: 'RETAIL' },
      });

      const colour = await db.Colour.create({ name: 'TEST_Blue' });
      const size = await db.Size.create({ name: 'TEST_L' });

      // Create two units
      const unit1 = await db.Unit.create({
        stockId: stock.id,
        barcode: '111111111111',
        colourId: colour.id,
        sizeId: size.id,
        status: 'in_stock',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      const unit2 = await db.Unit.create({
        stockId: stock.id,
        barcode: '222222222222',
        colourId: colour.id,
        sizeId: size.id,
        status: 'in_stock',
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
      expect(res.body.data.trips[0].stocks[0].units).toHaveLength(1);
      expect(res.body.data.trips[0].stocks[0].units[0].uuid).toBe(unit2.uuid);
    });

    it('should return all money fields as strings for precision', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_MoneyStrings' });

      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL010',
        totalPaidPaise: 12345678,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product7' });

      const stock = await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: {
          quantity: 10,
          buyingPricePaise: 9876543,
          sellingPricePaise: 11111111,
          floorPricePaise: 10000000,
          channel: 'RETAIL',
          rentPerDayPaise: 1000,
          depositPaise: 50000,
          overduePerDayPaise: 200,
        },
      });

      const colour = await db.Colour.create({ name: 'TEST_Green' });
      const size = await db.Size.create({ name: 'TEST_XL' });

      const unit = await db.Unit.create({
        stockId: stock.id,
        barcode: '333333333333',
        colourId: colour.id,
        sizeId: size.id,
        status: 'in_stock',
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

      const stockData = tripData.stocks[0];
      expect(typeof stockData.buyingPricePaise).toBe('string');
      expect(stockData.buyingPricePaise).toBe('9876543');
      expect(typeof stockData.sellingPricePaise).toBe('string');
      expect(stockData.sellingPricePaise).toBe('11111111');
      expect(typeof stockData.floorPricePaise).toBe('string');
      expect(stockData.floorPricePaise).toBe('10000000');
      expect(typeof stockData.rentPerDayPaise).toBe('string');
      expect(stockData.rentPerDayPaise).toBe('1000');
      expect(typeof stockData.depositPaise).toBe('string');
      expect(stockData.depositPaise).toBe('50000');
      expect(typeof stockData.overduePerDayPaise).toBe('string');
      expect(stockData.overduePerDayPaise).toBe('200');

      const unitData = stockData.units[0];
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

      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL011',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product8' });

      // Create stock without rental fields
      const stock = await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: {
          quantity: 10,
          buyingPricePaise: 5000,
          sellingPricePaise: 8000,
          floorPricePaise: 7000,
          channel: 'RETAIL',
          rentPerDayPaise: null,
          depositPaise: null,
          overduePerDayPaise: null,
        },
      });

      const colour = await db.Colour.create({ name: 'TEST_Yellow' });
      const size = await db.Size.create({ name: 'TEST_S' });

      const unit = await db.Unit.create({
        stockId: stock.id,
        barcode: '444444444444',
        colourId: colour.id,
        sizeId: size.id,
        status: 'in_stock',
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
      const stockData = res.body.data.trips[0].stocks[0];
      expect(stockData.rentPerDayPaise).toBeNull();
      expect(stockData.depositPaise).toBeNull();
      expect(stockData.overduePerDayPaise).toBeNull();

      const unitData = stockData.units[0];
      expect(unitData.rentPerDayPaise).toBeNull();
      expect(unitData.depositPaise).toBeNull();
      expect(unitData.overduePerDayPaise).toBeNull();
    });

    it('should preserve unit prices unchanged from stock edit (AD-24)', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_PriceDifference' });

      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL012',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product9' });

      // Create stock with original prices
      const stock = await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 10, buyingPricePaise: 5000, sellingPricePaise: 8000, floorPricePaise: 7000, channel: 'RETAIL' },
      });

      const colour = await db.Colour.create({ name: 'TEST_Purple' });
      const size = await db.Size.create({ name: 'TEST_XXL' });

      // Unit created with original prices
      const unit = await db.Unit.create({
        stockId: stock.id,
        barcode: '555555555555',
        colourId: colour.id,
        sizeId: size.id,
        status: 'in_stock',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      // Edit the stock to change prices (Story 3.2)
      await stock.update({
        buyingPricePaise: 6000,
        sellingPricePaise: 9000,
        floorPricePaise: 8000,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const stockData = res.body.data.trips[0].stocks[0];
      const unitData = stockData.units[0];

      // Unit prices should remain at original intake values
      expect(unitData.buyingPricePaise).toBe('5000');
      expect(unitData.sellingPricePaise).toBe('8000');
      expect(unitData.floorPricePaise).toBe('7000');

      // Stock prices should be updated
      expect(stockData.buyingPricePaise).toBe('6000');
      expect(stockData.sellingPricePaise).toBe('9000');
      expect(stockData.floorPricePaise).toBe('8000');

      // Verify they differ (AD-24 assertion)
      expect(unitData.buyingPricePaise).not.toBe(stockData.buyingPricePaise);
    });

    it('should return trips sorted by purchasedOn DESC (most recent first)', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SortTrips' });

      // Create trip bills in non-sorted order
      const { trip: trip1 } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-19',
        billReference: 'BILL013',
        totalPaidPaise: 50000,
      });

      const { trip: trip2 } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-21',
        billReference: 'BILL014',
        totalPaidPaise: 75000,
      });

      const { trip: trip3 } = await createTripWithVendor({
        vendor,
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

    it('should return stocks sorted by createdAt ASC (creation order)', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SortStocks' });

      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL016',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product10' });

      // Create stocks and capture their creation times
      const stock1 = await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 10, buyingPricePaise: 5000, sellingPricePaise: 8000, floorPricePaise: 7000, channel: 'RETAIL' },
      });

      // Add a slight delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const stock2 = await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 5, buyingPricePaise: 8000, sellingPricePaise: 10000, floorPricePaise: 9000, channel: 'RETAIL' },
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const stockDatas = res.body.data.trips[0].stocks;
      expect(stockDatas).toHaveLength(2);

      // Should be sorted by createdAt ASC: stock1 first, then stock2
      expect(stockDatas[0].uuid).toBe(stock1.uuid);
      expect(stockDatas[1].uuid).toBe(stock2.uuid);
    });

    it('should return units sorted by createdAt ASC (scan order)', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_SortUnits' });

      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL017',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product11' });

      const stock = await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 10, buyingPricePaise: 5000, sellingPricePaise: 8000, floorPricePaise: 7000, channel: 'RETAIL' },
      });

      const colour = await db.Colour.create({ name: 'TEST_Orange' });
      const size = await db.Size.create({ name: 'TEST_2XL' });

      // Create units and capture their creation times
      const unit1 = await db.Unit.create({
        stockId: stock.id,
        barcode: '666666666666',
        colourId: colour.id,
        sizeId: size.id,
        status: 'in_stock',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      // Add a slight delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const unit2 = await db.Unit.create({
        stockId: stock.id,
        barcode: '777777777777',
        colourId: colour.id,
        sizeId: size.id,
        status: 'in_stock',
        channel: 'RETAIL',
        buyingPricePaise: 5000,
        sellingPricePaise: 8000,
        floorPricePaise: 7000,
      });

      const res = await request(app)
        .get(`/api/vendors/${vendor.uuid}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const unitDatas = res.body.data.trips[0].stocks[0].units;
      expect(unitDatas).toHaveLength(2);

      // Should be sorted by createdAt ASC: unit1 first, then unit2
      expect(unitDatas[0].uuid).toBe(unit1.uuid);
      expect(unitDatas[1].uuid).toBe(unit2.uuid);
    });

    it('should not expose internal id fields', async () => {
      const vendor = await db.Vendor.create({ name: 'TEST_NoInternalId' });

      const { trip, tripVendor } = await createTripWithVendor({
        vendor,
        purchasedOn: '2026-08-20',
        billReference: 'BILL018',
        totalPaidPaise: 100000,
      });

      const productType = await db.ProductType.create({ name: 'TEST_Product12' });

      const stock = await createTestStock({
        trip, tripVendor, vendor, productType,
        overrides: { quantity: 10, buyingPricePaise: 5000, sellingPricePaise: 8000, floorPricePaise: 7000, channel: 'RETAIL' },
      });

      const colour = await db.Colour.create({ name: 'TEST_Pink' });
      const size = await db.Size.create({ name: 'TEST_3XL' });

      const unit = await db.Unit.create({
        stockId: stock.id,
        barcode: '888888888888',
        colourId: colour.id,
        sizeId: size.id,
        status: 'in_stock',
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

      const stockData = tripData.stocks[0];
      expect(stockData).not.toHaveProperty('id');
      expect(stockData).toHaveProperty('uuid');
      expect(stockData).not.toHaveProperty('productTypeId');
      expect(stockData).toHaveProperty('productTypeUuid');

      const unitData = stockData.units[0];
      expect(unitData).not.toHaveProperty('id');
      expect(unitData).toHaveProperty('uuid');
      expect(unitData).not.toHaveProperty('colourId');
      expect(unitData).toHaveProperty('colour');
      expect(unitData).not.toHaveProperty('sizeId');
      expect(unitData).toHaveProperty('size');
    });
  });
});
