import express from 'express';
import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import reportsRoutes from '../../src/modules/reports/reports.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';

/*
 * T-14 reports routes are NOT mounted in app.js (integrator god mounts them).
 * To verify the module here, mount the reports router on a local test app that
 * shares the same DB/jwt auth as the real app.
 */
const testApp = express();
testApp.use(express.json());
testApp.use('/api/reports', reportsRoutes);
testApp.use(errorMiddleware);

// Fixed, isolated test period so this file's fixtures never collide with
// today-dated data created by other test files.
const FROM = '2026-01-01';
const TO = '2026-01-31';

describe('Reports module (T-14)', () => {
    let managerToken;
    let colour;
    let size;
    let productType;
    let trip;
    let tripVendor;
    let vendor;
    let createdStockIds = [];

    async function makeUnit({ barcode, channel, retail = true }) {
        const stock = await createTestStock({
            trip,
            tripVendor,
            vendor,
            productType,
            overrides: {
                quantity: 1,
                buyingPricePaise: 100000,
                sellingPricePaise: 200000,
                floorPricePaise: 150000,
                channel,
                rentPerDayPaise: retail ? null : 1000,
                depositPaise: retail ? null : 5000,
                overduePerDayPaise: retail ? null : 200,
            },
        });
        createdStockIds.push(stock.id);
        return db.Unit.create({
            barcode,
            stockId: stock.id,
            colourId: colour.id,
            sizeId: size.id,
            status: 'in_stock',
            channel,
            buyingPricePaise: 100000,
            sellingPricePaise: 200000,
            floorPricePaise: 150000,
            rentPerDayPaise: retail ? null : 1000,
            depositPaise: retail ? null : 5000,
            overduePerDayPaise: retail ? null : 200,
        });
    }

    beforeAll(async () => {
        await initializeTestDatabase();

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

        colour = await db.Colour.create({ name: 'Blue', hexValue: '#0000FF', isActive: true });
        size = await db.Size.create({ name: 'L', isActive: true });
        productType = await db.ProductType.create({ name: `PT_${Date.now()}` });

        vendor = await db.Vendor.create({ name: 'Test Vendor' });
        const pair = await createTripWithVendor({
            vendor,
            name: 'TEST Reports Trip',
            totalPaidPaise: 1000000,
        });
        trip = pair.trip;
        tripVendor = pair.tripVendor;

        // --- Sales fixtures ---
        const retail = await makeUnit({ barcode: 'A1000000011', channel: 'RETAIL' });
        const retail2 = await makeUnit({ barcode: 'A1000000012', channel: 'RETAIL' });
        const retail3 = await makeUnit({ barcode: 'A1000000013', channel: 'RETAIL' });

        const sale1 = await db.Sale.create({
            saleNumber: 'S-TEST1', customerName: 'Walk-in A', soldAt: '2026-01-10',
            totalPaise: 200000, status: 'completed',
        });
        await db.SaleLine.create({
            saleId: sale1.id, unitId: retail.id, unitUuid: retail.uuid,
            barcode: retail.barcode, sellingPricePaise: 200000,
        });

        const sale2 = await db.Sale.create({
            saleNumber: 'S-TEST2', customerName: 'Walk-in B', soldAt: '2026-01-20',
            totalPaise: 300000, status: 'completed',
        });
        await db.SaleLine.create({
            saleId: sale2.id, unitId: retail2.id, unitUuid: retail2.uuid,
            barcode: retail2.barcode, sellingPricePaise: 300000,
        });

        const sale3 = await db.Sale.create({
            saleNumber: 'S-TEST3', customerName: 'Return', soldAt: '2026-01-15',
            totalPaise: 150000, status: 'cancelled',
        });
        await db.SaleLine.create({
            saleId: sale3.id, unitId: retail3.id, unitUuid: retail3.uuid,
            barcode: retail3.barcode, sellingPricePaise: 150000,
        });
        await db.SaleReversal.create({
            saleId: sale3.id, reversalType: 'CANCEL', amountPaise: 150000, reason: 'changed mind',
        });

        // --- Rental fixtures ---
        const rentUnit = await makeUnit({ barcode: 'B1000000011', channel: 'RENTAL', retail: false });
        const rentUnit2 = await makeUnit({ barcode: 'B1000000012', channel: 'RENTAL', retail: false });

        const agr1 = await db.RentalAgreement.create({
            agreementNumber: 'R-TEST1', customerName: 'Renter A',
            startDate: '2026-01-05', dueDate: '2026-01-08',
            depositRefundablePaise: 5000, status: 'completed',
        });
        const line1 = await db.RentalLine.create({
            agreementId: agr1.id, unitId: rentUnit.id, unitUuid: rentUnit.uuid,
            barcode: rentUnit.barcode, rentPerDayPaise: 1000, depositPaise: 5000, overduePerDayPaise: 200,
        });
        await db.RentalReturn.create({
            agreementId: agr1.id, rentalLineId: line1.id, unitId: rentUnit.id, unitUuid: rentUnit.uuid,
            actualReturnDate: '2026-01-07', lateDays: 0, overdueChargePaise: 0,
            damageChargePaise: 50, depositRefundedPaise: 4950,
        });

        const agr2 = await db.RentalAgreement.create({
            agreementNumber: 'R-TEST2', customerName: 'Renter B',
            startDate: '2026-01-20', dueDate: '2026-01-23',
            depositRefundablePaise: 3000, status: 'active',
        });
        await db.RentalLine.create({
            agreementId: agr2.id, unitId: rentUnit2.id, unitUuid: rentUnit2.uuid,
            barcode: rentUnit2.barcode, rentPerDayPaise: 800, depositPaise: 3000, overduePerDayPaise: 150,
        });

        // --- Expense fixtures ---
        await db.Expense.create({
            amountPaise: 50000, category: 'Utilities', purpose: 'Power', expenseDate: '2026-01-10', status: 'completed',
        });
        await db.Expense.create({
            amountPaise: 30000, category: 'Rent', purpose: 'Shop rent', expenseDate: '2026-01-15', status: 'completed',
        });
        await db.Expense.create({
            amountPaise: 20000, category: 'Utilities', purpose: 'Cancelled', expenseDate: '2026-01-18', status: 'cancelled',
        });
    });

    afterAll(async () => {
        await db.User.destroy({
            where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } },
        });
        await db.Unit.destroy({ where: { stockId: { [db.Sequelize.Op.in]: createdStockIds } }, force: true });
        await db.Stock.destroy({ where: { id: { [db.Sequelize.Op.in]: createdStockIds } }, force: true });
        await db.TripVendor.destroy({ where: { tripId: trip.id }, force: true });
        await db.Trip.destroy({ where: { id: trip.id }, force: true });
        await closeDatabase();
    });

    it('rejects an unauthenticated dashboard call', async () => {
        await request(testApp).get('/api/reports/dashboard').expect(401);
    });

    it('rejects a user without reports.view', async () => {
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
        const login = await request(app)
            .post('/api/auth/login')
            .send({ username: cashierData.username, password: cashierData.password });
        await request(testApp)
            .get('/api/reports/dashboard')
            .set('Authorization', `Bearer ${login.body.data.accessToken}`)
            .expect(403);
    });

    it('GET /api/reports/sales returns per-sale rows and totals', async () => {
        const res = await request(testApp)
            .get(`/api/reports/sales?from=${FROM}&to=${TO}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        expect(res.body.success).toBe(true);
        const { rows, totals } = res.body.data;
        expect(rows).toHaveLength(3);
        expect(totals.count).toBe(3);
        expect(totals.grossPaise).toBe('650000');
        expect(totals.netPaise).toBe('650000');
        expect(totals.unitsSold).toBe(3);
    });

    it('GET /api/reports/rentals returns counts, earned rent, overdue and damage', async () => {
        const res = await request(testApp)
            .get(`/api/reports/rentals?from=${FROM}&to=${TO}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        const { rows, counts, totals } = res.body.data;
        expect(rows).toHaveLength(2);
        expect(counts).toEqual({ active: 1, completed: 1, cancelled: 0 });
        expect(totals.earnedPaise).toBe('2000');
        expect(totals.overdueChargePaise).toBe('0');
        expect(totals.damageChargePaise).toBe('50');
    });

    it('GET /api/reports/expenses returns totals and per-category totals', async () => {
        const res = await request(testApp)
            .get(`/api/reports/expenses?from=${FROM}&to=${TO}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        const { rows, totals } = res.body.data;
        expect(rows).toHaveLength(3);
        expect(totals.grossPaise).toBe('100000');
        expect(totals.takenPaise).toBe('80000');
        const utilities = totals.categoryTotals.find((c) => c.category === 'Utilities');
        expect(utilities.totalPaise).toBe('50000');
    });

    it('GET /api/reports/expenses filters by category', async () => {
        const res = await request(testApp)
            .get(`/api/reports/expenses?from=${FROM}&to=${TO}&category=Utilities`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        const { rows, totals } = res.body.data;
        expect(rows).toHaveLength(2);
        expect(totals.takenPaise).toBe('50000');
    });

    it('GET /api/reports/inventory returns the snapshot', async () => {
        const res = await request(testApp)
            .get('/api/reports/inventory')
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        const inv = res.body.data;
        expect(inv.total).toBe(5);
        expect(inv.byChannel).toEqual({ RETAIL: 3, RENTAL: 2 });
        expect(inv.byStatus).toEqual({ in_stock: 5 });
        expect(inv.retailInStock).toBe(3);
    });

    it('GET /api/reports/dashboard returns KPIs for the period', async () => {
        const res = await request(testApp)
            .get(`/api/reports/dashboard?from=${FROM}&to=${TO}`)
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        const data = res.body.data;
        expect(data.sales.totalPaise).toBe('500000');
        expect(data.sales.netPaise).toBe('500000');
        expect(data.sales.cancelledPaise).toBe('150000');
        expect(data.sales.count).toBe(3);
        expect(data.sales.unitsSold).toBe(3);
        expect(data.rentals.earnedPaise).toBe('2050');
        expect(data.expenses.totalPaise).toBe('80000');
        expect(data.expenses.cancelledPaise).toBe('20000');
        expect(data.netPaise).toBe('422050');
    });

    it('rejects an invalid date query param', async () => {
        await request(testApp)
            .get('/api/reports/sales?from=not-a-date')
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(400);
    });

    it('GET /api/reports/vendor-sell-through returns per-vendor sold/rented + revenue', async () => {
        const res = await request(testApp)
            .get('/api/reports/vendor-sell-through')
            .set('Authorization', `Bearer ${managerToken}`)
            .expect(200);

        const vendRow = res.body.data.rows.find((r) => r.vendorUuid === vendor.uuid);
        expect(vendRow).toBeTruthy();
        // 2 completed retail sales + 2 rental lines (one returned, one active) for this vendor.
        expect(vendRow.unitsSold).toBe(2);
        expect(vendRow.unitsRented).toBe(2);
        expect(vendRow.salesRevenuePaise).toBe('500000');
        // Rented days(2) * 1000/day + damage charge 50 (only the returned line earns).
        expect(vendRow.rentalEarnedPaise).toBe('2050');
    });
});
