import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import salesRoutes from '../../src/modules/sales/sales.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';
import { createSale, cancelSale, refundSale } from '../../src/modules/sales/sales.service.js';

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
    let managerUserId;
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
    let unit5;
    let unit6;
    let floorStock;

    async function scanUnit(barcode, targetStock = stock) {
        const res = await request(app)
            .post(`/api/trips/${trip.uuid}/stocks/${targetStock.uuid}/scan`)
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

        // SEC-M-8: ledger snapshots must reference active picklist entries.
        await db.PaymentMethod.create({ name: 'Cash', isActive: true });
        await db.CustomerSource.create({ name: 'Instagram', isActive: true });

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
        managerUserId = mgr.id;

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
                quantity: 12,
                buyingPricePaise: 100000,
                sellingPricePaise: 200000,
                floorPricePaise: 150000,
                channel: 'RETAIL',
            },
        });

        unit1 = await scanUnit('A1000000001');
        unit2 = await scanUnit('A1000000002');
        unit5 = await scanUnit('A1000000005');
        unit6 = await scanUnit('A1000000006');

        // Dedicated stock for the R-30 floor-price tests so they never consume
        // the shared stock's declared quantity (which later race tests depend on).
        floorStock = await createTestStock({
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
    });

    afterAll(async () => {
        await db.User.destroy({
            where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } },
        });
        await db.PaymentMethod.destroy({ where: { name: 'Cash' }, force: true });
        await db.CustomerSource.destroy({ where: { name: 'Instagram' }, force: true });
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
                .send({ requestUuid: uuidv4(), customerName: 'Walk-in', paymentMethod: 'Cash', customerSource: 'Instagram', items: [{ unitUuid: unit1.uuid }, { unitUuid: unit2.uuid }] })
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
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit3.uuid }] })
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
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: rentalUnit.uuid }] })
                .expect(400);

            expect(res.body.success).toBe(false);
        });

        it('should reject a sale item with neither barcode nor unitUuid (SEC-H-6)', async () => {
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{}] })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/exactly one of barcode or unitUuid/);
        });

        it('should reject a sale item with both barcode and unitUuid (SEC-H-6)', async () => {
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit1.uuid, barcode: unit1.barcode }] })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/exactly one of barcode or unitUuid/);
        });

        it('should allow a sale item resolved by barcode only (SEC-H-6 positive control)', async () => {
            const unit4 = await scanUnit('A1000000004');
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ barcode: unit4.barcode }] })
                .expect(201);

            expect(res.body.data.lines).toHaveLength(1);
            expect(res.body.data.lines[0].barcode).toBe(unit4.barcode);
        });

        it('should reject a checkout price below the unit floor (R-30, unitUuid path)', async () => {
            const unit = await scanUnit('FLR00000001', floorStock);
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit.uuid, sellingPricePaise: 149999 }] })
                .expect(400);

            expect(res.body.message).toBe('Price cannot be below floor price');
        });

        it('should reject a checkout price below the unit floor (R-30, barcode path)', async () => {
            const unit = await scanUnit('FLR00000002', floorStock);
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ barcode: unit.barcode, sellingPricePaise: 100000 }] })
                .expect(400);

            expect(res.body.message).toBe('Price cannot be below floor price');
        });

        it('should accept a checkout price exactly at the floor (R-30)', async () => {
            const unit = await scanUnit('FLR00000003', floorStock);
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit.uuid, sellingPricePaise: 150000 }] })
                .expect(201);

            expect(res.body.data.totalPaise).toBe('150000');
            expect(res.body.data.lines[0].sellingPricePaise).toBe('150000');
        });

        it('should accept a checkout price equal to the unit snapshot (R-30)', async () => {
            const unit = await scanUnit('FLR00000004', floorStock);
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit.uuid, sellingPricePaise: 200000 }] })
                .expect(201);

            expect(res.body.data.totalPaise).toBe('200000');
            expect(res.body.data.lines[0].sellingPricePaise).toBe('200000');
        });

        it('should reject at the service layer when a sale item has no identifier (SEC-H-6)', async () => {
            await expect(createSale({ items: [{}], actorUserId: managerUserId })).rejects.toMatchObject({
                statusCode: 400,
                message: expect.stringMatching(/exactly one of barcode or unitUuid/),
            });
        });

        it('should not require cancel permission for listing (sales.view)', async () => {
            await request(testApp)
                .get('/api/sales')
                .set('Authorization', `Bearer ${cashierToken}`)
                .expect(200);
        });

        it('should reject a paymentMethod outside the active picklist (SEC-M-8)', async () => {
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit5.uuid }], paymentMethod: 'Credit Card' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/not in the payment methods picklist/);
        });

        it('should reject a customerSource outside the active picklist (SEC-M-8)', async () => {
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit6.uuid }], customerSource: 'TikTok' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/not in the customer sources picklist/);
        });

        it('should allow an absent paymentMethod/customerSource (SEC-M-8)', async () => {
            // unit3 was already sold by the cashier test; reuse a fresh unit.
            const unit7 = await scanUnit('A1000000007');
            const res = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit7.uuid }] })
                .expect(201);

            expect(res.body.data.paymentMethod).toBe(null);
            expect(res.body.data.customerSource).toBe(null);
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
                .send({ requestUuid: uuidv4(), reason: 'Customer changed mind' })
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
                .send({ requestUuid: uuidv4(), reason: 'Defective product' })
                .expect(200);

            expect(res.body.data.status).toBe('refunded');
            expect(res.body.data.reversals.some((r) => r.reversalType === 'REFUND')).toBe(true);
        });
    });

    describe('Money-out race fixes (R-29)', () => {
        it('should double-cancel only once: concurrent cancels yield one success and one 409', async () => {
            const u = await scanUnit('RACECANCEL01');
            const sale = await createSale({
                items: [{ unitUuid: u.uuid }],
                actorUserId: managerUserId,
            });
            const saleRow = await db.Sale.findOne({ where: { uuid: sale.uuid } });

            const attempt = async () => cancelSale({ uuid: sale.uuid, reason: 'race', actorUserId: managerUserId });

            const results = await Promise.allSettled([attempt(), attempt()]);
            const ok = results.filter((r) => r.status === 'fulfilled');
            const rejected = results.filter((r) => r.status === 'rejected');

            expect(ok).toHaveLength(1);
            expect(rejected).toHaveLength(1);
            expect(rejected[0].reason.statusCode).toBe(409);
            expect(rejected[0].reason.message).toMatch(/already/);

            const reversals = await db.SaleReversal.count({
                where: { saleId: saleRow.id, reversalType: 'CANCEL', deletedAt: null },
            });
            expect(reversals).toBe(1);
        });

        it('should double-refund only once: concurrent refunds yield one success and one 409', async () => {
            const u = await scanUnit('RACEREFUND1');
            const sale = await createSale({
                items: [{ unitUuid: u.uuid }],
                actorUserId: managerUserId,
            });
            const saleRow = await db.Sale.findOne({ where: { uuid: sale.uuid } });

            const attempt = async () => refundSale({ uuid: sale.uuid, reason: 'race', actorUserId: managerUserId });

            const results = await Promise.allSettled([attempt(), attempt()]);
            const ok = results.filter((r) => r.status === 'fulfilled');
            const rejected = results.filter((r) => r.status === 'rejected');

            expect(ok).toHaveLength(1);
            expect(rejected).toHaveLength(1);
            expect(rejected[0].reason.statusCode).toBe(409);
            expect(rejected[0].reason.message).toMatch(/already/);

            const reversals = await db.SaleReversal.count({
                where: { saleId: saleRow.id, reversalType: 'REFUND', deletedAt: null },
            });
            expect(reversals).toBe(1);
        });

        it('should produce unique sale numbers under concurrent checkout', async () => {
            const u1 = await scanUnit('RACENUM001');
            const u2 = await scanUnit('RACENUM002');

            const results = await Promise.allSettled([
                createSale({ items: [{ unitUuid: u1.uuid }], actorUserId: managerUserId }),
                createSale({ items: [{ unitUuid: u2.uuid }], actorUserId: managerUserId }),
            ]);

            const sales = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
            expect(sales[0]).not.toBeNull();
            expect(sales[1]).not.toBeNull();
            const numbers = sales.map((s) => s.saleNumber);
            expect(numbers[0]).not.toBe(numbers[1]);

            const allDistinct = new Set(numbers).size === numbers.length;
            expect(allDistinct).toBe(true);
        });
    });

    describe('SEC-M-5 - read scoping for sales', () => {
        it('should let a cashier (broad read? no) see only their own sales', async () => {
            const mgrSaleUuid = global.__saleUuid;
            const cashierSaleUuid = global.__cashierSaleUuid;

            const ownGet = await request(testApp)
                .get(`/api/sales/${cashierSaleUuid}`)
                .set('Authorization', `Bearer ${cashierToken}`)
                .expect(200);
            expect(ownGet.body.data.uuid).toBe(cashierSaleUuid);

            await request(testApp)
                .get(`/api/sales/${mgrSaleUuid}`)
                .set('Authorization', `Bearer ${cashierToken}`)
                .expect(404);

            const list = await request(testApp)
                .get('/api/sales')
                .set('Authorization', `Bearer ${cashierToken}`)
                .expect(200);
            const uuids = list.body.data.map((s) => s.uuid);
            expect(uuids).toContain(cashierSaleUuid);
            expect(uuids).not.toContain(mgrSaleUuid);
        });

        it('should let a manager (broad read scope) see sales created by others', async () => {
            const list = await request(testApp)
                .get('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);
            const uuids = list.body.data.map((s) => s.uuid);
            expect(uuids).toContain(global.__saleUuid);
            expect(uuids).toContain(global.__cashierSaleUuid);
        });
    });

    describe('SEC-M-3 - request-key idempotency for sales', () => {
        let idemStock;

        beforeAll(async () => {
            // Dedicated stock so the idempotency suite has spare declared
            // quantity (the main stock holds 10 units).
            idemStock = await createTestStock({
                trip,
                tripVendor,
                vendor,
                productType,
                overrides: {
                    quantity: 30,
                    buyingPricePaise: 100000,
                    sellingPricePaise: 200000,
                    floorPricePaise: 150000,
                    channel: 'RETAIL',
                },
            });
        });

        it('should replay a repeated checkout with the cached sale instead of another sale', async () => {
            const u = await scanUnit('IDEMCO01', idemStock);

            const requestUuid = uuidv4();
            const first = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, items: [{ unitUuid: u.uuid }] })
                .expect(201);
            const saleUuid = first.body.data.uuid;

            const replay = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, items: [{ unitUuid: u.uuid }] })
                .expect(200);

            expect(replay.body.data.uuid).toBe(saleUuid);
            expect(replay.body.message).toContain('Sale already processed (request replayed)');

            const count = await db.Sale.count({ where: { uuid: saleUuid } });
            expect(count).toBe(1);
        });

        it('should replay a repeated cancel and keep a single cancellation', async () => {
            const u = await scanUnit('IDEMCO02', idemStock);
            const created = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: u.uuid }] })
                .expect(201);
            const saleUuid = created.body.data.uuid;

            const requestUuid = uuidv4();
            await request(testApp)
                .post(`/api/sales/${saleUuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, reason: 'first cancel' })
                .expect(200);

            const replay = await request(testApp)
                .post(`/api/sales/${saleUuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, reason: 'first cancel' })
                .expect(200);

            expect(replay.body.data.status).toBe('cancelled');
            expect(replay.body.message).toContain('Sale already processed (request replayed)');

            const saleRow = await db.Sale.findOne({ where: { uuid: saleUuid } });
            const reversals = await db.SaleReversal.count({
                where: { saleId: saleRow.id, reversalType: 'CANCEL', deletedAt: null },
            });
            expect(reversals).toBe(1);
        });

        it('should replay a repeated refund and keep a single refund', async () => {
            const u = await scanUnit('IDEMCO03', idemStock);
            const created = await request(testApp)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: u.uuid }] })
                .expect(201);
            const saleUuid = created.body.data.uuid;

            const requestUuid = uuidv4();
            await request(testApp)
                .post(`/api/sales/${saleUuid}/refund`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, reason: 'first refund' })
                .expect(200);

            const replay = await request(testApp)
                .post(`/api/sales/${saleUuid}/refund`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, reason: 'first refund' })
                .expect(200);

            expect(replay.body.data.status).toBe('refunded');
            expect(replay.body.message).toContain('Sale already processed (request replayed)');

            const saleRow = await db.Sale.findOne({ where: { uuid: saleUuid } });
            const reversals = await db.SaleReversal.count({
                where: { saleId: saleRow.id, reversalType: 'REFUND', deletedAt: null },
            });
            expect(reversals).toBe(1);
        });

        it('should resolve concurrent checkouts sharing a requestUuid to one persisted sale', async () => {
            const u = await scanUnit('IDEMCO04', idemStock);
            const requestUuid = uuidv4();

            const send = () =>
                request(testApp)
                    .post('/api/sales')
                    .set('Authorization', `Bearer ${managerToken}`)
                    .send({ requestUuid, items: [{ unitUuid: u.uuid }] });

            const results = await Promise.allSettled([send(), send()]);

            // Exactly one checkout wins; the loser either replays the winner's
            // cached sale (200) or 409s on the already-sold unit - but never a
            // second persisted sale (SEC-M-3).
            const wins = results.filter((r) => r.status === 'fulfilled' && r.value.status === 201);
            expect(wins).toHaveLength(1);

            const loser = results.find((r) => r !== wins[0]);
            const loserStatus =
                loser.status === 'fulfilled' ? loser.value.status : (loser.reason && loser.reason.status) || 0;
            if (loserStatus === 200) {
                expect(loser.value.body.message).toContain('Sale already processed (request replayed)');
                expect(loser.value.body.data.uuid).toBe(wins[0].value.body.data.uuid);
            } else {
                expect(loserStatus).toBeGreaterThanOrEqual(400);
                expect(loserStatus).toBeLessThan(500);
            }

            const lines = await db.SaleLine.count({ where: { unitUuid: u.uuid } });
            expect(lines).toBe(1);
        });
    });
});
