import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, closeDatabase, generateTestUser, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Trips Module - /api/trips', () => {
  let testDb;
  let adminToken;
  let inventoryToken;
  let adminUser;
  let inventoryUser;
  let activeVendor;
  let inactiveVendor;

  // Every trip created through the API or directly in the DB, cleaned per test
  const createdTrips = [];

  async function cleanupCreatedTrips() {
    for (const t of createdTrips) {
      await db.Stock.destroy({ where: { tripId: t.id }, force: true });
      await db.TripVendor.destroy({ where: { tripId: t.id }, force: true });
    }
    if (createdTrips.length > 0) {
      await db.Trip.destroy({ where: { id: createdTrips.map((t) => t.id) }, force: true });
    }
    createdTrips.length = 0;
  }

  async function trackTripByUuid(uuid) {
    const trip = await db.Trip.findOne({ where: { uuid } });
    if (trip) createdTrips.push(trip);
    return trip;
  }

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
    await cleanupCreatedTrips();
  });

  afterAll(async () => {
    await db.Vendor.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_%' } }, force: true });
    await closeDatabase();
  });

  describe('GET /trips', () => {
    it('should list all trips with authentication', async () => {
      const trip = await db.Trip.create({ name: 'TEST_ListTrip', purchasedOn: '2026-08-26' });
      createdTrips.push(trip);

      const res = await request(app)
        .get('/api/trips')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/trips');

      expect(res.statusCode).toBe(401);
    });

    it('should not expose internal id field', async () => {
      const trip = await db.Trip.create({ name: 'TEST_ListTrip2', purchasedOn: '2026-08-26' });
      createdTrips.push(trip);

      const res = await request(app)
        .get('/api/trips')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Verify no id field is exposed
      res.body.data.forEach(tripItem => {
        expect(tripItem).not.toHaveProperty('id');
        expect(tripItem).toHaveProperty('uuid');
        expect(tripItem).toHaveProperty('name');
        expect(tripItem).toHaveProperty('purchasedOn');
        expect(tripItem).toHaveProperty('totalPaidPaise');
        expect(tripItem).toHaveProperty('variancePaise');
        expect(tripItem).toHaveProperty('vendorSummary');
      });
    });

    it('should compute variancePaise as sum of bills when no stocks exist', async () => {
      const trip = await db.Trip.create({ name: 'TEST_VarianceTrip', purchasedOn: '2026-08-26' });
      createdTrips.push(trip);
      await db.TripVendor.create({
        tripId: trip.id,
        vendorId: activeVendor.id,
        totalPaidPaise: 75000,
      });

      const res = await request(app)
        .get('/api/trips')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const foundTrip = res.body.data.find((t) => t.uuid === trip.uuid);
      expect(foundTrip).toBeDefined();
      expect(foundTrip.variancePaise).toBe("75000");
    });
  });

  describe('POST /trips', () => {
    async function postTrip(payload, token = inventoryToken) {
      const res = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      if (res.statusCode === 201) {
        await trackTripByUuid(res.body.data.uuid);
      }
      return res;
    }

    it('should create trip with all fields using inventory.create permission', async () => {
      const res = await postTrip({
        name: 'TEST_Trip August',
        purchasedOn: '2026-08-26',
        notes: 'weekly wholesale',
        vendors: [
          {
            vendorUuid: activeVendor.uuid,
            billReference: 'TEST_INV-004',
            totalPaidPaise: 50000,
          },
        ],
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.name).toBe('TEST_Trip August');
      expect(res.body.data.purchasedOn).toBe('2026-08-26');
      expect(res.body.data.notes).toBe('weekly wholesale');
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.vendors).toHaveLength(1);
      expect(res.body.data.vendors[0].vendorUuid).toBe(activeVendor.uuid);
      expect(res.body.data.vendors[0].billReference).toBe('TEST_INV-004');
      expect(res.body.data.vendors[0].totalPaidPaise).toBe("50000");
      expect(res.body.data.totalPaidPaise).toBe("50000");
      expect(res.body.data.variancePaise).toBe("50000"); // No stocks yet
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should create trip with multiple vendor bills', async () => {
      const vendor2 = await db.Vendor.create({ name: 'TEST_SecondVendor', isActive: true });
      const res = await postTrip({
        name: 'TEST_Trip Multi',
        purchasedOn: '2026-08-26',
        vendors: [
          { vendorUuid: activeVendor.uuid, totalPaidPaise: 20000 },
          { vendorUuid: vendor2.uuid, totalPaidPaise: 30000 },
        ],
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.vendors).toHaveLength(2);
      expect(res.body.data.totalPaidPaise).toBe("50000");
      expect(res.body.data.variancePaise).toBe("50000");
    });

    it('should create trip without vendors', async () => {
      const res = await postTrip({
        name: 'TEST_Trip NoVendors',
        purchasedOn: '2026-08-26',
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.vendors).toHaveLength(0);
      expect(res.body.data.totalPaidPaise).toBe("0");
      expect(res.body.data.variancePaise).toBe("0");
    });

    it('should return 404 when vendor does not exist', async () => {
      const res = await postTrip({
        name: 'TEST_Trip BadVendor',
        purchasedOn: '2026-08-26',
        vendors: [
          {
            vendorUuid: '00000000-0000-0000-0000-000000000000',
            totalPaidPaise: 50000,
          },
        ],
      });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Vendor not found');
    });

    it('should return 400 when vendor is inactive', async () => {
      const res = await postTrip({
        name: 'TEST_Trip InactiveVendor',
        purchasedOn: '2026-08-26',
        vendors: [
          {
            vendorUuid: inactiveVendor.uuid,
            totalPaidPaise: 50000,
          },
        ],
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Vendor is inactive');
    });

    it('should return 409 when the same vendor is added twice to a trip', async () => {
      const res = await postTrip({
        name: 'TEST_Trip DupVendor',
        purchasedOn: '2026-08-26',
        vendors: [
          { vendorUuid: activeVendor.uuid, totalPaidPaise: 20000 },
          { vendorUuid: activeVendor.uuid, totalPaidPaise: 30000 },
        ],
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toContain('Vendor already added to this trip');
    });

    it('should return 400 when purchasedOn is missing', async () => {
      const res = await postTrip({
        name: 'TEST_Trip MissingDate',
        vendors: [{ vendorUuid: activeVendor.uuid, totalPaidPaise: 50000 }],
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when name is missing', async () => {
      const res = await postTrip({
        purchasedOn: '2026-08-26',
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when totalPaidPaise is negative', async () => {
      const res = await postTrip({
        name: 'TEST_Trip Negative',
        purchasedOn: '2026-08-26',
        vendors: [{ vendorUuid: activeVendor.uuid, totalPaidPaise: -1000 }],
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/trips')
        .send({
          name: 'TEST_Trip NoAuth',
          purchasedOn: '2026-08-26',
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
        .post('/api/trips')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          name: 'TEST_Trip Cashier',
          purchasedOn: '2026-08-26',
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /trips/:uuid/vendors', () => {
    it('should add a vendor bill to an existing trip', async () => {
      const trip = await db.Trip.create({ name: 'TEST_Trip AddVendor', purchasedOn: '2026-08-26' });
      createdTrips.push(trip);

      const res = await request(app)
        .post(`/api/trips/${trip.uuid}/vendors`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: activeVendor.uuid,
          billReference: 'TEST_INV-ADD',
          totalPaidPaise: 60000,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tripUuid).toBe(trip.uuid);
      expect(res.body.data.vendorUuid).toBe(activeVendor.uuid);
      expect(res.body.data.billReference).toBe('TEST_INV-ADD');
      expect(res.body.data.totalPaidPaise).toBe("60000");
    });

    it('should return 409 when vendor already on the trip', async () => {
      const { trip, tripVendor } = await createTripWithVendor({
        vendor: activeVendor,
        name: 'TEST_Trip DupVendorBill',
        billReference: 'TEST_INV-DUP',
        totalPaidPaise: 50000,
      });
      createdTrips.push(trip);

      const res = await request(app)
        .post(`/api/trips/${trip.uuid}/vendors`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: activeVendor.uuid,
          totalPaidPaise: 60000,
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toContain('Vendor already added to this trip');
    });
  });

  describe('Receipt image (R-14)', () => {
    const receiptDataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAPh9kHmVvL2GhGYxYWpLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS3//2Q==';

    it('should persist and return receiptImage on createTrip vendor bills', async () => {
      const res = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_Trip ReceiptImage',
          purchasedOn: '2026-08-26',
          vendors: [
            {
              vendorUuid: activeVendor.uuid,
              billReference: 'TEST_INV-RECEIPT',
              totalPaidPaise: 45000,
              receiptImage: receiptDataUri,
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      const trip = await trackTripByUuid(res.body.data.uuid);
      expect(res.body.data.vendors).toHaveLength(1);
      expect(res.body.data.vendors[0].receiptImage).toBe(receiptDataUri);

      const stored = await db.TripVendor.findOne({
        where: { tripId: trip.id },
      });
      expect(stored.receiptImage).toBe(receiptDataUri);
    });

    it('should persist and return receiptImage on addTripVendor', async () => {
      const trip = await db.Trip.create({ name: 'TEST_Trip ReceiptImage Add', purchasedOn: '2026-08-26' });
      createdTrips.push(trip);

      const res = await request(app)
        .post(`/api/trips/${trip.uuid}/vendors`)
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          vendorUuid: activeVendor.uuid,
          totalPaidPaise: 60000,
          receiptImage: receiptDataUri,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.receiptImage).toBe(receiptDataUri);
    });

    it('should return 400 when receiptImage exceeds the size limit', async () => {
      const res = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({
          name: 'TEST_Trip ReceiptImage Oversize',
          purchasedOn: '2026-08-26',
          vendors: [
            {
              vendorUuid: activeVendor.uuid,
              totalPaidPaise: 1000,
              receiptImage: 'data:image/png;base64,' + 'a'.repeat(10000001),
            },
          ],
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return receiptImage in getTrip vendors', async () => {
      const trip = await db.Trip.create({ name: 'TEST_Trip ReceiptImage Get', purchasedOn: '2026-08-26' });
      createdTrips.push(trip);
      await db.TripVendor.create({
        tripId: trip.id,
        vendorId: activeVendor.id,
        totalPaidPaise: 50000,
        receiptImage: receiptDataUri,
      });

      const res = await request(app)
        .get(`/api/trips/${trip.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.vendors).toHaveLength(1);
      expect(res.body.data.vendors[0].receiptImage).toBe(receiptDataUri);
    });
  });

  describe('GET /trips/:uuid', () => {
    it('should get trip by uuid with authentication', async () => {
      const { trip, tripVendor } = await createTripWithVendor({
        vendor: activeVendor,
        name: 'TEST_Trip Detail',
        purchasedOn: '2026-08-26',
        billReference: 'TEST_INV-012',
        totalPaidPaise: 85000,
      });
      createdTrips.push(trip);

      const res = await request(app)
        .get(`/api/trips/${trip.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uuid).toBe(trip.uuid);
      expect(res.body.data.name).toBe('TEST_Trip Detail');
      expect(res.body.data.purchasedOn).toBe('2026-08-26');
      expect(res.body.data.totalPaidPaise).toBe("85000");
      expect(res.body.data.variancePaise).toBe("85000"); // No stocks yet
      expect(res.body.data.vendors).toHaveLength(1);
      expect(res.body.data.vendors[0].vendorUuid).toBe(activeVendor.uuid);
      expect(res.body.data.stocks).toHaveLength(0);
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 404 for non-existent trip', async () => {
      const res = await request(app)
        .get('/api/trips/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Trip not found');
    });

    it('should return 401 without authentication', async () => {
      const { trip } = await createTripWithVendor({
        vendor: activeVendor,
        name: 'TEST_Trip NoAuth Detail',
        totalPaidPaise: 50000,
      });
      createdTrips.push(trip);

      const res = await request(app)
        .get(`/api/trips/${trip.uuid}`);

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/trips/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Trip ordering', () => {
    it('should return trips ordered by purchasedOn DESC', async () => {
      const trip1 = await db.Trip.create({ name: 'TEST_DATE-001', purchasedOn: '2026-08-24' });
      const trip2 = await db.Trip.create({ name: 'TEST_DATE-002', purchasedOn: '2026-08-26' });
      const trip3 = await db.Trip.create({ name: 'TEST_DATE-003', purchasedOn: '2026-08-25' });
      createdTrips.push(trip1, trip2, trip3);

      const res = await request(app)
        .get('/api/trips')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      // Find our test trips in the response
      const uuids = res.body.data.map((t) => t.uuid);
      const trip2Index = uuids.indexOf(trip2.uuid);
      const trip3Index = uuids.indexOf(trip3.uuid);
      const trip1Index = uuids.indexOf(trip1.uuid);

      // Should be ordered: 2026-08-26, 2026-08-25, 2026-08-24
      if (trip2Index !== -1 && trip3Index !== -1 && trip1Index !== -1) {
        expect(trip2Index < trip3Index).toBe(true);
        expect(trip3Index < trip1Index).toBe(true);
      }
    });
  });

  describe('Soft delete behavior', () => {
    it('should not expose soft-deleted trips', async () => {
      const trip = await db.Trip.create({ name: 'TEST_SOFT-DELETE', purchasedOn: '2026-08-26' });
      createdTrips.push(trip);

      // Soft delete the trip
      await trip.destroy();

      const res = await request(app)
        .get('/api/trips')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      const uuids = res.body.data.map((t) => t.uuid);
      expect(uuids).not.toContain(trip.uuid);
    });

    it('should return 404 when trying to get soft-deleted trip', async () => {
      const trip = await db.Trip.create({ name: 'TEST_SOFT-DELETE-2', purchasedOn: '2026-08-26' });
      createdTrips.push(trip);

      // Soft delete the trip
      await trip.destroy();

      const res = await request(app)
        .get(`/api/trips/${trip.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /trips/:tripUuid/clone-last-stock', () => {
    let testProductType;
    let testTrip;
    let testTripVendor;

    beforeEach(async () => {
      // Create test product type
      testProductType = await db.ProductType.create({
        name: 'TEST_CloneProductType',
        isActive: true,
      });

      // Create a test trip with vendor
      const created = await createTripWithVendor({
        vendor: activeVendor,
        name: 'TEST_CLONE_TRIP',
        purchasedOn: '2026-08-26',
        totalPaidPaise: 100000,
      });
      testTrip = created.trip;
      testTripVendor = created.tripVendor;
      createdTrips.push(testTrip);
    });

    afterEach(async () => {
      // Clean up test data
      await db.Stock.destroy({
        where: { productTypeId: testProductType.id },
        force: true,
      });
      await db.ProductType.destroy({
        where: { name: 'TEST_CloneProductType' },
        force: true,
      });
      await cleanupCreatedTrips();
    });

    it('should return 200 with last stock data for happy path', async () => {
      // Create a RETAIL stock
      const stock = await createTestStock({
        trip: testTrip,
        tripVendor: testTripVendor,
        vendor: activeVendor,
        productType: testProductType,
        overrides: {
          quantity: 10,
          buyingPricePaise: 1000,
          sellingPricePaise: 2000,
          floorPricePaise: 1500,
          channel: 'RETAIL',
        },
      });

      const res = await request(app)
        .get(`/api/trips/${testTrip.uuid}/clone-last-stock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('productTypeUuid', testProductType.uuid);
      expect(res.body.data).toHaveProperty('vendorUuid', activeVendor.uuid);
      expect(res.body.data).toHaveProperty('tripVendorUuid', testTripVendor.uuid);
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
      expect(res.body.data).not.toHaveProperty('uuid'); // Should not expose stock uuid
    });

    it('should return 200 with RENTAL stock including rental terms', async () => {
      // Create a RENTAL stock
      const stock = await createTestStock({
        trip: testTrip,
        tripVendor: testTripVendor,
        vendor: activeVendor,
        productType: testProductType,
        overrides: {
          quantity: 5,
          buyingPricePaise: 5000,
          sellingPricePaise: 10000,
          floorPricePaise: 8000,
          channel: 'RENTAL',
          rentPerDayPaise: 500,
          depositPaise: 3000,
          overduePerDayPaise: 1000,
        },
      });

      const res = await request(app)
        .get(`/api/trips/${testTrip.uuid}/clone-last-stock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('channel', 'RENTAL');
      expect(res.body.data).toHaveProperty('rentPerDayPaise', '500');
      expect(res.body.data).toHaveProperty('depositPaise', '3000');
      expect(res.body.data).toHaveProperty('overduePerDayPaise', '1000');
    });

    it('should return the most recent stock when multiple stocks exist', async () => {
      // Create first stock
      const stock1 = await createTestStock({
        trip: testTrip,
        tripVendor: testTripVendor,
        vendor: activeVendor,
        productType: testProductType,
        overrides: {
          quantity: 5,
          buyingPricePaise: 1000,
          sellingPricePaise: 2000,
          floorPricePaise: 1500,
          channel: 'RETAIL',
        },
      });

      // Wait a tiny bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create second stock
      const stock2 = await createTestStock({
        trip: testTrip,
        tripVendor: testTripVendor,
        vendor: activeVendor,
        productType: testProductType,
        overrides: {
          quantity: 15,
          buyingPricePaise: 2000,
          sellingPricePaise: 3000,
          floorPricePaise: 2500,
          channel: 'RETAIL',
        },
      });

      const res = await request(app)
        .get(`/api/trips/${testTrip.uuid}/clone-last-stock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('quantity', 15);
      expect(res.body.data).toHaveProperty('buyingPricePaise', '2000');
      expect(res.body.data).toHaveProperty('sellingPricePaise', '3000');
    });

    it('should exclude soft-deleted stocks', async () => {
      // Create and delete first stock
      const stock1 = await createTestStock({
        trip: testTrip,
        tripVendor: testTripVendor,
        vendor: activeVendor,
        productType: testProductType,
        overrides: {
          quantity: 5,
          buyingPricePaise: 1000,
          sellingPricePaise: 2000,
          floorPricePaise: 1500,
          channel: 'RETAIL',
        },
      });
      await stock1.destroy();

      // Create second stock
      const stock2 = await createTestStock({
        trip: testTrip,
        tripVendor: testTripVendor,
        vendor: activeVendor,
        productType: testProductType,
        overrides: {
          quantity: 10,
          buyingPricePaise: 1500,
          sellingPricePaise: 2500,
          floorPricePaise: 2000,
          channel: 'RETAIL',
        },
      });

      const res = await request(app)
        .get(`/api/trips/${testTrip.uuid}/clone-last-stock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('quantity', 10);
      expect(res.body.data).toHaveProperty('buyingPricePaise', '1500');
    });

    it('should return 404 when no stocks exist in trip', async () => {
      const res = await request(app)
        .get(`/api/trips/${testTrip.uuid}/clone-last-stock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('No stocks found to clone for this trip');
    });

    it('should return 404 when trip does not exist', async () => {
      const res = await request(app)
        .get('/api/trips/00000000-0000-0000-0000-000000000000/clone-last-stock')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Trip not found');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get(`/api/trips/${testTrip.uuid}/clone-last-stock`);

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/trips/invalid-uuid/clone-last-stock')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });

    it('should preserve price precision as strings', async () => {
      // Create stock with large paise values
      const stock = await createTestStock({
        trip: testTrip,
        tripVendor: testTripVendor,
        vendor: activeVendor,
        productType: testProductType,
        overrides: {
          quantity: 1,
          buyingPricePaise: 123456789012345,
          sellingPricePaise: 234567890123456,
          floorPricePaise: 111111111111111,
          channel: 'RENTAL',
          rentPerDayPaise: 987654321098765,
          depositPaise: 555555555555555,
          overduePerDayPaise: 111111111111112,
        },
      });

      const res = await request(app)
        .get(`/api/trips/${testTrip.uuid}/clone-last-stock`)
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