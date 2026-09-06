import express from 'express';
import request from 'supertest';
import * as db from '../../database/models/index.js';
import {
    initializeTestDatabase,
    generateTestUser,
    generateTestCustomer,
    closeDatabase,
} from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import customersRoutes from '../../src/modules/customers/customers.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';

const testApp = express();
testApp.use(express.json());
testApp.use('/api/customers', customersRoutes);
testApp.use(errorMiddleware);

describe('Customers module - /api/customers', () => {
    let adminToken;
    let adminUser;

    beforeAll(async () => {
        await initializeTestDatabase();

        const adminData = generateTestUser({ password: 'Admin123!' });
        adminUser = await db.User.create({
            username: adminData.username,
            email: adminData.email,
            firstName: adminData.firstName,
            passwordHash: await argon2.hash(adminData.password),
        });
        const adminRole = await db.Role.findOne({ where: { name: 'ADMIN' } });
        await adminUser.addRole(adminRole);

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: adminData.username, password: adminData.password });
        adminToken = loginRes.body.data.accessToken;
    });

    afterEach(async () => {
        await db.Customer.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_Customer_%' } } });
    });

    afterAll(async () => {
        await closeDatabase();
    });

    describe('POST /customers', () => {
        it('should create a customer when authenticated', async () => {
            const res = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(generateTestCustomer());

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.customer).toHaveProperty('uuid');
            expect(res.body.data.customer.name).toMatch(/^TEST_Customer_/);
            expect(res.body.data.customer.consentWhatsapp).toBe(false);
        });

        it('should return 401 without authentication', async () => {
            const res = await request(testApp)
                .post('/api/customers')
                .send(generateTestCustomer());

            expect(res.statusCode).toBe(401);
        });

        it('should reject a customer without a name', async () => {
            const res = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ phone: '+919900000000' });

            expect(res.statusCode).toBe(400);
        });

        it('should record consent_timestamp when a consent flag is set', async () => {
            const res = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(generateTestCustomer({ consentWhatsapp: true }));

            expect(res.statusCode).toBe(201);
            expect(res.body.data.customer.consentWhatsapp).toBe(true);
            expect(res.body.data.customer.consentRecordedAt).toBeTruthy();
        });
    });

    describe('GET /customers', () => {
        it('should list customers when authenticated', async () => {
            const res = await request(testApp)
                .get('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data.customers)).toBe(true);
        });

        it('should search customers by exact phone', async () => {
            const created = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(generateTestCustomer({ phone: '+911199999999', name: 'TEST_Customer_Alpha' }));
            expect(created.statusCode).toBe(201);

            const res = await request(testApp)
                .get('/api/customers?search=911199999999')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            const names = res.body.data.customers.map((c) => c.name);
            expect(names).toContain('TEST_Customer_Alpha');
        });

        it('should search customers by name partial', async () => {
            const created = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(generateTestCustomer({ name: 'TEST_Customer_Alpha' }));

            const res = await request(testApp)
                .get('/api/customers?search=Alpha')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            const names = res.body.data.customers.map((c) => c.name);
            expect(names).toContain('TEST_Customer_Alpha');
        });

        it('should search customers by email', async () => {
            const created = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(generateTestCustomer({ email: 'TEST_alpha@example.com' }));

            const res = await request(testApp)
                .get('/api/customers?search=alpha@example')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            const emails = res.body.data.customers.map((c) => c.email);
            expect(emails).toContain('TEST_alpha@example.com');
        });
    });

    describe('GET /customers/:uuid', () => {
        it('should return a customer by uuid', async () => {
            const created = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(generateTestCustomer());

            const { uuid } = created.body.data.customer;
            const res = await request(testApp)
                .get(`/api/customers/${uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.customer.uuid).toBe(uuid);
            await db.Customer.destroy({ where: { uuid } });
        });

        it('should return 404 for a missing customer', async () => {
            const res = await request(testApp)
                .get('/api/customers/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(404);
        });
    });

    describe('PATCH /customers/:uuid', () => {
        it('should update a customer', async () => {
            const created = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(generateTestCustomer());

            const { uuid } = created.body.data.customer;
            const res = await request(testApp)
                .patch(`/api/customers/${uuid}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ notes: 'Updated notes' });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.customer.notes).toBe('Updated notes');
            await db.Customer.destroy({ where: { uuid } });
        });
    });

    describe('PATCH /customers/:uuid/consent', () => {
        it('should update a single consent channel', async () => {
            const created = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(generateTestCustomer());

            const { uuid } = created.body.data.customer;
            const res = await request(testApp)
                .patch(`/api/customers/${uuid}/consent`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ channel: 'WHATSAPP', consented: true });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.customer.consentWhatsapp).toBe(true);

            const offRes = await request(testApp)
                .patch(`/api/customers/${uuid}/consent`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ channel: 'WHATSAPP', consented: false });

            expect(offRes.statusCode).toBe(200);
            expect(offRes.body.data.customer.consentWhatsapp).toBe(false);
            await db.Customer.destroy({ where: { uuid } });
        });

        it('should reject an unknown consent channel', async () => {
            const created = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(generateTestCustomer());

            const { uuid } = created.body.data.customer;
            const res = await request(testApp)
                .patch(`/api/customers/${uuid}/consent`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ channel: 'PIGEON', consented: true });

            expect(res.statusCode).toBe(400);
            await db.Customer.destroy({ where: { uuid } });
        });
    });

    describe('DELETE /customers/:uuid', () => {
        it('should soft delete a customer', async () => {
            const created = await request(testApp)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(generateTestCustomer());

            const { uuid } = created.body.data.customer;
            const res = await request(testApp)
                .delete(`/api/customers/${uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.deleted).toBe(true);

            const fetchRes = await request(testApp)
                .get(`/api/customers/${uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(fetchRes.statusCode).toBe(404);
        });
    });
});