import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, generateTestRole, closeDatabase, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import rentalRoutes from '../../src/modules/rentals/rental-agreement.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';
import { createRental, processRentalReturn, cancelRental } from '../../src/modules/rentals/rental-agreement.service.js';

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

const RENTAL_PERMISSIONS = ['rentals.view', 'rentals.create', 'rentals.update', 'rentals.return', 'rentals.cancel'];

describe('Rental agreements module (T-10)', () => {
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
    let gradeMaintenance;
    let gradeRetire;

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

        // SEC-M-8: ledger snapshots must reference active picklist entries.
        await db.PaymentMethod.create({ name: 'Cash', isActive: true });
        await db.CustomerSource.create({ name: 'WhatsApp group', isActive: true });

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
        managerUserId = manager.id;
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
        vendor = await db.Vendor.create({ name: 'Test Vendor' });

        const pair = await createTripWithVendor({
            vendor,
            name: 'TEST Rental Trip',
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
                quantity: 20,
                buyingPricePaise: 100000,
                sellingPricePaise: 30000,
                floorPricePaise: 25000,
                channel: 'RENTAL',
                rentPerDayPaise: 10000,
                depositPaise: 5000,
                overduePerDayPaise: 2000,
            },
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
        await db.PaymentMethod.destroy({ where: { name: 'Cash' }, force: true });
        await db.CustomerSource.destroy({ where: { name: 'WhatsApp group' }, force: true });
        await db.Unit.destroy({ where: { stockId: stock.id }, force: true });
        await db.Stock.destroy({ where: { id: stock.id }, force: true });
        await db.TripVendor.destroy({ where: { tripId: trip.id }, force: true });
        await db.Trip.destroy({ where: { id: trip.id }, force: true });
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
                    requestUuid: uuidv4(),
                    customerName: 'Rental Customer',
                    startDate: '2026-09-01',
                    rentalDays: 5,
                    paymentMethod: 'Cash',
                    customerSource: 'WhatsApp group',
                    items: [{ unitUuid: u1.uuid }, { unitUuid: u2.uuid }],
                })
                .expect(201);

            expect(res.body.success).toBe(true);
            const agreement = res.body.data;
            expect(agreement.agreementNumber).toBe('R-0001');
            expect(agreement.status).toBe('active');
            expect(agreement.startDate).toBe('2026-09-01');
            expect(agreement.dueDate).toBe('2026-09-06'); // +5 days
            expect(agreement.paymentMethod).toBe('Cash');
            expect(agreement.customerSource).toBe('WhatsApp group');
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

        it('should reject a rental item with neither barcode nor unitUuid (SEC-H-6)', async () => {
            const res = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{}] })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/exactly one of barcode or unitUuid/);
        });

        it('should reject a rental item with both barcode and unitUuid (SEC-H-6)', async () => {
            const u4 = await scanUnit('RA0000000004');
            const res = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: u4.uuid, barcode: u4.barcode }] })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/exactly one of barcode or unitUuid/);
        });

        it('should allow a rental item resolved by barcode only (SEC-H-6 positive control)', async () => {
            const u5 = await scanUnit('RA0000000005');
            const res = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ barcode: u5.barcode }] })
                .expect(201);

            expect(res.body.data.lines).toHaveLength(1);
            expect(res.body.data.lines[0].barcode).toBe(u5.barcode);
        });

        it('should reject at the service layer when a rental item has no identifier (SEC-H-6)', async () => {
            await expect(createRental({ items: [{}], actorUserId: managerUserId })).rejects.toMatchObject({
                statusCode: 400,
                message: expect.stringMatching(/exactly one of barcode or unitUuid/),
            });
        });

        it('should reject a paymentMethod outside the active picklist (SEC-M-8)', async () => {
            const u6 = await scanUnit('RA0000000006');
            const res = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: u6.uuid }], paymentMethod: 'UPI' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/not in the payment methods picklist/);
        });

        it('should reject a customerSource outside the active picklist (SEC-M-8)', async () => {
            const u7 = await scanUnit('RA0000000007');
            const res = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: u7.uuid }], customerSource: 'Print ad' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/not in the customer sources picklist/);
        });

        it('should allow checkout without paymentMethod/customerSource (SEC-M-8)', async () => {
            const u8 = await scanUnit('RA0000000008');
            const res = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: u8.uuid }] })
                .expect(201);

            expect(res.body.data.paymentMethod).toBe(null);
            expect(res.body.data.customerSource).toBe(null);
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
                    requestUuid: uuidv4(),
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
                    requestUuid: uuidv4(),
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
                .send({ requestUuid: uuidv4(), items: [{ barcode: 'RA0000000001' }] })
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
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: a1.uuid }, { unitUuid: a2.uuid }] })
                .expect(201);

            const cancelRes = await request(testApp)
                .post(`/api/rentals/${createRes.body.data.uuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), reason: 'Customer cancelled' })
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
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: a3.uuid }] })
                .expect(201);
            await request(testApp)
                .post(`/api/rentals/${createRes.body.data.uuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), reason: 'cancel' })
                .expect(200);
            await request(testApp)
                .post(`/api/rentals/${createRes.body.data.uuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), reason: 'again' })
                .expect(409);
        });
    });

    describe('Money-out race fixes (R-29)', () => {
        it('should double-cancel only once: concurrent cancels yield one success and one 409', async () => {
            const u = await scanUnit('RACERCNL01');
            const agreement = await createRental({
                items: [{ unitUuid: u.uuid }],
                actorUserId: managerUserId,
            });

            const attempt = async () => cancelRental({ uuid: agreement.uuid, reason: 'race', actorUserId: managerUserId });

            const results = await Promise.allSettled([attempt(), attempt()]);
            const ok = results.filter((r) => r.status === 'fulfilled');
            const rejected = results.filter((r) => r.status === 'rejected');

            expect(ok).toHaveLength(1);
            expect(rejected).toHaveLength(1);
            expect(rejected[0].reason.statusCode).toBe(409);
            expect(rejected[0].reason.message).toMatch(/already/);

            const agreementRow = await db.RentalAgreement.findOne({ where: { uuid: agreement.uuid } });
            const reversals = await db.RentalReversal.count({
                where: { agreementId: agreementRow.id, reversalType: 'CANCEL', deletedAt: null },
            });
            expect(reversals).toBe(1);
        });

        it('should not double-return the same line: concurrent returns yield one success and one 409', async () => {
            const u = await scanUnit('RACERTN01');
            const agreement = await createRental({
                items: [{ unitUuid: u.uuid }],
                actorUserId: managerUserId,
            });
            const line = agreement.lines[0];

            const attempt = async () => processRentalReturn({
                uuid: agreement.uuid,
                actualReturnDate: '2026-09-10',
                items: [{ unitUuid: u.uuid }],
                actorUserId: managerUserId,
            });

            const results = await Promise.allSettled([attempt(), attempt()]);
            const ok = results.filter((r) => r.status === 'fulfilled');
            const rejected = results.filter((r) => r.status === 'rejected');

            expect(ok).toHaveLength(1);
            expect(rejected).toHaveLength(1);
            expect(rejected[0].reason.statusCode).toBe(409);
            expect(rejected[0].reason.message).toMatch(/already.*returned/);

            // Exactly one rental_returns row per line (deposit refunded only once)
            const lineRow = await db.RentalLine.findOne({ where: { unitUuid: line.unitUuid } });
            const returnRows = await db.RentalReturn.findAll({
                where: { rentalLineId: lineRow.id, deletedAt: null },
            });
            expect(returnRows).toHaveLength(1);
        });

        it('should produce unique agreement numbers under concurrent checkout', async () => {
            const u1 = await scanUnit('RACENUMR01');
            const u2 = await scanUnit('RACENUMR02');

            const results = await Promise.allSettled([
                createRental({ items: [{ unitUuid: u1.uuid }], actorUserId: managerUserId }),
                createRental({ items: [{ unitUuid: u2.uuid }], actorUserId: managerUserId }),
            ]);

            const agreements = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
            expect(agreements[0]).not.toBeNull();
            expect(agreements[1]).not.toBeNull();
            const numbers = agreements.map((a) => a.agreementNumber);
            expect(numbers[0]).not.toBe(numbers[1]);
            expect(new Set(numbers).size).toBe(numbers.length);
        });
    });

    describe('SEC-M-5 - read scoping for rentals', () => {
        let limitedToken;

        beforeAll(async () => {
            // A non-broad user with rentals.view + rentals.create only.
            const role = await db.Role.create({
                name: generateTestRole().name,
                description: 'Rental limited-read role (test)',
            });
            for (const name of ['rentals.view', 'rentals.create']) {
                const perm = await db.Permission.findOrCreate({
                    where: { name },
                    defaults: { description: `Rental ${name} permission (test)` },
                });
                await role.addPermission(perm[0]);
            }

            const data = generateTestUser({ password: 'TestPassword123!' });
            const user = await db.User.create({
                username: data.username,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                passwordHash: await argon2.hash(data.password),
            });
            await user.addRole(role);
            const login = await request(app)
                .post('/api/auth/login')
                .send({ username: data.username, password: data.password });
            limitedToken = login.body.data.accessToken;
        });

        it('should let a non-broad user see only their own agreements', async () => {
            const mgrUuid = global.__agreementUuid;
            const u = await scanUnit('RA0000000990');

            const own = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${limitedToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: u.uuid }] })
                .expect(201);
            const ownUuid = own.body.data.uuid;

            const ownGet = await request(testApp)
                .get(`/api/rentals/${ownUuid}`)
                .set('Authorization', `Bearer ${limitedToken}`)
                .expect(200);
            expect(ownGet.body.data.uuid).toBe(ownUuid);

            await request(testApp)
                .get(`/api/rentals/${mgrUuid}`)
                .set('Authorization', `Bearer ${limitedToken}`)
                .expect(404);

            const list = await request(testApp)
                .get('/api/rentals')
                .set('Authorization', `Bearer ${limitedToken}`)
                .expect(200);
            const uuids = list.body.data.map((a) => a.uuid);
            expect(uuids).toContain(ownUuid);
            expect(uuids).not.toContain(mgrUuid);
        });

        it('should let a manager (broad read scope) see agreements created by others', async () => {
            const list = await request(testApp)
                .get('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);
            const uuids = list.body.data.map((a) => a.uuid);
            expect(uuids).toContain(global.__agreementUuid);
        });
    });

    describe('SEC-M-3 - request-key idempotency for rentals', () => {
        it('should replay a repeated checkout with the cached agreement instead of another agreement', async () => {
            const u = await scanUnit('RA0000000991');
            const requestUuid = uuidv4();

            const first = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, items: [{ unitUuid: u.uuid }] })
                .expect(201);
            const agreementUuid = first.body.data.uuid;

            const replay = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, items: [{ unitUuid: u.uuid }] })
                .expect(200);

            expect(replay.body.data.uuid).toBe(agreementUuid);
            expect(replay.body.message).toContain('Rental agreement already processed (request replayed)');

            const count = await db.RentalAgreement.count({ where: { uuid: agreementUuid } });
            expect(count).toBe(1);
        });

        it('should replay a repeated return and keep a single returned line', async () => {
            const u = await scanUnit('RA0000000992');
            const created = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: u.uuid }] })
                .expect(201);
            const agreementUuid = created.body.data.uuid;

            const requestUuid = uuidv4();
            await request(testApp)
                .post(`/api/rentals/${agreementUuid}/return`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, actualReturnDate: '2026-09-10', items: [{ barcode: 'RA0000000992' }] })
                .expect(200);

            const replay = await request(testApp)
                .post(`/api/rentals/${agreementUuid}/return`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, actualReturnDate: '2026-09-10', items: [{ barcode: 'RA0000000992' }] })
                .expect(200);

            expect(replay.body.data.status).toBe('completed');
            expect(replay.body.message).toContain('Rental agreement already processed (request replayed)');

            const lineRow = await db.RentalLine.findOne({ where: { unitUuid: u.uuid } });
            const returns = await db.RentalReturn.count({ where: { rentalLineId: lineRow.id, deletedAt: null } });
            expect(returns).toBe(1);
        });

        it('should replay a repeated cancel and keep a single cancellation', async () => {
            const u = await scanUnit('RA0000000993');
            const created = await request(testApp)
                .post('/api/rentals')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: u.uuid }] })
                .expect(201);
            const agreementUuid = created.body.data.uuid;

            const requestUuid = uuidv4();
            await request(testApp)
                .post(`/api/rentals/${agreementUuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, reason: 'first cancel' })
                .expect(200);

            const replay = await request(testApp)
                .post(`/api/rentals/${agreementUuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, reason: 'first cancel' })
                .expect(200);

            expect(replay.body.data.status).toBe('cancelled');
            expect(replay.body.message).toContain('Rental agreement already processed (request replayed)');

            const agreementRow = await db.RentalAgreement.findOne({ where: { uuid: agreementUuid } });
            const reversals = await db.RentalReversal.count({
                where: { agreementId: agreementRow.id, reversalType: 'CANCEL', deletedAt: null },
            });
            expect(reversals).toBe(1);
        });
    });
});
