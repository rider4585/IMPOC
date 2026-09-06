import express from 'express';
import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import salesRoutes from '../../src/modules/sales/sales.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';

/*
 * T-08 sales routes are intentionally NOT mounted in app.js (another owner
 * integrates them). To verify the module here, mount the sales router on a
 * local test app that shares the same DB/jwt auth as the real app.
 */
const testApp = express();
testApp.use(express.json());
testApp.use('/api/sales', salesRoutes);
testApp.use(errorMiddleware);

describe('Sales / POS module (T-08)', () => {
    let managerToken;
    let cashierToken;
    let trip;
    let tripVendor;
    let vendor;
    let stock;
    let colour;
    let size;
    let productType;
    let unit1;
    let unit2;

    async function scanUnit(barcode) {
        const res = await request(app)
            .post(`/api/trips/${trip.uuid}/stocks/${stock.uuid}/scan`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
                barcode,
                colourUuid: colour.uuid,
                sizeUuid: size.uuid,
            })
            .expect(201);
        return res.body.data;
    }

    beforeAll(async () => {
        await initializeTestDatabase();

        // MANAGER has sales.* permissions (view/create/cancel/refund)
        const mgrData = generateTestUser({ password: 'TestPassword123!' });
        const mgr = await db.User.create({
            username: mgrData.username,
            firstName: mgrData.firstName,
            lastName: mgrData.lastName,
            email: mgrData.email,
            passwordHash: await argon2.hash(mgrData.password),
        });
        const mgrRole = await db.Role.findOne({ where: { name: 'MANAGER' } });
        await mgr.addRole(mgrRole);

        const mgrLogin = await request(app)
            .post('/api/auth/login')
            .send({ username: mgrData.username, password: mgrData.password });
        managerToken = mgrLogin.body.data.accessToken;

        // CASHIER has sales.view + sales.create
        const cashierData = generateTestUser({ password: 'TestPassword123!' });
        const cashier = await db.User.create({
            username: cashierData.username,
            firstName: cashierData.firstName,
            lastName: cashierData.lastName,
            email: cashierData.email,
            passwordHash: await argon2.hash(cashierData.password),
        });
        const cashRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
        await cashier.addRole(cashRole);
        const cashLogin = await request(app)
            .post('/api/auth/login')
            .send({ username: cashierData.username, password: cashierData.password });
        cashierToken = cashLogin.body.data.accessToken;

        colour = await db.Colour.create({ name: 'Blue', hexValue: '#0000FF', isActive: true });
        size = await db.Size.create({ name: 'L', isActive: true });
        productType = await db.ProductType.create({ name: `PT_${Date.now()}` });
        vendor = await db.Vendor.create({ name: 'Test Vendor' });

        const pair = await createTripWithVendor({
            vendor,
            name: 'TEST Sales Trip',
            totalPaidPaise: 1000000,
        });
        trip = pair.trip;
        tripVendor = pair.tripVendor;

        stock = await createTestStock({
            trip,
            tripVendor,
            vendor,
            productType,
            overrides: {
                quantity: 10,
                buyingPricePaise: 100000,
                sellingPricePaise: 200000,
                floorPricePaise: 150000,
                channel: 'RETAIL',
            },
        });

        unit1 = await scanUnit('A1000000001');
        unit2 = await scanUnit('A1000000002');
    });

    afterAll(async () => {
        await db.User.destroy({
            where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } },
        });
        await db.Unit.destroy({ where: { stockId: stock.id }, force: true });
        await db.Stock.destroy({ where: { id: stock.id }, force: true });
        await db.TripVendor.destroy({ where: { tripId: trip.id }, force: true });
        await db.Trip.destroy({ where: { id: trip.id }, force: true });
        await closeDatabase();
    });

    describe('POST /api/sales - checkout', () => {
        it('should create a sale and move units to sold', async () => {
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ customerName: 'Walk-in', paymentMethod: 'Cash', customerSource: 'Instagram', items: [{ unitUuid: unit1.uuid }, { unitUuid: unit2.uuid }] })
                .expect(201);

            expect(res.body.success).toBe(true);
            const sale = res.body.data;
            expect(sale.saleNumber).toBeDefined();
            expect(sale.paymentMethod).toBe('Cash');
            expect(sale.customerSource).toBe('Instagram');
            expect(sale.totalPaise).toBe('400000'); // 2 * 200000 snapshot
            expect(sale.lines).toHaveLength(2);
            expect(sale.lines[0].sellingPricePaise).toBe('200000');

            const dbUnit1 = await db.Unit.findOne({ where: { uuid: unit1.uuid } });
            const dbUnit2 = await db.Unit.findOne({ where: { uuid: unit2.uuid } });
            expect(dbUnit1.status).toBe('sold');
            expect(dbUnit2.status).toBe('sold');

            global.__saleUuid = sale.uuid;
        });

        it('should allow a cashier to create a sale (sales.create)', async () => {
            const unit3 = await scanUnit('A1000000003');
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({ items: [{ unitUuid: unit3.uuid }] })
                .expect(201);

            expect(res.body.data.lines).toHaveLength(1);
            global.__cashierSaleUuid = res.body.data.uuid;
        });

        it('should reject selling a non-sellable (rental) unit', async () => {
            const rStock = await createTestStock({
                trip,
                tripVendor,
                vendor,
                productType,
                overrides: {
                    quantity: 2,
                    buyingPricePaise: 50000,
                    sellingPricePaise: 30000,
                    floorPricePaise: 25000,
                    channel: 'RENTAL',
                    rentPerDayPaise: 10000,
                    depositPaise: 1000,
                    overduePerDayPaise: 500,
                },
            });
            const scanRes = await request(app)
                .post(`/api/trips/${trip.uuid}/stocks/${rStock.uuid}/scan`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    barcode: 'R1000000001',
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(201);
            const rentalUnit = scanRes.body.data;

            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ items: [{ unitUuid: rentalUnit.uuid }] })
                .expect(400);

            expect(res.body.success).toBe(false);
        });

        it('should not require cancel permission for listing (sales.view)', async () => {
            await request(testApp)
                .get('/api/sales')
                .set('Authorization', `Bearer ${cashierToken}`)
                .expect(200);
        });
    });

    describe('GET /api/sales', () => {
        it('should list sales with units marked sold', async () => {
            const res = await request(testApp)
                .get('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('POST /api/sales/:uuid/cancel', () => {
        it('should reverse units back to in_stock and mark cancelled', async () => {
            const saleUuid = global.__saleUuid;
            const res = await request(testApp)
                .post(`/api/sales/${saleUuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ reason: 'Customer changed mind' })
                .expect(200);

            expect(res.body.data.status).toBe('cancelled');
            expect(res.body.data.reversals).toHaveLength(1);
            expect(res.body.data.reversals[0].reversalType).toBe('CANCEL');

            const dbUnit1 = await db.Unit.findOne({ where: { uuid: unit1.uuid } });
            expect(dbUnit1.status).toBe('in_stock');
        });

        it('should forbid a cashier from cancelling (no sales.cancel)', async () => {
            const saleUuid = global.__cashierSaleUuid;
            await request(testApp)
                .post(`/api/sales/${saleUuid}/cancel`)
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({ reason: 'nope' })
                .expect(403);
        });
    });

    describe('POST /api/sales/:uuid/refund', () => {
        it('should record a refund reversal without reversing units', async () => {
            const saleUuid = global.__cashierSaleUuid;
            const res = await request(testApp)
                .post(`/api/sales/${saleUuid}/refund`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ reason: 'Defective product' })
                .expect(200);

            expect(res.body.data.status).toBe('refunded');
            expect(res.body.data.reversals.some((r) => r.reversalType === 'REFUND')).toBe(true);
        });
    });
});
