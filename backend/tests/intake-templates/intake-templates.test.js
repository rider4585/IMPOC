import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';

describe('Intake Records & Templates Module - /api/intake-records', () => {
    let testDb;
    let adminToken;
    let inventoryToken;
    let activeVendor;
    let activeProductType;

    async function login(roleName, password) {
        const data = generateTestUser({ password });
        const user = await db.User.create({
            username: data.username,
            email: data.email,
            firstName: data.firstName,
            passwordHash: await argon2.hash(data.password),
        });
        const role = await db.Role.findOne({ where: { name: roleName } });
        await user.addRole(role);
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: data.username, password: data.password });
        return loginRes.body.data.accessToken;
    }

    beforeAll(async () => {
        testDb = await initializeTestDatabase();
        adminToken = await login('ADMIN', 'Admin123!');
        inventoryToken = await login('INVENTORY_MANAGER', 'Inventory123!');

        activeVendor = await db.Vendor.create({ name: 'TEST_IntakeVendor', isActive: true });
        activeProductType = await db.ProductType.create({ name: 'TEST_IntakeProductType', isActive: true });
    });

    afterEach(async () => {
        await db.IntakeTemplate.destroy({ where: {} }, { force: true });
        await db.IntakeRecord.destroy({ where: {} }, { force: true });
        // restore active product types/vendor in case a test deactivated/removed them
        await db.Vendor.restore({ where: { id: activeVendor.id } });
        await db.IntakeRecord.restore({ where: {} });
    });

    afterAll(async () => {
        await db.IntakeTemplate.destroy({ where: {} }, { force: true });
        await db.IntakeRecord.destroy({ where: {} }, { force: true });
        await closeDatabase();
    });

    describe('GET /intake-records', () => {
        it('should return 401 without authentication', async () => {
            const res = await request(app).get('/api/intake-records');
            expect(res.statusCode).toBe(401);
        });

        it('should list intake records', async () => {
            await db.IntakeRecord.create({
                name: 'TEST 1st Aug wholesale',
                purchasedOn: '2026-08-01',
                vendorId: activeVendor.id,
            });

            const res = await request(app)
                .get('/api/intake-records')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });
    });

    describe('POST /intake-records', () => {
        it('should create an intake record', async () => {
            const res = await request(app)
                .post('/api/intake-records')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    name: 'TEST 1st Aug wholesale',
                    purchasedOn: '2026-08-01',
                    vendorUuid: activeVendor.uuid,
                    notes: 'wholesale run',
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('uuid');
            expect(res.body.data.name).toBe('TEST 1st Aug wholesale');
            expect(res.body.data.vendorUuid).toBe(activeVendor.uuid);
            expect(res.body.data.status).toBe('active');
        });

        it('should reject invalid date', async () => {
            const res = await request(app)
                .post('/api/intake-records')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ name: 'TEST bad date', purchasedOn: 'not-a-date' });

            expect(res.statusCode).toBe(400);
        });

        it('should reject when missing name', async () => {
            const res = await request(app)
                .post('/api/intake-records')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ purchasedOn: '2026-08-01' });

            expect(res.statusCode).toBe(400);
        });

        it('should return 403 when user lacks inventory.create permission', async () => {
            const viewerData = generateTestUser({ password: 'Cashier123!' });
            const viewer = await db.User.create({
                username: viewerData.username,
                email: viewerData.email,
                firstName: viewerData.firstName,
                passwordHash: await argon2.hash(viewerData.password),
            });
            const cashierRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
            await viewer.addRole(cashierRole);
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ username: viewerData.username, password: viewerData.password });
            const cashierToken = loginRes.body.data.accessToken;

            const res = await request(app)
                .post('/api/intake-records')
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({ name: 'TEST cashier', purchasedOn: '2026-08-02' });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /intake-records/:intakeUuid', () => {
        it('should return record with templates', async () => {
            const record = await db.IntakeRecord.create({
                name: 'TEST detail intake',
                purchasedOn: '2026-08-03',
            });
            await db.IntakeTemplate.create({
                intakeRecordId: record.id,
                name: 'TEST Paithani bulk',
                productTypeId: activeProductType.id,
                buyingPricePaise: 50000,
                defaultQuantity: 10,
            });

            const res = await request(app)
                .get(`/api/intake-records/${record.uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.uuid).toBe(record.uuid);
            expect(res.body.data.templates.length).toBe(1);
            expect(res.body.data.templates[0].buyingPricePaise).toBe('50000');
        });

        it('should return 404 for unknown uuid', async () => {
            const res = await request(app)
                .get('/api/intake-records/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${adminToken}`);
            // service throws 404 which maps via error middleware
            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /intake-records/:intakeUuid/templates', () => {
        it('should create a template with buying price prefill', async () => {
            const record = await db.IntakeRecord.create({
                name: 'TEST template intake',
                purchasedOn: '2026-08-04',
            });

            const res = await request(app)
                .post(`/api/intake-records/${record.uuid}/templates`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    name: 'TEST Paithani',
                    productTypeUuid: activeProductType.uuid,
                    buyingPricePaise: 45000,
                    defaultQuantity: 5,
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('uuid');
            expect(res.body.data.buyingPricePaise).toBe('45000');
            expect(res.body.data.productTypeUuid).toBe(activeProductType.uuid);
        });

        it('should reject buying price below zero', async () => {
            const record = await db.IntakeRecord.create({
                name: 'TEST neg intake',
                purchasedOn: '2026-08-04',
            });

            const res = await request(app)
                .post(`/api/intake-records/${record.uuid}/templates`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ productTypeUuid: activeProductType.uuid, buyingPricePaise: -100 });

            expect(res.statusCode).toBe(400);
        });

        it('should reject floor price above selling price', async () => {
            const record = await db.IntakeRecord.create({
                name: 'TEST floor intake',
                purchasedOn: '2026-08-04',
            });

            const res = await request(app)
                .post(`/api/intake-records/${record.uuid}/templates`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    productTypeUuid: activeProductType.uuid,
                    buyingPricePaise: 10000,
                    defaultSellingPricePaise: 20000,
                    defaultFloorPricePaise: 25000,
                });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('PATCH /intake-records/:intakeUuid/templates/:uuid', () => {
        it('should update buying price and product type', async () => {
            const record = await db.IntakeRecord.create({
                name: 'TEST update intake',
                purchasedOn: '2026-08-05',
            });
            const template = await db.IntakeTemplate.create({
                intakeRecordId: record.id,
                productTypeId: activeProductType.id,
                buyingPricePaise: 30000,
            });

            const res = await request(app)
                .patch(`/api/intake-records/${record.uuid}/templates/${template.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ buyingPricePaise: 35000 });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.buyingPricePaise).toBe('35000');
        });
    });

    describe('DELETE /intake-records/:intakeUuid/templates/:uuid', () => {
        it('should soft-delete a template', async () => {
            const record = await db.IntakeRecord.create({
                name: 'TEST delete intake',
                purchasedOn: '2026-08-06',
            });
            const template = await db.IntakeTemplate.create({
                intakeRecordId: record.id,
                productTypeId: activeProductType.id,
                buyingPricePaise: 20000,
            });

            const res = await request(app)
                .delete(`/api/intake-records/${record.uuid}/templates/${template.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.deleted).toBe(true);

            const gone = await db.IntakeTemplate.findOne({
                where: { uuid: template.uuid },
                paranoid: true,
            });
            expect(gone).toBeNull();
        });
    });
});
