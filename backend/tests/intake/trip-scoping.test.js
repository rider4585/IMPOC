import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';

/*
 * SEC-H-4 regression: scanIntoStock must resolve the stock ONLY within the
 * trip named in the URL. A caller must not be able to reach a stock that
 * exists elsewhere simply by knowing its UUID and passing a different tripUuid.
 *
 * Negative control: scan stock A's UUID into trip B -> 404 (stock not in trip).
 * Positive control: scan stock A's UUID into trip A -> 201.
 * Boundary control: a caller without INVENTORY.VIEW cannot scan at all (403).
 */
describe('SEC-H-4: scanIntoStock is scoped to the URL trip', () => {
    let managerToken;
    let accountantToken;
    let tripA;
    let tripVendorA;
    let stockA;
    let tripB;
    let tripVendorB;
    let stockB;
    let vendor;
    let colour;
    let size;
    let productType;
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

    async function createTripWithStock(name, billRef) {
        const pair = await createTripWithVendor({
            vendor,
            name,
            billReference: billRef,
            totalPaidPaise: 100000,
        });
        const createdStock = await createTestStock({
            trip: pair.trip,
            tripVendor: pair.tripVendor,
            vendor,
            productType,
            overrides: {
                quantity: 5,
                buyingPricePaise: 100000,
                sellingPricePaise: 200000,
                floorPricePaise: 150000,
                channel: 'RETAIL',
            },
        });
        return { ...pair, stock: createdStock };
    }

    beforeAll(async () => {
        await initializeTestDatabase();

        managerToken = await createRoleUser('MANAGER', 'Manager123!');
        accountantToken = await createRoleUser('ACCOUNTANT', 'Accountant123!');

        colour = await db.Colour.create({ name: 'SECRed', hexValue: '#FF0000', isActive: true });
        size = await db.Size.create({ name: 'SECM', isActive: true });
        productType = await db.ProductType.create({ name: 'SEC Product' });
        vendor = await db.Vendor.create({ name: 'SEC Vendor' });

        const pairA = await createTripWithStock('SEC Trip A', 'SEC-INV-A');
        tripA = pairA.trip;
        tripVendorA = pairA.tripVendor;
        stockA = pairA.stock;

        const pairB = await createTripWithStock('SEC Trip B', 'SEC-INV-B');
        tripB = pairB.trip;
        tripVendorB = pairB.tripVendor;
        stockB = pairB.stock;
    });

    afterAll(async () => {
        await db.Unit.destroy({ where: { stockId: stockA.id }, force: true });
        await db.Unit.destroy({ where: { stockId: stockB.id }, force: true });
        await db.Stock.destroy({ where: { id: stockA.id }, force: true });
        await db.Stock.destroy({ where: { id: stockB.id }, force: true });
        await db.TripVendor.destroy({ where: { tripId: tripA.id }, force: true });
        await db.TripVendor.destroy({ where: { tripId: tripB.id }, force: true });
        await db.Trip.destroy({ where: { id: tripA.id }, force: true });
        await db.Trip.destroy({ where: { id: tripB.id }, force: true });
        await db.ProductType.destroy({ where: { id: productType.id }, force: true });
        await db.Colour.destroy({ where: { id: colour.id }, force: true });
        await db.Size.destroy({ where: { id: size.id }, force: true });
        await db.Vendor.destroy({ where: { id: vendor.id }, force: true });
        await db.User.destroy({ where: { id: createdUsers.map((u) => u.id) }, force: true });
        await closeDatabase();
    });

    const payload = (barcode) => ({
        barcode,
        colourUuid: colour.uuid,
        sizeUuid: size.uuid,
    });

    it('returns 404 when the stock UUID belongs to a DIFFERENT trip', async () => {
        const res = await request(app)
            .post(`/api/trips/${tripB.uuid}/stocks/${stockA.uuid}/scan`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send(payload('555555555501'))
            .expect(404);

        expect(res.body.success).toBe(false);
    });

    it('returns 404 even when BOTH trips are valid trips', async () => {
        const res = await request(app)
            .post(`/api/trips/${tripA.uuid}/stocks/${stockB.uuid}/scan`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send(payload('555555555502'))
            .expect(404);

        expect(res.body.success).toBe(false);
    });

    it('still scans successfully when the stock belongs to the URL trip', async () => {
        const res = await request(app)
            .post(`/api/trips/${tripA.uuid}/stocks/${stockA.uuid}/scan`)
            .set('Authorization', `Bearer ${managerToken}`)
            .send(payload('555555555503'))
            .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.barcode).toBe('555555555503');
        expect(res.body.data.stockUuid).toBe(stockA.uuid);
    });

    it('forbids a role without inventory.create from scanning at all', async () => {
        const res = await request(app)
            .post(`/api/trips/${tripA.uuid}/stocks/${stockA.uuid}/scan`)
            .set('Authorization', `Bearer ${accountantToken}`)
            .send(payload('555555555504'))
            .expect(403);

        expect(res.body.success).toBe(false);
    });
});