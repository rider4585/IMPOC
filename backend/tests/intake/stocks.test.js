import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, closeDatabase, generateTestUser, todayStr, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';

describe('Stocks Module - /api/trips/:tripUuid/stocks', () => {
    let testDb;
    let adminToken;
    let inventoryToken;
    let adminUser;
    let inventoryUser;
    let activeVendor;
    let inactiveVendor;
    let unlinkedVendor;
    let activeProductType;
    let inactiveProductType;
    let testTrip;
    let testTripVendor;

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

        const adminLoginRes = await request(app)
            .post('/api/auth/login')
            .send({
                username: adminData.username,
                password: adminData.password,
            });
        adminToken = adminLoginRes.body.data.accessToken;

        // Create inventory manager user
        const inventoryData = generateTestUser({ password: 'Inventory123!' });
        inventoryUser = await db.User.create({
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

        // Create test vendors
        activeVendor = await db.Vendor.create({ name: 'TEST_StockActiveVendor', isActive: true });
        inactiveVendor = await db.Vendor.create({ name: 'TEST_StockInactiveVendor', isActive: false });
        unlinkedVendor = await db.Vendor.create({ name: 'TEST_StockUnlinkedVendor', isActive: true });

        // Create test product types
        activeProductType = await db.ProductType.create({
            name: 'TEST_StockActiveProductType',
            isActive: true,
        });
        inactiveProductType = await db.ProductType.create({
            name: 'TEST_StockInactiveProductType',
            isActive: false,
        });

        // Create a test trip (with activeVendor as a member)
        const pair = await createTripWithVendor({
            vendor: activeVendor,
            name: 'TEST_StockTrip',
            purchasedOn: '2026-08-26',
            billReference: 'TEST_TRIP_001',
            totalPaidPaise: 100000,
        });
        testTrip = pair.trip;
        testTripVendor = pair.tripVendor;
    });

    afterEach(async () => {
        // Clean up test stocks created by the suite
        await db.Stock.destroy({
            where: {
                productTypeId: {
                    [db.Sequelize.Op.in]: [activeProductType.id, inactiveProductType.id],
                },
            },
            force: true,
        });
    });

    afterAll(async () => {
        await db.Stock.destroy({ where: { tripId: testTrip.id }, force: true });
        await db.TripVendor.destroy({ where: { tripId: testTrip.id }, force: true });
        await db.Trip.destroy({ where: { id: testTrip.id }, force: true });
        await db.Vendor.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_Stock%' } }, force: true });
        await db.ProductType.destroy({
            where: { name: { [db.Sequelize.Op.like]: 'TEST_Stock%' } },
            force: true,
        });
        await closeDatabase();
    });

    async function makeStock(overrides = {}) {
        return createTestStock({
            trip: testTrip,
            tripVendor: testTripVendor,
            vendor: activeVendor,
            productType: activeProductType,
            overrides,
        });
    }

    describe('POST /trips/:tripUuid/stocks', () => {
        it('should create RETAIL stock with all fields', async () => {
            const res = await request(app)
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 10,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('uuid');
            expect(res.body.data.tripUuid).toBe(testTrip.uuid);
            expect(res.body.data.vendorUuid).toBe(activeVendor.uuid);
            expect(res.body.data.productTypeUuid).toBe(activeProductType.uuid);
            expect(res.body.data.quantity).toBe(10);
            expect(res.body.data.buyingPricePaise).toBe('1000');
            expect(res.body.data.sellingPricePaise).toBe('2000');
            expect(res.body.data.floorPricePaise).toBe('1500');
            expect(res.body.data.channel).toBe('RETAIL');
            expect(res.body.data.rentPerDayPaise).toBeNull();
            expect(res.body.data.depositPaise).toBeNull();
            expect(res.body.data.overduePerDayPaise).toBeNull();
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
            expect(res.body.data).not.toHaveProperty('id');
        });

        it('should create RENTAL stock with all rental terms', async () => {
            const res = await request(app)
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 5,
                    buyingPricePaise: 5000,
                    sellingPricePaise: 10000,
                    floorPricePaise: 8000,
                    channel: 'RENTAL',
                    rentPerDayPaise: 500,
                    depositPaise: 3000,
                    overduePerDayPaise: 1000,
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.channel).toBe('RENTAL');
            expect(res.body.data.rentPerDayPaise).toBe('500');
            expect(res.body.data.depositPaise).toBe('3000');
            expect(res.body.data.overduePerDayPaise).toBe('1000');
        });

        it('should reject stock with floor price > selling price', async () => {
            const res = await request(app)
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 10,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 2500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Floor price cannot exceed selling price');
        });

        it('should reject RENTAL stock with overdue <= rent per day', async () => {
            const res = await request(app)
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 5,
                    buyingPricePaise: 5000,
                    sellingPricePaise: 10000,
                    floorPricePaise: 8000,
                    channel: 'RENTAL',
                    rentPerDayPaise: 500,
                    depositPaise: 3000,
                    overduePerDayPaise: 500,
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Overdue per day must be greater than rent per day');
        });

        it('should reject RETAIL channel with rental fields', async () => {
            const res = await request(app)
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 10,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                    rentPerDayPaise: 500,
                });

            expect(res.statusCode).toBe(400);
        });

        it('should reject stock with zero quantity', async () => {
            const res = await request(app)
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 0,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(400);
        });

        it('should reject stock with nonexistent trip', async () => {
            const res = await request(app)
                .post('/api/trips/00000000-0000-0000-0000-000000000000/stocks')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: '00000000-0000-0000-0000-000000000000',
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 10,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toContain('Trip not found');
        });

        it('should reject stock with nonexistent product type', async () => {
            const res = await request(app)
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: '00000000-0000-0000-0000-000000000000',
                    quantity: 10,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toContain('Product type not found');
        });

        it('should reject stock with inactive product type', async () => {
            const res = await request(app)
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: inactiveProductType.uuid,
                    quantity: 10,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Product type is inactive');
        });

        it('should reject stock for vendor not part of the trip', async () => {
            const res = await request(app)
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: unlinkedVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 10,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Vendor is not part of this trip');
        });

        it('should reject stock with inactive vendor', async () => {
            // Create a trip that includes the inactive vendor (history must survive deactivation)
            const pair = await createTripWithVendor({
                vendor: inactiveVendor,
                name: 'TEST_StockTripInactive',
                totalPaidPaise: 50000,
            });

            try {
                const res = await request(app)
                    .post(`/api/trips/${pair.trip.uuid}/stocks`)
                    .set('Authorization', `Bearer ${inventoryToken}`)
                    .send({
                        tripUuid: pair.trip.uuid,
                        vendorUuid: inactiveVendor.uuid,
                        productTypeUuid: activeProductType.uuid,
                        quantity: 10,
                        buyingPricePaise: 1000,
                        sellingPricePaise: 2000,
                        floorPricePaise: 1500,
                        channel: 'RETAIL',
                    });

                expect(res.statusCode).toBe(400);
                expect(res.body.message).toContain('Vendor is inactive');
            } finally {
                await db.Stock.destroy({ where: { tripId: pair.trip.id }, force: true });
                await db.TripVendor.destroy({ where: { tripId: pair.trip.id }, force: true });
                await db.Trip.destroy({ where: { id: pair.trip.id }, force: true });
            }
        });

        it('should return 401 without authentication', async () => {
            const res = await request(app)
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 10,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
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
                .post(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 10,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /trips/:tripUuid/stocks', () => {
        it('should list all stocks for a trip', async () => {
            // Create two test stocks
            await makeStock({
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });
            await makeStock({
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
                .get(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(2);
            expect(res.body.data[0]).toHaveProperty('uuid');
            expect(res.body.data[0]).toHaveProperty('tripUuid');
            expect(res.body.data[0]).toHaveProperty('tripVendorUuid');
            expect(res.body.data[0]).not.toHaveProperty('id');
        });

        it('should order stocks by createdAt ASC', async () => {
            const stock1 = await makeStock({
                quantity: 1,
                buyingPricePaise: 100,
                sellingPricePaise: 200,
                floorPricePaise: 150,
                channel: 'RETAIL',
            });
            const stock2 = await makeStock({
                quantity: 2,
                buyingPricePaise: 200,
                sellingPricePaise: 300,
                floorPricePaise: 250,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .get(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            const uuids = res.body.data.map((s) => s.uuid);
            const stock1Index = uuids.indexOf(stock1.uuid);
            const stock2Index = uuids.indexOf(stock2.uuid);

            if (stock1Index !== -1 && stock2Index !== -1) {
                expect(stock1Index < stock2Index).toBe(true);
            }
        });

        it('should return 401 without authentication', async () => {
            const res = await request(app).get(`/api/trips/${testTrip.uuid}/stocks`);
            expect(res.statusCode).toBe(401);
        });

        it('should return 404 for nonexistent trip', async () => {
            const res = await request(app)
                .get('/api/trips/00000000-0000-0000-0000-000000000000/stocks')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(404);
        });
    });

    describe('GET /trips/:tripUuid/stocks/:uuid', () => {
        it('should get stock by UUID', async () => {
            const stock = await makeStock({
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .get(`/api/trips/${testTrip.uuid}/stocks/${stock.uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.uuid).toBe(stock.uuid);
            expect(res.body.data.tripUuid).toBe(testTrip.uuid);
            expect(res.body.data.tripVendorUuid).toBe(testTripVendor.uuid);
            expect(res.body.data.vendorUuid).toBe(activeVendor.uuid);
            expect(res.body.data.quantity).toBe(10);
            expect(res.body.data.unitsScannedCount).toBe(0);
            expect(res.body.data).not.toHaveProperty('id');
        });

        it('should return 404 for nonexistent stock', async () => {
            const res = await request(app)
                .get(`/api/trips/${testTrip.uuid}/stocks/00000000-0000-0000-0000-000000000000`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toContain('Stock not found');
        });

        it('should return 401 without authentication', async () => {
            const stock = await makeStock({
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app).get(
                `/api/trips/${testTrip.uuid}/stocks/${stock.uuid}`
            );

            expect(res.statusCode).toBe(401);
        });
    });

    describe('PATCH /trips/:tripUuid/stocks/:uuid', () => {
        it('should update stock quantity', async () => {
            const stock = await makeStock({
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .patch(`/api/trips/${testTrip.uuid}/stocks/${stock.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ quantity: 20 });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.quantity).toBe(20);
        });

        it('should update stock prices', async () => {
            const stock = await makeStock({
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .patch(`/api/trips/${testTrip.uuid}/stocks/${stock.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ sellingPricePaise: 2500 });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.sellingPricePaise).toBe('2500');
        });

        it('should reject price update with floor > selling', async () => {
            const stock = await makeStock({
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .patch(`/api/trips/${testTrip.uuid}/stocks/${stock.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ sellingPricePaise: 1400 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Floor price cannot exceed selling price');
        });

        it('should return 401 without authentication', async () => {
            const stock = await makeStock({
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .patch(`/api/trips/${testTrip.uuid}/stocks/${stock.uuid}`)
                .send({ quantity: 20 });

            expect(res.statusCode).toBe(401);
        });

        it('should return 403 without inventory.update permission', async () => {
            const stock = await makeStock({
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

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
                .patch(`/api/trips/${testTrip.uuid}/stocks/${stock.uuid}`)
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({ quantity: 20 });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('Soft delete behavior', () => {
        it('should not expose soft-deleted stocks', async () => {
            const stock = await makeStock({
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            // Soft delete the stock
            await stock.destroy();

            const res = await request(app)
                .get(`/api/trips/${testTrip.uuid}/stocks`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            const uuids = res.body.data.map((s) => s.uuid);
            expect(uuids).not.toContain(stock.uuid);
        });

        it('should return 404 when trying to get soft-deleted stock', async () => {
            const stock = await makeStock({
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            // Soft delete the stock
            await stock.destroy();

            const res = await request(app)
                .get(`/api/trips/${testTrip.uuid}/stocks/${stock.uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(404);
        });
    });
});