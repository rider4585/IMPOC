import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';

describe('Inventory V2 - subtype + whole buying price (R-09)', () => {
    let testDb;
    let testToken;
    let trip;
    let tripVendor;
    let vendor;
    let parentType;
    let childType;
    let colour;
    let size;
    let stock;

    beforeAll(async () => {
        testDb = await initializeTestDatabase();

        const userData = generateTestUser({ password: 'TestPassword123!' });
        const testUser = await db.User.create({
            username: userData.username,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            passwordHash: await argon2.hash(userData.password),
        });
        const invRole = await db.Role.findOne({ where: { name: 'INVENTORY_MANAGER' } });
        await testUser.addRole(invRole);

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: userData.username, password: userData.password });
        testToken = loginRes.body.data.accessToken;

        colour = await db.Colour.create({ name: 'Red V2', hexValue: '#FF0000', isActive: true });
        size = await db.Size.create({ name: 'M V2', isActive: true });

        parentType = await db.ProductType.create({ name: 'Sari V2', isActive: true });
        childType = await db.ProductType.create({ name: 'Paithani V2', parentId: parentType.id, isActive: true });

        vendor = await db.Vendor.create({ name: 'V2 Vendor', isActive: true });

        const pair = await createTripWithVendor({
            vendor,
            name: 'TEST Inventory V2 Trip',
            totalPaidPaise: 1000000,
        });
        trip = pair.trip;
        tripVendor = pair.tripVendor;
    });

    afterAll(async () => {
        await db.Unit.destroy({ where: { stockId: stock?.id || null }, force: true });
        await db.Stock.destroy({ where: { tripId: trip.id }, force: true });
        await db.StockTemplate.destroy({ where: { vendorId: vendor.id }, force: true });
        await db.TripVendor.destroy({ where: { tripId: trip.id }, force: true });
        await db.Trip.destroy({ where: { id: trip.id }, force: true });
        await db.Vendor.destroy({ where: { id: vendor.id }, force: true });
        await db.ProductType.destroy({ where: { id: [childType.id, parentType.id] }, force: true });
        await db.User.destroy({ where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } } });
        await closeDatabase();
    });

    describe('Templates - subTypeUuid + wholeBuyingPricePaise', () => {
        it('should create a template with subtype and whole buying price', async () => {
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    vendorUuid: vendor.uuid,
                    name: 'Sari Paithani V2',
                    productTypeUuid: parentType.uuid,
                    subTypeUuid: childType.uuid,
                    buyingPricePaise: 1000,
                    wholeBuyingPricePaise: 8000,
                    defaultQuantity: 3,
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.subTypeUuid).toBe(childType.uuid);
            expect(res.body.data.wholeBuyingPricePaise).toBe('8000');
            expect(res.body.data.buyingPricePaise).toBe('1000');
        });

        it('should reject a top-level product type as subtype', async () => {
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    vendorUuid: vendor.uuid,
                    productTypeUuid: parentType.uuid,
                    subTypeUuid: parentType.uuid,
                    buyingPricePaise: 1000,
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Sub type must belong to a parent product type');
        });

        it('should clear a template subtype via PATCH', async () => {
            const res = await request(app)
                .patch(`/api/templates/${(await db.StockTemplate.findOne({ where: { vendorId: vendor.id } })).uuid}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ subTypeUuid: null });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.subTypeUuid).toBeNull();
        });
    });

    describe('Stocks - subTypeUuid + wholeBuyingPricePaise', () => {
        it('should create a stock with subtype and whole buying price', async () => {
            const res = await request(app)
                .post(`/api/trips/${trip.uuid}/stocks`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    tripUuid: trip.uuid,
                    vendorUuid: vendor.uuid,
                    productTypeUuid: parentType.uuid,
                    subTypeUuid: childType.uuid,
                    quantity: 10,
                    buyingPricePaise: 1000,
                    wholeBuyingPricePaise: 12000,
                    sellingPricePaise: 2500,
                    floorPricePaise: 2000,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.subTypeUuid).toBe(childType.uuid);
            expect(res.body.data.wholeBuyingPricePaise).toBe('12000');

            stock = await db.Stock.findOne({ where: { uuid: res.body.data.uuid } });
        });

        it('should reject a top-level product type as stock subtype', async () => {
            const res = await request(app)
                .post(`/api/trips/${trip.uuid}/stocks`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    tripUuid: trip.uuid,
                    vendorUuid: vendor.uuid,
                    productTypeUuid: parentType.uuid,
                    subTypeUuid: parentType.uuid,
                    quantity: 5,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Sub type must belong to a parent product type');
        });

        it('should not find a top-level type as a stock subtype (404)', async () => {
            const res = await request(app)
                .post(`/api/trips/${trip.uuid}/stocks`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    tripUuid: trip.uuid,
                    vendorUuid: vendor.uuid,
                    productTypeUuid: parentType.uuid,
                    subTypeUuid: '00000000-0000-0000-0000-000000000000',
                    quantity: 5,
                    buyingPricePaise: 1000,
                    sellingPricePaise: 2000,
                    floorPricePaise: 1500,
                    channel: 'RETAIL',
                });

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toContain('Sub type not found');
        });

        it('should update and clear a stock subtype via PATCH', async () => {
            const res = await request(app)
                .patch(`/api/trips/${trip.uuid}/stocks/${stock.uuid}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ subTypeUuid: null });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.subTypeUuid).toBeNull();

            const res2 = await request(app)
                .patch(`/api/trips/${trip.uuid}/stocks/${stock.uuid}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ subTypeUuid: childType.uuid });

            expect(res2.statusCode).toBe(200);
            expect(res2.body.data.subTypeUuid).toBe(childType.uuid);
        });
    });

    describe('GET /api/stocks - bare list-all', () => {
        it('should list stocks across trips with trip/vendor/subtype context', async () => {
            const res = await request(app)
                .get('/api/stocks')
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            const found = res.body.data.find((s) => s.uuid === stock.uuid);
            expect(found).toBeDefined();
            expect(found.tripUuid).toBe(trip.uuid);
            expect(found.vendorUuid).toBe(vendor.uuid);
            expect(found.vendorName).toBe('V2 Vendor');
            expect(found.productTypeUuid).toBe(parentType.uuid);
            expect(found.subTypeUuid).toBe(childType.uuid);
            expect(found.wholeBuyingPricePaise).toBe('12000');
            expect(found.unitsScannedCount).toBe(0);
        });

        it('should filter by tripUuid', async () => {
            const res = await request(app)
                .get(`/api/stocks?tripUuid=${trip.uuid}`)
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.every((s) => s.tripUuid === trip.uuid)).toBe(true);
        });

        it('should filter by subtype name via search', async () => {
            const res = await request(app)
                .get('/api/stocks?search=Paithani%20V2')
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.some((s) => s.uuid === stock.uuid)).toBe(true);
        });

        it('should return 400 for an invalid tripUuid query', async () => {
            const res = await request(app)
                .get('/api/stocks?tripUuid=not-a-uuid')
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(400);
        });

        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/stocks');
            expect(res.statusCode).toBe(401);
        });
    });

    describe('Trip buying sum uses whole buying price', () => {
        it('should use wholeBuyingPricePaise for the trip buying sum', async () => {
            const res = await request(app)
                .get('/api/trips')
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(200);
            const found = res.body.data.find((t) => t.uuid === trip.uuid);
            expect(found).toBeDefined();
            // totalPaid 1000000 - buyingSum. Whole price 12000 wins over qty*buying (10*1000 = 10000).
            expect(found.totalPaidPaise).toBe("1000000");
            expect(found.variancePaise).toBe(String(1000000 - 12000));
        });
    });

    describe('GET /api/units - bare list-all', () => {
        it('should list scanned units with stock/vendor/colour/size context', async () => {
            const scanRes = await request(app)
                .post(`/api/trips/${trip.uuid}/stocks/${stock.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ barcode: '555777666001', colourUuid: colour.uuid, sizeUuid: size.uuid });

            expect(scanRes.statusCode).toBe(201);

            const res = await request(app)
                .get(`/api/units?stockUuid=${stock.uuid}`)
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            const found = res.body.data.find((u) => u.barcode === '555777666001');
            expect(found).toBeDefined();
            expect(found.stockUuid).toBe(stock.uuid);
            expect(found.stockName).toBe('Sari V2 Paithani V2');
            expect(found.vendorName).toBe('V2 Vendor');
            expect(found.tripUuid).toBe(trip.uuid);
            expect(found.colourName).toBe('Red V2');
            expect(found.sizeName).toBe('M V2');
            expect(found.status).toBe('in_stock');
            expect(found.buyingPricePaise).toBe('1000');
        });

        it('should filter by barcode search and status', async () => {
            const bySearch = await request(app)
                .get('/api/units?search=555777666001')
                .set('Authorization', `Bearer ${testToken}`);

            expect(bySearch.statusCode).toBe(200);
            expect(bySearch.body.data.some((u) => u.barcode === '555777666001')).toBe(true);

            const byStatus = await request(app)
                .get('/api/units?status=in_stock')
                .set('Authorization', `Bearer ${testToken}`);

            expect(byStatus.statusCode).toBe(200);
            expect(byStatus.body.data.some((u) => u.barcode === '555777666001')).toBe(true);
        });

        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/units');
            expect(res.statusCode).toBe(401);
        });
    });
});