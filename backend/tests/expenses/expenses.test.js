import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import expenseRoutes from '../../src/modules/expenses/expenses.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';
import { createExpense, cancelExpense } from '../../src/modules/expenses/expenses.service.js';

/*
 * T-12 expense routes are intentionally NOT mounted in app.js (another owner
 * integrates them). Mount the router on a local test app that shares the same
 * DB/jwt auth as the real app. expenses.* permissions already exist and are
 * granted to MANAGER.
 */
const testApp = express();
testApp.use(express.json());
testApp.use('/api/expenses', expenseRoutes);
testApp.use(errorMiddleware);

describe('Expenses module (T-12)', () => {
    let managerToken;
    let managerUserId;
    let cashierToken;

    beforeAll(async () => {
        await initializeTestDatabase();

        const mgrData = generateTestUser({ password: 'TestPassword123!' });
        const manager = await db.User.create({
            username: mgrData.username,
            firstName: mgrData.firstName,
            lastName: mgrData.lastName,
            email: mgrData.email,
            passwordHash: await argon2.hash(mgrData.password),
        });
        const managerRole = await db.Role.findOne({ where: { name: 'MANAGER' } });
        await manager.addRole(managerRole);
        managerUserId = manager.id;
        const mgrLogin = await request(app)
            .post('/api/auth/login')
            .send({ username: mgrData.username, password: mgrData.password });
        managerToken = mgrLogin.body.data.accessToken;

        // CASHIER has no expenses permissions
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
    });

    afterAll(async () => {
        await db.User.destroy({
            where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } },
        });
        await closeDatabase();
    });

    describe('POST /api/expenses - create', () => {
        it('should create a completed expense with paise as string', async () => {
            const res = await request(testApp)
                .post('/api/expenses')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), amountPaise: 250000, category: 'Utilities', purpose: 'Electricity bill' })
                .expect(201);

            expect(res.body.success).toBe(true);
            const expense = res.body.data;
            expect(expense.amountPaise).toBe('250000');
            expect(expense.category).toBe('Utilities');
            expect(expense.status).toBe('completed');

            global.__expenseUuid = expense.uuid;
        });

        it('should forbid a cashier from creating an expense (no expenses.create)', async () => {
            await request(testApp)
                .post('/api/expenses')
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({ amountPaise: 100, category: 'Misc' })
                .expect(403);
        });
    });

    describe('GET /api/expenses', () => {
        it('should list expenses', async () => {
            const res = await request(testApp)
                .get('/api/expenses')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GET /api/expenses/:uuid', () => {
        it('should get a single expense', async () => {
            const res = await request(testApp)
                .get(`/api/expenses/${global.__expenseUuid}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);
            expect(res.body.data.uuid).toBe(global.__expenseUuid);
        });
    });

    describe('PATCH /api/expenses/:uuid - update', () => {
        it('should allow updating non-financial fields of a completed expense', async () => {
            const res = await request(testApp)
                .patch(`/api/expenses/${global.__expenseUuid}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ notes: 'Updated note' })
                .expect(200);
            expect(res.body.data.notes).toBe('Updated note');
            expect(res.body.data.amountPaise).toBe('250000');
        });

        it('should reject updating the amount of a completed expense', async () => {
            await request(testApp)
                .patch(`/api/expenses/${global.__expenseUuid}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ amountPaise: 999999 })
                .expect(409);
        });
    });

    describe('POST /api/expenses/:uuid/cancel', () => {
        it('should record a reversal and mark the expense cancelled without mutating the amount', async () => {
            const res = await request(testApp)
                .post(`/api/expenses/${global.__expenseUuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), reason: 'Vendor refunded us' })
                .expect(200);

            expect(res.body.data.status).toBe('cancelled');
            expect(res.body.data.amountPaise).toBe('250000');
            expect(res.body.data.reversals).toHaveLength(1);
            expect(res.body.data.reversals[0].reversalType).toBe('CANCEL');
            expect(res.body.data.reversals[0].amountPaise).toBe('250000');
        });

        it('should reject cancelling an already-cancelled expense', async () => {
            await request(testApp)
                .post(`/api/expenses/${global.__expenseUuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), reason: 'again' })
                .expect(409);
        });
    });

    describe('Money-out race fix: cancel expense (R-29)', () => {
        it('should double-cancel only once: concurrent cancels yield one success and one 409', async () => {
            const expense = await createExpense({
                amountPaise: 12345,
                category: 'RaceTest',
                purpose: 'concurrency',
                actorUserId: managerUserId,
            });
            const expenseRow = await db.Expense.findOne({ where: { uuid: expense.uuid } });

            const attempt = async () => cancelExpense({ uuid: expense.uuid, reason: 'race', actorUserId: managerUserId });

            const results = await Promise.allSettled([attempt(), attempt()]);
            const ok = results.filter((r) => r.status === 'fulfilled');
            const rejected = results.filter((r) => r.status === 'rejected');

            expect(ok).toHaveLength(1);
            expect(rejected).toHaveLength(1);
            expect(rejected[0].reason.statusCode).toBe(409);
            expect(rejected[0].reason.message).toMatch(/already/);

            const reversals = await db.ExpenseReversal.count({
                where: { expenseId: expenseRow.id, reversalType: 'CANCEL', deletedAt: null },
            });
            expect(reversals).toBe(1);
        });
    });

    describe('SEC-M-5 - read scoping for expenses', () => {
        let accountantToken;
        let accountantExpenseUuid;

        beforeAll(async () => {
            // ACCOUNTANT has expenses.view + expenses.create (test-setup seed)
            const acctData = generateTestUser({ password: 'TestPassword123!' });
            const accountant = await db.User.create({
                username: acctData.username,
                firstName: acctData.firstName,
                lastName: acctData.lastName,
                email: acctData.email,
                passwordHash: await argon2.hash(acctData.password),
            });
            const acctRole = await db.Role.findOne({ where: { name: 'ACCOUNTANT' } });
            await accountant.addRole(acctRole);
            const acctLogin = await request(app)
                .post('/api/auth/login')
                .send({ username: acctData.username, password: acctData.password });
            accountantToken = acctLogin.body.data.accessToken;

            const own = await request(testApp)
                .post('/api/expenses')
                .set('Authorization', `Bearer ${accountantToken}`)
                .send({ requestUuid: uuidv4(), amountPaise: 111, category: 'OwnBooks' })
                .expect(201);
            accountantExpenseUuid = own.body.data.uuid;
        });

        it('should let a non-broad user see only their own expenses', async () => {
            const mgrUuid = global.__expenseUuid;

            const ownGet = await request(testApp)
                .get(`/api/expenses/${accountantExpenseUuid}`)
                .set('Authorization', `Bearer ${accountantToken}`)
                .expect(200);
            expect(ownGet.body.data.uuid).toBe(accountantExpenseUuid);

            await request(testApp)
                .get(`/api/expenses/${mgrUuid}`)
                .set('Authorization', `Bearer ${accountantToken}`)
                .expect(404);

            const list = await request(testApp)
                .get('/api/expenses')
                .set('Authorization', `Bearer ${accountantToken}`)
                .expect(200);
            const uuids = list.body.data.map((e) => e.uuid);
            expect(uuids).toContain(accountantExpenseUuid);
            expect(uuids).not.toContain(mgrUuid);
        });

        it('should let a manager (broad read scope) see expenses created by others', async () => {
            const list = await request(testApp)
                .get('/api/expenses')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);
            const uuids = list.body.data.map((e) => e.uuid);
            expect(uuids).toContain(global.__expenseUuid);
            expect(uuids).toContain(accountantExpenseUuid);
        });
    });

    describe('SEC-M-3 - request-key idempotency for expenses', () => {
        it('should replay a repeated create with the cached expense instead of creating another', async () => {
            const requestUuid = uuidv4();

            const first = await request(testApp)
                .post('/api/expenses')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, amountPaise: 500000, category: 'IdemTest' })
                .expect(201);
            const expenseUuid = first.body.data.uuid;

            const replay = await request(testApp)
                .post('/api/expenses')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, amountPaise: 500000, category: 'IdemTest' })
                .expect(200);

            expect(replay.body.data.uuid).toBe(expenseUuid);
            expect(replay.body.message).toContain('Expense already processed (request replayed)');

            const count = await db.Expense.count({ where: { uuid: expenseUuid } });
            expect(count).toBe(1);
        });

        it('should replay a repeated cancel and keep a single reversal', async () => {
            const created = await request(testApp)
                .post('/api/expenses')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), amountPaise: 222, category: 'IdemCancel' })
                .expect(201);
            const expenseUuid = created.body.data.uuid;

            const requestUuid = uuidv4();
            await request(testApp)
                .post(`/api/expenses/${expenseUuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, reason: 'first cancel' })
                .expect(200);

            const replay = await request(testApp)
                .post(`/api/expenses/${expenseUuid}/cancel`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid, reason: 'first cancel' })
                .expect(200);

            expect(replay.body.data.status).toBe('cancelled');
            expect(replay.body.message).toContain('Expense already processed (request replayed)');

            const expenseRow = await db.Expense.findOne({ where: { uuid: expenseUuid } });
            const reversals = await db.ExpenseReversal.count({
                where: { expenseId: expenseRow.id, reversalType: 'CANCEL', deletedAt: null },
            });
            expect(reversals).toBe(1);
        });

        it('should resolve concurrent creates sharing a requestUuid to one persisted expense', async () => {
            const requestUuid = uuidv4();
            const send = () =>
                request(testApp)
                    .post('/api/expenses')
                    .set('Authorization', `Bearer ${managerToken}`)
                    .send({ requestUuid, amountPaise: 333, category: 'IdemRace' });

            const results = await Promise.allSettled([send(), send()]);
            const fulfilled = results.filter((r) => r.status === 'fulfilled');
            expect(fulfilled).toHaveLength(2);

            const statuses = fulfilled.map((r) => r.value.status).sort();
            expect(statuses).toEqual([200, 201]);

            const uuids = fulfilled.map((r) => r.value.body.data.uuid);
            expect(new Set(uuids).size).toBe(1);

            const count = await db.Expense.count({ where: { uuid: uuids[0] } });
            expect(count).toBe(1);
        });
    });
});
