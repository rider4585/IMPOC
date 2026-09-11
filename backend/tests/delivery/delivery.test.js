import express from 'express';
import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import deliveryRoutes from '../../src/modules/delivery/delivery.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';

const testApp = express();
// Match app.js (limit: '15mb') so the SEC-M-6 size-cap test exercises the
// receiptPayload schema cap, not body-parser's default 100kb limit.
testApp.use(express.json({ limit: '15mb' }));
testApp.use('/api/delivery', deliveryRoutes);
testApp.use(errorMiddleware);

function buildValidReceiptPayload() {
    return {
        store: { name: 'Shree Fashion Store', address: 'Main Bazaar', phone: '9876543210' },
        transaction: {
            type: 'SALE',
            number: 'S-0001',
            date: '2026-09-01',
            paymentMethod: 'Cash',
            totalPaise: '1000',
            paidPaise: '1000',
            changePaise: '0',
            status: 'completed',
        },
        customer: { name: 'Priya', phone: '9876543210', email: null },
        lines: [{
            productName: 'Sari',
            productType: 'Garment',
            colour: 'Red',
            size: 'L',
            quantity: 1,
            unitPricePaise: '1000',
            lineTotalPaise: '1000',
        }],
        totals: {
            subtotalPaise: '1000',
            discountPaise: '0',
            totalPaise: '1000',
            amountPaidPaise: '1000',
            balancePaise: '0',
            itemsCount: 1,
        },
    };
}

// 200 max-length lines pass the shape bounds but blow the serialized size cap.
function buildOversizedReceiptPayload() {
    const long = (n) => 'x'.repeat(n);
    const payload = buildValidReceiptPayload();
    payload.lines = Array.from({ length: 200 }, () => ({
        productName: long(255),
        productType: long(255),
        colour: long(255),
        size: long(255),
        quantity: 1,
        unitPricePaise: '1'.repeat(40),
        lineTotalPaise: '1'.repeat(40),
    }));
    return payload;
}

describe('Delivery logs module - /api/delivery/logs', () => {
    let managerToken;
    const saleUuid = '123e4567-e89b-12d3-a456-426614174000';
    const saleUuid2 = '123e4567-e89b-12d3-a456-426614174001';
    const rentalUuid = '123e4567-e89b-12d3-a456-426614174002';
    const quoteUuid = '123e4567-e89b-12d3-a456-426614174003';
    const missingUuid = '123e4567-e89b-12d3-a456-426614174999';
    let createdLogIds = [];

    async function createLog(payload) {
        const res = await request(testApp)
            .post('/api/delivery/logs')
            .set('Authorization', `Bearer ${managerToken}`)
            .send(payload);
        if (res.body.data && res.body.data.log) {
            createdLogIds.push(res.body.data.log.id);
        }
        return res;
    }

    beforeAll(async () => {
        await initializeTestDatabase();

        // MANAGER receives delivery.view + delivery.create from test-setup's
        // role seeding. Using the real app for login keeps the auth/JWT chain
        // identical to production.
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

        // SALE/RENTAL delivery logs must reference real records (SEC-M-6),
        // so create the fixtures the tests point at before running.
        await db.Sale.create({
            uuid: saleUuid,
            saleNumber: 'S-DELIV1',
            soldAt: '2026-09-01',
            totalPaise: 100000,
            status: 'completed',
        });
        await db.Sale.create({
            uuid: saleUuid2,
            saleNumber: 'S-DELIV2',
            soldAt: '2026-09-02',
            totalPaise: 200000,
            status: 'completed',
        });
        await db.RentalAgreement.create({
            uuid: rentalUuid,
            agreementNumber: 'R-DELIV1',
            startDate: '2026-09-01',
            dueDate: '2026-09-04',
            depositRefundablePaise: 5000,
            status: 'active',
        });
    });

    afterEach(async () => {
        if (createdLogIds.length) {
            await db.DeliveryLog.destroy({ where: { id: { [db.Sequelize.Op.in]: createdLogIds } } });
            createdLogIds = [];
        }
    });

    afterAll(async () => {
        await db.RentalAgreement.destroy({ where: { uuid: rentalUuid }, force: true });
        await db.Sale.destroy({ where: { uuid: { [db.Sequelize.Op.in]: [saleUuid, saleUuid2] } }, force: true });
        await closeDatabase();
    });

    describe('POST /api/delivery/logs', () => {
        it('should return 401 without authentication', async () => {
            const res = await request(testApp)
                .post('/api/delivery/logs')
                .send({
                    entityType: 'SALE',
                    entityUuid: saleUuid,
                    channel: 'WHATSAPP',
                });
            expect(res.statusCode).toBe(401);
        });

        it('should create a delivery log when authenticated', async () => {
            const res = await createLog({
                entityType: 'SALE',
                entityUuid: saleUuid,
                channel: 'WHATSAPP',
                status: 'SENT',
                notes: 'First attempt',
            });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.log).toHaveProperty('uuid');
            expect(res.body.data.log.entityType).toBe('SALE');
            expect(res.body.data.log.channel).toBe('WHATSAPP');
            expect(res.body.data.log.status).toBe('SENT');
        });

        it('should default status to PENDING', async () => {
            const res = await createLog({
                entityType: 'RENTAL',
                entityUuid: rentalUuid,
                channel: 'EMAIL',
            });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.log.status).toBe('PENDING');
        });

        it('should reject an invalid channel', async () => {
            const res = await request(testApp)
                .post('/api/delivery/logs')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    entityType: 'SALE',
                    entityUuid: saleUuid,
                    channel: 'PIGEON',
                });
            expect(res.statusCode).toBe(400);
        });

        it('should reject an invalid entityType', async () => {
            const res = await request(testApp)
                .post('/api/delivery/logs')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    entityType: 'INVOICE',
                    entityUuid: saleUuid,
                    channel: 'WHATSAPP',
                });
            expect(res.statusCode).toBe(400);
        });

        it('should reject a delivery log referencing an unknown entity (SEC-M-6)', async () => {
            const res = await request(testApp)
                .post('/api/delivery/logs')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    entityType: 'SALE',
                    entityUuid: missingUuid,
                    channel: 'WHATSAPP',
                });
            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/unknown SALE entity/);
        });

        it('should reject a delivery log referencing an unknown rental entity (SEC-M-6)', async () => {
            const res = await request(testApp)
                .post('/api/delivery/logs')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    entityType: 'RENTAL',
                    entityUuid: missingUuid,
                    channel: 'EMAIL',
                });
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/unknown RENTAL entity/);
        });

        it('should accept a delivery log with a valid receiptPayload (SEC-M-6 positive)', async () => {
            const res = await createLog({
                entityType: 'SALE',
                entityUuid: saleUuid2,
                channel: 'WHATSAPP',
                status: 'DELIVERED',
                receiptPayload: buildValidReceiptPayload(),
            });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.log.receiptPayload).toBeTruthy();
            expect(res.body.data.log.receiptPayload.totals.totalPaise).toBe('1000');
        });

        it('should reject a receiptPayload with the wrong shape (SEC-M-6)', async () => {
            const res = await request(testApp)
                .post('/api/delivery/logs')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    entityType: 'SALE',
                    entityUuid: saleUuid,
                    channel: 'WHATSAPP',
                    receiptPayload: { store: { name: 123 }, transaction: {}, totals: {}, lines: 'nope' },
                });
            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should reject an arbitrarily structured receiptPayload blob (SEC-M-6)', async () => {
            const res = await request(testApp)
                .post('/api/delivery/logs')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    entityType: 'SALE',
                    entityUuid: saleUuid,
                    channel: 'WHATSAPP',
                    receiptPayload: { anything: 'goes', nested: { arbitrary: [1, 2, 3] } },
                });
            expect(res.statusCode).toBe(400);
        });

        it('should reject an oversized receiptPayload (SEC-M-6 size cap)', async () => {
            const res = await request(testApp)
                .post('/api/delivery/logs')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    entityType: 'SALE',
                    entityUuid: saleUuid,
                    channel: 'WHATSAPP',
                    receiptPayload: buildOversizedReceiptPayload(),
                });
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/size cap/);
        });
    });

    describe('GET /api/delivery/logs', () => {
        beforeAll(async () => {
            await createLog({ entityType: 'SALE', entityUuid: saleUuid, channel: 'WHATSAPP', status: 'SENT' });
            await createLog({ entityType: 'SALE', entityUuid: saleUuid2, channel: 'SMS', status: 'FAILED' });
            await createLog({ entityType: 'RENTAL', entityUuid: rentalUuid, channel: 'EMAIL', status: 'DELIVERED' });
        });

        it('should list all logs when authenticated', async () => {
            const res = await request(testApp)
                .get('/api/delivery/logs')
                .set('Authorization', `Bearer ${managerToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data.logs)).toBe(true);
        });

        it('should filter logs by entityType', async () => {
            const res = await request(testApp)
                .get('/api/delivery/logs?entityType=SALE')
                .set('Authorization', `Bearer ${managerToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.logs.every((l) => l.entityType === 'SALE')).toBe(true);
        });

        it('should filter logs by entityUuid', async () => {
            const res = await request(testApp)
                .get(`/api/delivery/logs?entityUuid=${saleUuid}`)
                .set('Authorization', `Bearer ${managerToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.logs.every((l) => l.entityUuid === saleUuid)).toBe(true);
        });

        it('should return 401 without authentication', async () => {
            const res = await request(testApp).get('/api/delivery/logs');
            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET /api/delivery/logs/:uuid', () => {
        it('should return a delivery log by uuid', async () => {
            const created = await createLog({
                entityType: 'QUOTE',
                entityUuid: quoteUuid,
                channel: 'WHATSAPP_GROUP',
            });
            const { uuid } = created.body.data.log;

            const res = await request(testApp)
                .get(`/api/delivery/logs/${uuid}`)
                .set('Authorization', `Bearer ${managerToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.log.uuid).toBe(uuid);
            expect(res.body.data.log.entityType).toBe('QUOTE');
        });

        it('should return 404 for a missing log', async () => {
            const res = await request(testApp)
                .get(`/api/delivery/logs/${missingUuid}`)
                .set('Authorization', `Bearer ${managerToken}`);
            expect(res.statusCode).toBe(404);
        });

        it('should return 400 for a malformed uuid', async () => {
            const res = await request(testApp)
                .get('/api/delivery/logs/not-a-uuid')
                .set('Authorization', `Bearer ${managerToken}`);
            expect(res.statusCode).toBe(400);
        });
    });
});