import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, closeDatabase, generateTestUser, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';

/*
 * SEC-H-2 regression: the inventory cost book (buying/floor prices, quantity,
 * vendor bills/history, barcode metadata) must never be readable by an
 * authenticated role that lacks INVENTORY.VIEW.
 *
 * ACCOUNTANT is the seeded role WITHOUT inventory.view (test-setup grants it
 * only sales.view / expenses.* / reports.view / roles.view), so it is the
 * negative control. ADMIN is the positive control (all permissions).
 */
describe('SEC-H-2: inventory read routes require INVENTORY.VIEW', () => {
    let adminToken;
    let accountantToken;
    let vendor;
    let productType;
    let colour;
    let size;
    let trip;
    let tripVendor;
    let stock;
    let unit;
    let template;
    let createdUsers = [];

    async function createRoleUser(roleName, password) {
        const data = generateTestUser({ password });
        const user = await db.User.create({
            username: data.username,
            email: data.email,
            firstName: data.firstName,
            passwordHash: await argon2.hash(data.password),
        });
        createdUsers.push(user);
        const role = await db.Role.findOne({ where: { name: roleName } });
        await user.addRole(role);
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: data.username, password: data.password });
        return loginRes.body.data.accessToken;
    }

    beforeAll(async () => {
        await initializeTestDatabase();

        adminToken = await createRoleUser('ADMIN', 'Admin123!');
        accountantToken = await createRoleUser('ACCOUNTANT', 'Accountant123!');

        // Distinctive AHZ_ prefix avoids colliding with other suites' TEST_% cleanup globs.
        vendor = await db.Vendor.create({ name: 'AHZ_AuthzVendor', isActive: true });
        productType = await db.ProductType.create({ name: 'AHZ_AuthzProductType', isActive: true });
        colour = await db.Colour.create({ name: 'AHZ_Red', hexValue: '#FF0000', isActive: true });
        size = await db.Size.create({ name: 'AHZ_M', isActive: true });

        const pair = await createTripWithVendor({
            vendor,
            name: 'AHZ_AuthzTrip',
            billReference: 'AHZ-INV-001',
            totalPaidPaise: 100000,
        });
        trip = pair.trip;
        tripVendor = pair.tripVendor;

        stock = await createTestStock({
            trip,
            tripVendor,
            vendor,
            productType,
            overrides: {
                quantity: 10,
                buyingPricePaise: 100000,
                sellingPricePaise: 200000,
                floorPricePaise: 150000,
                channel: 'RETAIL',
            },
        });

        unit = await db.Unit.create({
            barcode: '444444444401',
            stockId: stock.id,
            colourId: colour.id,
            sizeId: size.id,
            status: 'in_stock',
            channel: 'RETAIL',
            buyingPricePaise: 100000,
            sellingPricePaise: 200000,
            floorPricePaise: 150000,
        });
        await db.UnitStatusEvent.create({
            unitId: unit.id,
            fromStatus: null,
            toStatus: 'in_stock',
            cause: 'INTAKE',
            actorUserId: createdUsers[0].id,
            occurredAt: new Date(),
        });

        template = await db.StockTemplate.create({
            vendorId: vendor.id,
            productTypeId: productType.id,
            name: 'AHZ_Paithani',
            buyingPricePaise: 50000,
            defaultSellingPricePaise: 90000,
            defaultFloorPricePaise: 70000,
        });
    });

    afterAll(async () => {
        await db.Unit.destroy({ where: { barcode: '444444444401' }, force: true });
        await db.StockTemplate.destroy({ where: { vendorId: vendor.id }, force: true });
        await db.Stock.destroy({ where: { id: stock.id }, force: true });
        await db.TripVendor.destroy({ where: { tripId: trip.id }, force: true });
        await db.Trip.destroy({ where: { id: trip.id }, force: true });
        await db.ProductType.destroy({ where: { id: productType.id }, force: true });
        await db.Colour.destroy({ where: { id: colour.id }, force: true });
        await db.Size.destroy({ where: { id: size.id }, force: true });
        await db.Vendor.destroy({ where: { id: vendor.id }, force: true });
        await db.User.destroy({ where: { id: createdUsers.map((u) => u.id) }, force: true });
        await closeDatabase();
    });

    // Each route is exercised twice: once without INVENTORY.VIEW (403 at the
    // authorize() gate) and once with full access (200, positive control).
    const routes = [
        {
            name: 'GET /api/trips',
            hit: (token) => request(app).get('/api/trips')
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/trips/:uuid',
            hit: (token) => request(app).get(`/api/trips/${trip.uuid}`)
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/trips/:tripUuid/clone-last-stock',
            hit: (token) => request(app).get(`/api/trips/${trip.uuid}/clone-last-stock`)
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/trips/:tripUuid/stocks',
            hit: (token) => request(app).get(`/api/trips/${trip.uuid}/stocks`)
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/trips/:tripUuid/stocks/:uuid',
            hit: (token) => request(app).get(`/api/trips/${trip.uuid}/stocks/${stock.uuid}`)
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/stocks',
            hit: (token) => request(app).get('/api/stocks')
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/templates',
            hit: (token) => request(app).get('/api/templates')
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/templates/:uuid',
            hit: (token) => request(app).get(`/api/templates/${template.uuid}`)
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/vendors',
            hit: (token) => request(app).get('/api/vendors')
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/vendors/:uuid',
            hit: (token) => request(app).get(`/api/vendors/${vendor.uuid}`)
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/vendors/:uuid/history',
            hit: (token) => request(app).get(`/api/vendors/${vendor.uuid}/history`)
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/units/:uuid',
            hit: (token) => request(app).get(`/api/units/${unit.uuid}`)
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/units/:uuid/status-events',
            hit: (token) => request(app).get(`/api/units/${unit.uuid}/status-events`)
                .set('Authorization', `Bearer ${token}`),
        },
        {
            name: 'GET /api/units/by-barcode/:barcode',
            hit: (token) => request(app).get(`/api/units/by-barcode/${unit.barcode}`)
                .set('Authorization', `Bearer ${token}`),
        },
    ];

    it.each(routes.map((r) => [r.name, r.hit]))(
        '%s returns 401 without authentication',
        async (_name, hitFn) => {
            const res = await hitFn('');
            expect(res.statusCode).toBe(401);
        }
    );

    it.each(routes.map((r) => [r.name, r.hit]))(
        '%s returns 403 for a role WITHOUT inventory.view (ACCOUNTANT)',
        async (_name, hitFn) => {
            const res = await hitFn(accountantToken);
            expect(res.statusCode).toBe(403);
        }
    );

    it.each(routes.map((r) => [r.name, r.hit]))(
        '%s returns 200 for a role WITH inventory.view (ADMIN)',
        async (_name, hitFn) => {
            const res = await hitFn(adminToken);
            expect(res.statusCode).toBe(200);
        }
    );
});