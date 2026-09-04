import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';

describe('Stock Templates Module - /api/templates', () => {
    let testDb;
    let adminToken;
    let inventoryToken;
    let activeVendor;
    let inactiveVendor;
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

        activeVendor = await db.Vendor.create({ name: 'TEST_TemplateVendor', isActive: true });
        inactiveVendor = await db.Vendor.create({ name: 'TEST_TemplateInactiveVendor', isActive: false });
        activeProductType = await db.ProductType.create({ name: 'TEST_TemplateProductType', isActive: true });
    });

    afterEach(async () => {
        await db.StockTemplate.destroy({ where: {} }, { force: true });
    });

    afterAll(async () => {
        await db.StockTemplate.destroy({ where: {} }, { force: true });
        await db.Vendor.destroy({ where: { name: { [db.Sequelize.Op.like]: 'TEST_Template%' } }, force: true });
        await db.ProductType.destroy({ where: { name: 'TEST_TemplateProductType' }, force: true });
        await closeDatabase();
    });

    describe('GET /templates', () => {
        it('should return 401 without authentication', async () => {
            const res = await request(app).get('/api/templates');
            expect(res.statusCode).toBe(401);
        });

        it('should list templates', async () => {
            await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST Paithani bulk',
                buyingPricePaise: 50000,
                defaultQuantity: 10,
            });

            const res = await request(app)
                .get('/api/templates')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        it('should filter templates by vendorUuid', async () => {
            const otherVendor = await db.Vendor.create({ name: 'TEST_OtherTemplateVendor', isActive: true });
            await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST Vendor A template',
                buyingPricePaise: 50000,
            });
            await db.StockTemplate.create({
                vendorId: otherVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST Vendor B template',
                buyingPricePaise: 60000,
            });

            try {
                const res = await request(app)
                    .get(`/api/templates?vendorUuid=${activeVendor.uuid}`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(res.statusCode).toBe(200);
                expect(res.body.data.length).toBe(1);
                expect(res.body.data[0].vendorUuid).toBe(activeVendor.uuid);
                expect(res.body.data[0].vendorName).toBe(activeVendor.name);
            } finally {
                await db.Vendor.destroy({ where: { id: otherVendor.id }, force: true });
            }
        });

        it('should return a template with money fields as strings', async () => {
            const template = await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST String prices',
                buyingPricePaise: 123456789012345,
                defaultSellingPricePaise: 234567890123456,
                defaultFloorPricePaise: 111111111111111,
            });

            const res = await request(app)
                .get('/api/templates')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            const found = res.body.data.find((t) => t.uuid === template.uuid);
            expect(found).toBeDefined();
            expect(typeof found.buyingPricePaise).toBe('string');
            expect(found.buyingPricePaise).toBe('123456789012345');
            expect(typeof found.defaultSellingPricePaise).toBe('string');
            expect(typeof found.defaultFloorPricePaise).toBe('string');
            expect(found).not.toHaveProperty('id');
        });
    });

    describe('POST /templates', () => {
        it('should create a template with buying price prefill', async () => {
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    name: 'TEST Paithani',
                    buyingPricePaise: 45000,
                    defaultQuantity: 5,
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('uuid');
            expect(res.body.data.vendorUuid).toBe(activeVendor.uuid);
            expect(res.body.data.productTypeUuid).toBe(activeProductType.uuid);
            expect(res.body.data.buyingPricePaise).toBe('45000');
            expect(res.body.data.defaultQuantity).toBe(5);
            expect(res.body.data).not.toHaveProperty('id');
        });

        it('should create a template without a name (uses vendor+product-type uniqueness)', async () => {
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    buyingPricePaise: 30000,
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.name).toBeNull();
        });

        it('should reject buying price below zero', async () => {
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    name: 'TEST Neg',
                    buyingPricePaise: -100,
                });

            expect(res.statusCode).toBe(400);
        });

        it('should reject floor price above selling price', async () => {
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    name: 'TEST Floor',
                    buyingPricePaise: 10000,
                    defaultSellingPricePaise: 20000,
                    defaultFloorPricePaise: 25000,
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Floor price cannot exceed selling price');
        });

        it('should return 404 when vendor does not exist', async () => {
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    vendorUuid: '00000000-0000-0000-0000-000000000000',
                    productTypeUuid: activeProductType.uuid,
                    buyingPricePaise: 10000,
                });

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toContain('Vendor not found');
        });

        it('should return 400 when vendor is inactive', async () => {
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    vendorUuid: inactiveVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    buyingPricePaise: 10000,
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Vendor is inactive');
        });

        it('should return 404 when product type does not exist', async () => {
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: '00000000-0000-0000-0000-000000000000',
                    buyingPricePaise: 10000,
                });

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toContain('Product type not found');
        });

        it('should return 409 when a duplicate template name exists for the same vendor + product type', async () => {
            await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST Dup Name',
                buyingPricePaise: 20000,
            });

            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    name: 'TEST Dup Name',
                    buyingPricePaise: 30000,
                });

            expect(res.statusCode).toBe(409);
            expect(res.body.message).toContain('already exists');
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
                .post('/api/templates')
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({
                    vendorUuid: activeVendor.uuid,
                    productTypeUuid: activeProductType.uuid,
                    name: 'TEST Cashier',
                    buyingPricePaise: 10000,
                });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /templates/:uuid', () => {
        it('should return a template by uuid', async () => {
            const template = await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST Detail',
                buyingPricePaise: 50000,
                defaultQuantity: 10,
            });

            const res = await request(app)
                .get(`/api/templates/${template.uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.uuid).toBe(template.uuid);
            expect(res.body.data.buyingPricePaise).toBe('50000');
            expect(res.body.data.productTypeUuid).toBe(activeProductType.uuid);
        });

        it('should return 404 for unknown uuid', async () => {
            const res = await request(app)
                .get('/api/templates/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(404);
        });

        it('should return 401 without authentication', async () => {
            const template = await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST NoAuth',
                buyingPricePaise: 10000,
            });

            const res = await request(app).get(`/api/templates/${template.uuid}`);
            expect(res.statusCode).toBe(401);
        });
    });

    describe('PATCH /templates/:uuid', () => {
        it('should update buying price', async () => {
            const template = await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST Update',
                buyingPricePaise: 30000,
            });

            const res = await request(app)
                .patch(`/api/templates/${template.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ buyingPricePaise: 35000 });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.buyingPricePaise).toBe('35000');
        });

        it('should update name and defaults', async () => {
            const template = await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST Rename',
                buyingPricePaise: 30000,
            });

            const res = await request(app)
                .patch(`/api/templates/${template.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ name: 'TEST Renamed', defaultQuantity: 12 });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.name).toBe('TEST Renamed');
            expect(res.body.data.defaultQuantity).toBe(12);
        });

        it('should reject name collision with 409', async () => {
            const t1 = await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST Taken',
                buyingPricePaise: 30000,
            });
            const t2 = await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST Free',
                buyingPricePaise: 30000,
            });

            const res = await request(app)
                .patch(`/api/templates/${t2.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`)
                .send({ name: 'TEST Taken' });

            expect(res.statusCode).toBe(409);
        });
    });

    describe('DELETE /templates/:uuid', () => {
        it('should soft-delete a template', async () => {
            const template = await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST Delete',
                buyingPricePaise: 20000,
            });

            const res = await request(app)
                .delete(`/api/templates/${template.uuid}`)
                .set('Authorization', `Bearer ${inventoryToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.deleted).toBe(true);

            const gone = await db.StockTemplate.findOne({
                where: { uuid: template.uuid },
                paranoid: true,
            });
            expect(gone).toBeNull();
        });

        it('should return 400 for invalid uuid', async () => {
            const res = await request(app)
                .delete('/api/templates/invalid-uuid')
                .set('Authorization', `Bearer ${inventoryToken}`);
            expect(res.statusCode).toBe(400);
        });

        it('should return 401 without authentication', async () => {
            const template = await db.StockTemplate.create({
                vendorId: activeVendor.id,
                productTypeId: activeProductType.id,
                name: 'TEST DeleteNoAuth',
                buyingPricePaise: 20000,
            });

            const res = await request(app).delete(`/api/templates/${template.uuid}`);
            expect(res.statusCode).toBe(401);
        });
    });
});