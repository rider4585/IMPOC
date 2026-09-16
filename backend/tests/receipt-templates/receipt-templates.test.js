import express from 'express';
import request from 'supertest';
import argon2 from 'argon2';
import * as db from '../../database/models/index.js';
import {
    initializeTestDatabase,
    generateTestUser,
    closeDatabase,
    createTripWithVendor,
    createTestStock,
} from '../utils/test-setup.js';
import authRoutes from '../../src/modules/auth/auth.routes.js';
import { receiptTemplateRoutes, receiptSnapshotRoutes } from '../../src/modules/receipt-templates/receipt-templates.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';

/*
 * We cannot import app.js because it has a naming collision between the
 * intake templateRoutes and the receipt-templates templateRoutes. Instead we
 * build a minimal app with just auth + the routes under test.
 */
const authApp = express();
authApp.use(express.json());
authApp.use('/api/auth', authRoutes);

const testApp = express();
testApp.use(express.json());
testApp.use('/api/receipt-templates', receiptTemplateRoutes);
testApp.use('/api/receipt-snapshots', receiptSnapshotRoutes);
testApp.use(errorMiddleware);

const PREFIX = 'RT_TEST_';

/*
 * Receipt template + snapshot endpoints require specific permissions that are
 * NOT in the standard test-setup seed. We create them in beforeAll and assign
 * ADMIN gets all; MANAGER gets view only; CASHIER gets none.
 */
describe('Receipt Templates module — /api/receipt-templates & /api/receipt-snapshots', () => {
    let adminToken;
    let managerToken;
    let cashierToken;
    let colour;
    let size;
    let productType;
    let trip;
    let tripVendor;
    let vendor;
    let saleUuid;
    let createdCustomerId;

    const login = async (roleName) => {
        const data = generateTestUser({ password: 'Admin123!' });
        const user = await db.User.create({
            username: data.username,
            email: data.email,
            firstName: data.firstName,
            passwordHash: await argon2.hash(data.password),
        });
        const role = await db.Role.findOne({ where: { name: roleName } });
        await user.addRole(role);
        const res = await request(authApp)
            .post('/api/auth/login')
            .send({ username: data.username, password: data.password });
        return res.body.data.accessToken;
    };

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
        });
    }

    beforeAll(async () => {
        await initializeTestDatabase();

        /* Seed receipt template + snapshot permissions (not in test-setup) */
        const perms = await db.Permission.bulkCreate([
            { name: 'receipt_templates.view', description: 'View receipt templates' },
            { name: 'receipt_templates.manage', description: 'Manage receipt templates' },
            { name: 'receipt_snapshots.view', description: 'View receipt snapshots' },
            { name: 'receipt_snapshots.manage', description: 'Manage receipt snapshots' },
            { name: 'receipt_snapshots.export', description: 'Export receipt snapshots' },
        ], { ignoreDuplicates: true });

        const adminRole = await db.Role.findOne({ where: { name: 'ADMIN' } });
        await adminRole.addPermissions(perms);

        const managerRole = await db.Role.findOne({ where: { name: 'MANAGER' } });
        const managerPerms = perms.filter(p => p.name.endsWith('.view'));
        await managerRole.addPermissions(managerPerms);

        adminToken = await login('ADMIN');
        managerToken = await login('MANAGER');
        cashierToken = await login('CASHIER');

        /* Shared test data for snapshot tests */
        colour = await db.Colour.create({ name: `${PREFIX}Blue`, hexValue: '#0000FF', isActive: true });
        size = await db.Size.create({ name: `${PREFIX}L`, isActive: true });
        productType = await db.ProductType.create({ name: `${PREFIX}Saree` });
        vendor = await db.Vendor.create({ name: `${PREFIX}Vendor` });
        const pair = await createTripWithVendor({
            vendor,
            name: `${PREFIX}Trip`,
            totalPaidPaise: 1000000,
        });
        trip = pair.trip;
        tripVendor = pair.tripVendor;

        const customer = await db.Customer.create({
            name: `${PREFIX}Customer`,
            phone: '+919800000001',
            consentWhatsapp: true,
        });
        createdCustomerId = customer.id;

        const retailUnit = await makeUnit({ barcode: `${PREFIX}U001`, channel: 'RETAIL' });
        const sale = await db.Sale.create({
            saleNumber: `${PREFIX}S-001`,
            customerId: customer.id,
            soldAt: '2026-09-15',
            totalPaise: 200000,
            status: 'completed',
        });
        await db.SaleLine.create({
            saleId: sale.id,
            unitId: retailUnit.id,
            unitUuid: retailUnit.uuid,
            barcode: retailUnit.barcode,
            sellingPricePaise: 200000,
        });
        saleUuid = sale.uuid;
    });

    afterAll(async () => {
        await db.ReceiptSnapshot.destroy({ where: {}, force: true });
        await db.ReceiptTemplate.destroy({ where: {}, force: true });
        if (createdCustomerId) {
            await db.Customer.destroy({ where: { id: createdCustomerId } });
        }
        await closeDatabase();
    });

    /* ------------------------------------------------------------------ */
    /*  1. Permissions                                                     */
    /* ------------------------------------------------------------------ */
    describe('Permissions', () => {
        it('ADMIN can list templates', async () => {
            const res = await request(testApp)
                .get('/api/receipt-templates')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('ADMIN can create templates', async () => {
            const res = await request(testApp)
                .post('/api/receipt-templates')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: `${PREFIX}Perm Create`,
                    entityType: 'SALE',
                    htmlContent: '<div>test</div>',
                });
            expect(res.statusCode).toBe(201);
            // cleanup
            await db.ReceiptTemplate.destroy({ where: { uuid: res.body.data.uuid }, force: true });
        });

        it('MANAGER can list templates but cannot create', async () => {
            const list = await request(testApp)
                .get('/api/receipt-templates')
                .set('Authorization', `Bearer ${managerToken}`);
            expect(list.statusCode).toBe(200);

            const create = await request(testApp)
                .post('/api/receipt-templates')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: `${PREFIX}Mgr Forbidden`,
                    entityType: 'SALE',
                    htmlContent: '<div>test</div>',
                });
            expect(create.statusCode).toBe(403);
        });

        it('CASHIER (no receipt_templates perms) gets 403', async () => {
            const res = await request(testApp)
                .get('/api/receipt-templates')
                .set('Authorization', `Bearer ${cashierToken}`);
            expect(res.statusCode).toBe(403);
        });

        it('unauthenticated request gets 401', async () => {
            const res = await request(testApp)
                .get('/api/receipt-templates');
            expect(res.statusCode).toBe(401);
        });
    });

    /* ------------------------------------------------------------------ */
    /*  2. Template CRUD                                                   */
    /* ------------------------------------------------------------------ */
    describe('Template CRUD', () => {
        let createdUuid;

        it('POST /api/receipt-templates — creates a template (201)', async () => {
            const res = await request(testApp)
                .post('/api/receipt-templates')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: `${PREFIX}Sale Template`,
                    entityType: 'SALE',
                    htmlContent: '<html><body><h1>Sale Receipt</h1></body></html>',
                    editorState: { zoom: 1 },
                });
            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            const t = res.body.data;
            expect(t.name).toBe(`${PREFIX}Sale Template`);
            expect(t.entityType).toBe('SALE');
            expect(t.version).toBe(1);
            expect(t.isActive).toBe(false);
            expect(t.uuid).toBeDefined();
            createdUuid = t.uuid;
        });

        it('GET /api/receipt-templates — lists templates including the created one', async () => {
            const res = await request(testApp)
                .get('/api/receipt-templates')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            const found = res.body.data.find(t => t.uuid === createdUuid);
            expect(found).toBeDefined();
            expect(found.name).toBe(`${PREFIX}Sale Template`);
        });

        it('GET /api/receipt-templates?entityType=SALE — filters by entity type', async () => {
            const res = await request(testApp)
                .get('/api/receipt-templates?entityType=SALE')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.every(t => t.entityType === 'SALE')).toBe(true);
        });

        it('GET /api/receipt-templates/:uuid — returns the template', async () => {
            const res = await request(testApp)
                .get(`/api/receipt-templates/${createdUuid}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.uuid).toBe(createdUuid);
            expect(res.body.data.htmlContent).toContain('Sale Receipt');
        });

        it('GET /api/receipt-templates/:uuid — 404 for unknown uuid', async () => {
            const res = await request(testApp)
                .get('/api/receipt-templates/00000000-0000-4000-8000-000000000000')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(404);
        });

        it('PUT /api/receipt-templates/:uuid — creates a new version (version incremented)', async () => {
            const res = await request(testApp)
                .put(`/api/receipt-templates/${createdUuid}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: `${PREFIX}Sale Template v2`,
                    htmlContent: '<html><body><h1>Sale Receipt v2</h1></body></html>',
                });
            expect(res.statusCode).toBe(200);
            const t = res.body.data;
            expect(t.version).toBe(2);
            expect(t.name).toBe(`${PREFIX}Sale Template v2`);
            expect(t.htmlContent).toContain('v2');
            expect(t.isActive).toBe(false);
        });

        it('PUT /api/receipt-templates/:uuid — 404 for unknown uuid', async () => {
            const res = await request(testApp)
                .put('/api/receipt-templates/00000000-0000-4000-8000-000000000000')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Nope', htmlContent: '<div>x</div>' });
            expect(res.statusCode).toBe(404);
        });

        it('POST /api/receipt-templates — rejects empty name', async () => {
            const res = await request(testApp)
                .post('/api/receipt-templates')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: '', entityType: 'SALE', htmlContent: '<div>x</div>' });
            expect(res.statusCode).toBe(400);
        });

        it('POST /api/receipt-templates — rejects invalid entityType', async () => {
            const res = await request(testApp)
                .post('/api/receipt-templates')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Bad', entityType: 'INVALID', htmlContent: '<div>x</div>' });
            expect(res.statusCode).toBe(400);
        });

        it('GET /api/receipt-templates/active — returns 400 without entityType', async () => {
            const res = await request(testApp)
                .get('/api/receipt-templates/active')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(400);
        });

        it('GET /api/receipt-templates/active?entityType=SALE — 404 when none active', async () => {
            const res = await request(testApp)
                .get('/api/receipt-templates/active?entityType=SALE')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(404);
        });

        afterAll(async () => {
            if (createdUuid) {
                await db.ReceiptTemplate.destroy({ where: { uuid: createdUuid }, force: true });
            }
        });
    });

    /* ------------------------------------------------------------------ */
    /*  3. Template activation                                             */
    /* ------------------------------------------------------------------ */
    describe('Template activation', () => {
        let templateAUuid;
        let templateBUuid;

        beforeAll(async () => {
            const a = await request(testApp)
                .post('/api/receipt-templates')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: `${PREFIX}Activatable A`,
                    entityType: 'RENTAL',
                    htmlContent: '<div>Template A</div>',
                });
            templateAUuid = a.body.data.uuid;

            const b = await request(testApp)
                .post('/api/receipt-templates')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: `${PREFIX}Activatable B`,
                    entityType: 'RENTAL',
                    htmlContent: '<div>Template B</div>',
                });
            templateBUuid = b.body.data.uuid;
        });

        afterAll(async () => {
            await db.ReceiptTemplate.destroy({ where: { uuid: [templateAUuid, templateBUuid] }, force: true });
        });

        it('POST /:uuid/activate — activates template A', async () => {
            const res = await request(testApp)
                .post(`/api/receipt-templates/${templateAUuid}/activate`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.isActive).toBe(true);
            expect(res.body.data.entityType).toBe('RENTAL');
        });

        it('GET /active?entityType=RENTAL — returns template A as active', async () => {
            const res = await request(testApp)
                .get('/api/receipt-templates/active?entityType=RENTAL')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.uuid).toBe(templateAUuid);
            expect(res.body.data.isActive).toBe(true);
        });

        it('POST /:uuid/activate — activating B deactivates A', async () => {
            const res = await request(testApp)
                .post(`/api/receipt-templates/${templateBUuid}/activate`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.isActive).toBe(true);
            expect(res.body.data.uuid).toBe(templateBUuid);

            const checkA = await request(testApp)
                .get(`/api/receipt-templates/${templateAUuid}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(checkA.body.data.isActive).toBe(false);

            const active = await request(testApp)
                .get('/api/receipt-templates/active?entityType=RENTAL')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(active.body.data.uuid).toBe(templateBUuid);
        });

        it('POST /:uuid/activate — 404 for unknown uuid', async () => {
            const res = await request(testApp)
                .post('/api/receipt-templates/00000000-0000-4000-8000-000000000000/activate')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(404);
        });

        it('MANAGER cannot activate', async () => {
            const res = await request(testApp)
                .post(`/api/receipt-templates/${templateBUuid}/activate`)
                .set('Authorization', `Bearer ${managerToken}`);
            expect(res.statusCode).toBe(403);
        });
    });

    /* ------------------------------------------------------------------ */
    /*  4. Preview                                                         */
    /* ------------------------------------------------------------------ */
    describe('Preview', () => {
        it('POST /api/receipt-templates/preview — returns rendered HTML', async () => {
            const res = await request(testApp)
                .post('/api/receipt-templates/preview')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    htmlContent: '<div>{{receipt}}</div>',
                    entityType: 'SALE',
                });
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(typeof res.body.data.renderedHtml).toBe('string');
            expect(res.body.data.renderedHtml.length).toBeGreaterThan(0);
        });

        it('POST /api/receipt-templates/preview — 400 for invalid entityType', async () => {
            const res = await request(testApp)
                .post('/api/receipt-templates/preview')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ htmlContent: '<div>x</div>', entityType: 'UNIVERSAL' });
            expect(res.statusCode).toBe(400);
        });

        it('POST /api/receipt-templates/preview — 400 without htmlContent', async () => {
            const res = await request(testApp)
                .post('/api/receipt-templates/preview')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ entityType: 'SALE' });
            expect(res.statusCode).toBe(400);
        });

        it('MANAGER can preview (has view permission)', async () => {
            const res = await request(testApp)
                .post('/api/receipt-templates/preview')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ htmlContent: '<div>mgr</div>', entityType: 'SALE' });
            expect(res.statusCode).toBe(200);
        });
    });

    /* ------------------------------------------------------------------ */
    /*  5. Snapshots                                                       */
    /* ------------------------------------------------------------------ */
    describe('Snapshots', () => {
        let activeSaleTemplateUuid;
        let snapshotEntityUuid;

        beforeAll(async () => {
            /* Create and activate a SALE template so snapshot capture works */
            const t = await request(testApp)
                .post('/api/receipt-templates')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: `${PREFIX}Snapshot Template`,
                    entityType: 'SALE',
                    htmlContent: '<div>Sale snapshot template</div>',
                });
            activeSaleTemplateUuid = t.body.data.uuid;

            await request(testApp)
                .post(`/api/receipt-templates/${activeSaleTemplateUuid}/activate`)
                .set('Authorization', `Bearer ${adminToken}`);

            snapshotEntityUuid = saleUuid;
        });

        afterAll(async () => {
            if (activeSaleTemplateUuid) {
                await db.ReceiptTemplate.destroy({ where: { uuid: activeSaleTemplateUuid }, force: true });
            }
        });

        it('POST /api/receipt-snapshots/SALE/:uuid — captures a snapshot (201)', async () => {
            const res = await request(testApp)
                .post(`/api/receipt-snapshots/SALE/${snapshotEntityUuid}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            const s = res.body.data;
            expect(s.entityType).toBe('SALE');
            expect(s.entityUuid).toBe(snapshotEntityUuid);
            expect(typeof s.renderedHtml).toBe('string');
            expect(s.renderedHtml.length).toBeGreaterThan(0);
            expect(s.templateVersion).toBe(1);
            expect(s.template.name).toBe(`${PREFIX}Snapshot Template`);
        });

        it('GET /api/receipt-snapshots/SALE/:uuid — retrieves the snapshot', async () => {
            const res = await request(testApp)
                .get(`/api/receipt-snapshots/SALE/${snapshotEntityUuid}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.entityType).toBe('SALE');
            expect(res.body.data.entityUuid).toBe(snapshotEntityUuid);
            expect(typeof res.body.data.renderedHtml).toBe('string');
        });

        it('GET /api/receipt-snapshots/SALE/:uuid — 404 for entity with no snapshot', async () => {
            const res = await request(testApp)
                .get('/api/receipt-snapshots/SALE/00000000-0000-4000-8000-000000000000')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(404);
        });

        it('GET /api/receipt-snapshots — lists snapshots', async () => {
            const res = await request(testApp)
                .get('/api/receipt-snapshots')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.total).toBeGreaterThanOrEqual(1);
            expect(Array.isArray(res.body.data.snapshots)).toBe(true);
        });

        it('GET /api/receipt-snapshots?entityType=SALE — filters by type', async () => {
            const res = await request(testApp)
                .get('/api/receipt-snapshots?entityType=SALE')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.snapshots.every(s => s.entityType === 'SALE')).toBe(true);
        });

        it('GET /api/receipt-snapshots/export — returns array of all snapshots', async () => {
            const res = await request(testApp)
                .get('/api/receipt-snapshots/export')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data[0].renderedHtml).toBeDefined();
        });

        it('MANAGER can view snapshots but cannot capture or export', async () => {
            const viewRes = await request(testApp)
                .get('/api/receipt-snapshots')
                .set('Authorization', `Bearer ${managerToken}`);
            expect(viewRes.statusCode).toBe(200);

            const captureRes = await request(testApp)
                .post(`/api/receipt-snapshots/SALE/${snapshotEntityUuid}`)
                .set('Authorization', `Bearer ${managerToken}`);
            expect(captureRes.statusCode).toBe(403);

            const exportRes = await request(testApp)
                .get('/api/receipt-snapshots/export')
                .set('Authorization', `Bearer ${managerToken}`);
            expect(exportRes.statusCode).toBe(403);
        });

        it('CASHIER (no snapshot perms) gets 403', async () => {
            const res = await request(testApp)
                .get('/api/receipt-snapshots')
                .set('Authorization', `Bearer ${cashierToken}`);
            expect(res.statusCode).toBe(403);
        });

        it('unauthenticated snapshot request gets 401', async () => {
            const res = await request(testApp)
                .get('/api/receipt-snapshots');
            expect(res.statusCode).toBe(401);
        });
    });
});
