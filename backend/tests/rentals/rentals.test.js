import express from 'express';
import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import rentalRoutes from '../../src/modules/rentals/rental-agreement.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';

/*
 * T-10 rental routes are intentionally NOT mounted in app.js (another owner
 * integrates them). To verify the module here, mount the rental router on a
 * local test app that shares the same DB/jwt auth as the real app. The
 * rentals.* permissions are not yet seeded (reported to god), so they are
 * created and assigned to MANAGER within this suite.
 */
const testApp = express();
testApp.use(express.json());
testApp.use('/api/rentals', rentalRoutes);
testApp.use(errorMiddleware);

const RENTAL_PERMISSIONS = ['rentals.view', 'rentals.create', 'rentals.return', 'rentals.cancel'];

describe('Rental agreements module (T-10)', () => {
    let managerToken;
    let cashierToken;
    let trip;
    let lot;
    let colour;
    let size;
    let productType;
    let gradeMaintenance;
    let gradeRetire;

    async function scanUnit(barcode) {
        const res = await request(app)
            .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
                barcode,
                stockIntakeLineUuid: lot.uuid,
                colourUuid: colour.uuid,
                sizeUuid: size.uuid,
            })
            .expect(201);
        return res.body.data;
    }

    beforeAll(async () => {
        await initializeTestDatabase();

        // MANAGER role lacks rentals.* until god seeds them; add them here for the suite
        const managerRole = await db.Role.findOne({ where: { name: 'MANAGER' } });
        for (const name of RENTAL_PERMISSIONS) {
            const perm = await db.Permission.findOrCreate({
                where: { name },
                defaults: { description: `Rental ${name} permission (test)` },
            });
            await managerRole.addPermission(perm[0]);
        }

        const mgrData = generateTestUser({ password: 'TestPassword123!' });
        const manager = await db.User.create({
            username: mgrData.username,
            firstName: mgrData.firstName,
            lastName: mgrData.lastName,
            email: mgrData.email,
            passwordHash: await argon2.hash(mgrData.password),
        });
        await manager.addRole(managerRole);
        const mgrLogin = await request(app)
            .post('/api/auth/login')
            .send({ username: mgrData.username, password: mgrData.password });
        managerToken = mgrLogin.body.data.accessToken;

        // CASHIER has view but not create/return/cancel
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
        const vendor = await db.Vendor.create({ name: 'Test Vendor' });
        trip = await db.StockIntake.create({
            vendorId: vendor.id,
            purchasedOn: new Date().toISOString().split('T')[0],
            totalPaidPaise: 1000000,
        });
        lot = await db.StockIntakeLine.create({
            stockIntakeId: trip.id,
            productTypeId: productType.id,
            quantity: 20,
            buyingPricePaise: 100000,
            sellingPricePaise: 30000,
            floorPricePaise: 25000,
            channel: 'RENTAL',
            rentPerDayPaise: 10000,
            depositPaise: 5000,
            overduePerDayPaise: 2000,
        });

        gradeMaintenance = await db.DamageGrade.create({
            name: `Grade_Maint_${Date.now()}`,
            outcome: 'SEND_TO_MAINTENANCE',
            isActive: true,
        });
        gradeRetire = await db.DamageGrade.create({
            name: `Grade_Retire_${Date.now()}`,
            outcome: 'RETIRE',
            isActive: true,
        });
    });

    afterAll(async () => {
        await db.User.destroy({
            where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } },
        });
        await closeDatabase();
    });

    describe('POST /api/rentals - checkout', () => {
        it('should create an active agreement, snapshot prices, and move units to rented', async () => {
            const u1 = await scanUnit('RA0000000001');
            const u2 = await scanUnit('RA0000000002');

            const res = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    customerName: 'Rental Customer',
                    startDate: '2026-09-01',
                    rentalDays: 5,
                    items: [{ unitUuid: u1.uuid }, { unitUuid: u2.uuid }],
                })
                .expect(201);

            expect(res.body.success).toBe(true);
            const agreement = res.body.data;
            expect(agreement.agreementNumber).toBe('R-0001');
            expect(agreement.status).toBe('active');
            expect(agreement.startDate).toBe('2026-09-01');
            expect(agreement.dueDate).toBe('2026-09-06'); // +5 days
            expect(agreement.depositRefundablePaise).toBe('10000'); // 2 * 5000
            expect(agreement.lines).toHaveLength(2);
            expect(agreement.lines[0].rentPerDayPaise).toBe('10000');
            expect(agreement.lines[0].depositPaise).toBe('5000');
            expect(agreement.lines[0].overduePerDayPaise).toBe('2000');

            const dbU1 = await db.Unit.findOne({ where: { uuid: u1.uuid } });
            const dbU2 = await db.Unit.findOne({ where: { uuid: u2.uuid } });
            expect(dbU1.status).toBe('rented');
            expect(dbU2.status).toBe('rented');

            global.__agreementUuid = agreement.uuid;
        });

        it('should forbid a cashier from checkout (no rentals.create)', async () => {
            const u3 = await scanUnit('RA0000000003');
            await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({ items: [{ unitUuid: u3.uuid }] })
                .expect(403);
        });
    });

    describe('GET /api/rentals', () => {
        it('should list agreements with rented units', async () => {
            const res = await request(testApp)
                .get('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('POST /api/rentals/:uuid/return', () => {
        it('should return a unit on time and move it back to in_stock (agreement stays active)', async () => {
            const res = await request(testApp)
                .post(`/api/rentals/${global.__agreementUuid}/return`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    actualReturnDate: '2026-09-02',
                    items: [{ barcode: 'RA0000000001' }],
                })
                .expect(200);

            const agreement = res.body.data;
            expect(agreement.status).toBe('active'); // still one unit out
            const returnRow = agreement.lines.find((l) => l.barcode === 'RA0000000001').returns[0];
            expect(returnRow.lateDays).toBe(0);
            expect(returnRow.overdueChargePaise).toBe('0');
            expect(returnRow.damageChargePaise).toBe('0');
            expect(returnRow.depositRefundedPaise).toBe('5000');

            const dbU1 = await db.Unit.findOne({ where: { barcode: 'RA0000000001' } });
            expect(dbU1.status).toBe('in_stock');
        });

        it('should compute overdue/damage, refund reduced deposit, and complete the agreement', async () => {
            const res = await request(testApp)
                .post(`/api/rentals/${global.__agreementUuid}/return`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    actualReturnDate: '2026-09-10', // 4 days past due date 2026-09-06
                    items: [{ barcode: 'RA0000000002', gradeUuid: gradeMaintenance.uuid, damageChargePaise: 3000 }],
                })
                .expect(200);

            const agreement = res.body.data;
            expect(agreement.status).toBe('completed'); // all lines returned

            const line = agreement.lines.find((l) => l.barcode === 'RA0000000002');
            const returnRow = line.returns[0];
            // overdue: 4 days * 2000 = 8000
            expect(returnRow.lateDays).toBe(4);
            expect(returnRow.overdueChargePaise).toBe('8000');
            // damage: entered per item at return time
            expect(returnRow.damageChargePaise).toBe('3000');
            // deposit refunded = 5000 - 8000 - 3000 => 0
            expect(returnRow.depositRefundedPaise).toBe('0');
            expect(returnRow.damageGradeOutcome).toBe('SEND_TO_MAINTENANCE');

            const dbU2 = await db.Unit.findOne({ where: { barcode: 'RA0000000002' } });
            expect(dbU2.status).toBe('in_maintenance');
        });

        it('should reject returning a unit that is already returned', async () => {
            await request(testApp)
                .post(`/api/rentals/${global.__agreementUuid}/return`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ items: [{ barcode: 'RA0000000001' }] })
                .expect(409);
        });
    });

    describe('POST /api/rentals/:uuid/cancel', () => {
        it('should cancel an active agreement, reverse units to in_stock, and record a reversal', async () => {
            const a1 = await scanUnit('RA0000000010');
            const a2 = await scanUnit('RA0000000011');

            const createRes = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ items: [{ unitUuid: a1.uuid }, { unitUuid: a2.uuid }] })
                .expect(201);

            const cancelRes = await request(testApp)
                .post(`/api/rentals/${createRes.body.data.uuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ reason: 'Customer cancelled' })
                .expect(200);

            expect(cancelRes.body.data.status).toBe('cancelled');
            expect(cancelRes.body.data.reversals).toHaveLength(1);
            expect(cancelRes.body.data.reversals[0].reversalType).toBe('CANCEL');
            expect(cancelRes.body.data.reversals[0].amountPaise).toBe('10000');

            const dbA1 = await db.Unit.findOne({ where: { uuid: a1.uuid } });
            const dbA2 = await db.Unit.findOne({ where: { uuid: a2.uuid } });
            expect(dbA1.status).toBe('in_stock');
            expect(dbA2.status).toBe('in_stock');
        });

        it('should forbid cancelling an already-cancelled agreement', async () => {
            const a3 = await scanUnit('RA0000000012');
            const createRes = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ items: [{ unitUuid: a3.uuid }] })
                .expect(201);
            await request(testApp)
                .post(`/api/rentals/${createRes.body.data.uuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ reason: 'cancel' })
                .expect(200);
            await request(testApp)
                .post(`/api/rentals/${createRes.body.data.uuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ reason: 'again' })
                .expect(409);
        });
    });
});
