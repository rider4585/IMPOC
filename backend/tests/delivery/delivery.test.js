import express from 'express';
import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import deliveryRoutes from '../../src/modules/delivery/delivery.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';

const testApp = express();
testApp.use(express.json());
testApp.use('/api/delivery', deliveryRoutes);
testApp.use(errorMiddleware);

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
    });

    afterEach(async () => {
        if (createdLogIds.length) {
            await db.DeliveryLog.destroy({ where: { id: { [db.Sequelize.Op.in]: createdLogIds } } });
            createdLogIds = [];
        }
    });

    afterAll(async () => {
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