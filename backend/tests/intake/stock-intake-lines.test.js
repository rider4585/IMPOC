import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';

describe('Stock Intake Lines Module - /api/stock-intakes/:tripUuid/lines', () => {
    let testDb;
    let adminToken;
    let inventoryToken;
    let adminUser;
    let inventoryUser;
    let activeVendor;
    let inactiveVendor;
    let activeProductType;
    let inactiveProductType;
    let testTrip;

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
        activeVendor = await db.Vendor.create({ name: 'TEST_ActiveVendor', isActive: true });
        inactiveVendor = await db.Vendor.create({ name: 'TEST_InactiveVendor', isActive: false });

        // Create test product types
        activeProductType = await db.ProductType.create({
            name: 'TEST_ActiveProductType',
            isActive: true,
        });
        inactiveProductType = await db.ProductType.create({
            name: 'TEST_InactiveProductType',
            isActive: false,
        });

        // Create a test trip
        testTrip = await db.StockIntake.create({
            vendorId: activeVendor.id,
            purchasedOn: '2026-08-26',
            billReference: 'TEST_TRIP_001',
            totalPaidPaise: 100000,
        });
    });

    afterEach(async () => {
        // Clean up test lines
        await db.StockIntakeLine.destroy({
            where: {
                productTypeId: {
                    [db.Sequelize.Op.in]: [activeProductType.id, inactiveProductType.id],
                },
            },
            force: true,
        });
    });

    afterAll(async () => {
        await closeDatabase();
    });

    describe('POST /stock-intakes/:tripUuid/lines', () => {
        it('should create RETAIL lot with all fields', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
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

        it('should create RENTAL lot with all rental terms', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
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

        it('should reject lot with floor price > selling price', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
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

        it('should reject RENTAL lot with overdue <= rent per day', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
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
                .post(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
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

        it('should reject lot with zero quantity', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
                    productTypeUuid: activeProductType.uuid,
                    quantity: 0,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(400);
        });

        it('should reject lot with nonexistent trip', async () => {
            const res = await request(app)
                .post('/api/stock-intakes/00000000-0000-0000-0000-000000000000/lines')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: '00000000-0000-0000-0000-000000000000',
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

        it('should reject lot with nonexistent product type', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
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

        it('should reject lot with inactive product type', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    tripUuid: testTrip.uuid,
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

        it('should return 401 without authentication', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .send({
                    tripUuid: testTrip.uuid,
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
                .post(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({
                    tripUuid: testTrip.uuid,
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

    describe('GET /stock-intakes/:tripUuid/lines', () => {
        it('should list all lots for a trip', async () => {
            // Create two test lots
            await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
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
                .get(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(2);
            expect(res.body.data[0]).toHaveProperty('uuid');
            expect(res.body.data[0]).toHaveProperty('tripUuid');
            expect(res.body.data[0]).not.toHaveProperty('id');
        });

        it('should order lots by createdAt ASC', async () => {
            // Create three test lots
            const lot1 = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 1,
                buyingPricePaise: 100,
                sellingPricePaise: 200,
                floorPricePaise: 150,
                channel: 'RETAIL',
            });

            const lot2 = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 2,
                buyingPricePaise: 200,
                sellingPricePaise: 300,
                floorPricePaise: 250,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .get(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            const uuids = res.body.data.map((l) => l.uuid);
            const lot1Index = uuids.indexOf(lot1.uuid);
            const lot2Index = uuids.indexOf(lot2.uuid);

            if (lot1Index !== -1 && lot2Index !== -1) {
                expect(lot1Index < lot2Index).toBe(true);
            }
        });

        it('should return 401 without authentication', async () => {
            const res = await request(app).get(`/api/stock-intakes/${testTrip.uuid}/lines`);

            expect(res.statusCode).toBe(401);
        });

        it('should return 404 for nonexistent trip', async () => {
            const res = await request(app)
                .get('/api/stock-intakes/00000000-0000-0000-0000-000000000000/lines')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(404);
        });
    });

    describe('GET /stock-intakes/:tripUuid/lines/:uuid', () => {
        it('should get lot by UUID', async () => {
            const lot = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .get(`/api/stock-intakes/${testTrip.uuid}/lines/${lot.uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.uuid).toBe(lot.uuid);
            expect(res.body.data.tripUuid).toBe(testTrip.uuid);
            expect(res.body.data.quantity).toBe(10);
            expect(res.body.data).not.toHaveProperty('id');
        });

        it('should return 404 for nonexistent lot', async () => {
            const res = await request(app)
                .get(`/api/stock-intakes/${testTrip.uuid}/lines/00000000-0000-0000-0000-000000000000`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toContain('Lot not found');
        });

        it('should return 401 without authentication', async () => {
            const lot = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app).get(
                `/api/stock-intakes/${testTrip.uuid}/lines/${lot.uuid}`
            );

            expect(res.statusCode).toBe(401);
        });
    });

    describe('PATCH /stock-intakes/:tripUuid/lines/:uuid', () => {
        it('should update lot quantity', async () => {
            const lot = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .patch(`/api/stock-intakes/${testTrip.uuid}/lines/${lot.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ quantity: 20 });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.quantity).toBe(20);
        });

        it('should update lot prices', async () => {
            const lot = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .patch(`/api/stock-intakes/${testTrip.uuid}/lines/${lot.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ sellingPricePaise: 2500 });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.sellingPricePaise).toBe('2500');
        });

        it('should reject price update with floor > selling', async () => {
            const lot = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .patch(`/api/stock-intakes/${testTrip.uuid}/lines/${lot.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ sellingPricePaise: 1400 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Floor price cannot exceed selling price');
        });

        it('should return 401 without authentication', async () => {
            const lot = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            const res = await request(app)
                .patch(`/api/stock-intakes/${testTrip.uuid}/lines/${lot.uuid}`)
                .send({ quantity: 20 });

            expect(res.statusCode).toBe(401);
        });

        it('should return 403 without inventory.update permission', async () => {
            const lot = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
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
                .patch(`/api/stock-intakes/${testTrip.uuid}/lines/${lot.uuid}`)
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({ quantity: 20 });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('Soft delete behavior', () => {
        it('should not expose soft-deleted lines', async () => {
            const lot = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            // Soft delete the lot
            await lot.destroy();

            const res = await request(app)
                .get(`/api/stock-intakes/${testTrip.uuid}/lines`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            const uuids = res.body.data.map((l) => l.uuid);
            expect(uuids).not.toContain(lot.uuid);
        });

        it('should return 404 when trying to get soft-deleted lot', async () => {
            const lot = await db.StockIntakeLine.create({
                stockIntakeId: testTrip.id,
                productTypeId: activeProductType.id,
                quantity: 10,
                buyingPricePaise: 1000,
                sellingPricePaise: 2000,
                floorPricePaise: 1500,
                channel: 'RETAIL',
            });

            // Soft delete the lot
            await lot.destroy();

            const res = await request(app)
                .get(`/api/stock-intakes/${testTrip.uuid}/lines/${lot.uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(404);
        });
    });
});
