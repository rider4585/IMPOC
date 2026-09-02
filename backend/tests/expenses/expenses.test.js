import express from 'express';
import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import expenseRoutes from '../../src/modules/expenses/expenses.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';

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
                .send({ amountPaise: 250000, category: 'Utilities', purpose: 'Electricity bill' })
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
                .send({ reason: 'Vendor refunded us' })
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
                .send({ reason: 'again' })
                .expect(409);
        });
    });
});
