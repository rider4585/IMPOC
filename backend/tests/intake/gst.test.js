import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase, createTripWithVendor } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';

/**
 * R-51: GST on purchases.
 *  - stocks carry CGST/SGST percent rates (default 0)
 *  - trip vendor bills carry final CGST/SGST rupee amounts (default 0); total paid is GST-inclusive
 */
describe('GST on purchases (R-51)', () => {
    let testToken;
    let trip;
    let vendor;
    let secondVendor;
    let productType;
    let stockUuid;

    beforeAll(async () => {
        await initializeTestDatabase();

        const userData = generateTestUser({ password: 'TestPassword123!' });
        const testUser = await db.User.create({
            username: userData.username,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            passwordHash: await argon2.hash(userData.password),
        });
        const invRole = await db.Role.findOne({ where: { name: 'INVENTORY_MANAGER' } });
        await testUser.addRole(invRole);
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: userData.username, password: userData.password });
        testToken = loginRes.body.data.accessToken;

        productType = await db.ProductType.create({ name: 'Kurta GST', isActive: true });
        vendor = await db.Vendor.create({ name: 'GST Vendor', isActive: true });
        secondVendor = await db.Vendor.create({ name: 'GST Vendor 2', isActive: true });
        ({ trip } = await createTripWithVendor({ vendor, name: 'TEST GST Trip', totalPaidPaise: 500000 }));
    });

    afterAll(async () => {
        await db.Stock.destroy({ where: { tripId: trip.id }, force: true });
        await db.TripVendor.destroy({ where: { tripId: trip.id }, force: true });
        await db.Trip.destroy({ where: { id: trip.id }, force: true });
        await db.Vendor.destroy({ where: { id: [vendor.id, secondVendor.id] }, force: true });
        await db.ProductType.destroy({ where: { id: productType.id }, force: true });
        await db.User.destroy({ where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } } });
        await closeDatabase();
    });

    const stockBody = (extra = {}) => ({
        tripUuid: trip.uuid,
        vendorUuid: vendor.uuid,
        productTypeUuid: productType.uuid,
        quantity: 4,
        buyingPricePaise: 100000,
        sellingPricePaise: 150000,
        floorPricePaise: 120000,
        channel: 'RETAIL',
        ...extra,
    });

    it('creates a stock with CGST/SGST rates and returns them as numbers', async () => {
        const res = await request(app)
            .post(`/api/trips/${trip.uuid}/stocks`)
            .set('Authorization', `Bearer ${testToken}`)
            .send(stockBody({ cgstRatePct: 2.5, sgstRatePct: 2.5 }));

        expect(res.statusCode).toBe(201);
        expect(res.body.data.cgstRatePct).toBe(2.5);
        expect(res.body.data.sgstRatePct).toBe(2.5);
        expect(res.body.data.buyingPricePaise).toBe('100000');
        stockUuid = res.body.data.uuid;
    });

    it('defaults the rates to 0 when omitted (untaxed purchase)', async () => {
        const res = await request(app)
            .post(`/api/trips/${trip.uuid}/stocks`)
            .set('Authorization', `Bearer ${testToken}`)
            .send(stockBody());

        expect(res.statusCode).toBe(201);
        expect(res.body.data.cgstRatePct).toBe(0);
        expect(res.body.data.sgstRatePct).toBe(0);
    });

    it('rejects rates outside 0..100 or with more than 2 decimals', async () => {
        for (const bad of [{ cgstRatePct: -1 }, { sgstRatePct: 101 }, { cgstRatePct: 2.555 }]) {
            const res = await request(app)
                .post(`/api/trips/${trip.uuid}/stocks`)
                .set('Authorization', `Bearer ${testToken}`)
                .send(stockBody(bad));
            expect(res.statusCode).toBe(400);
        }
    });

    it('updates the rates via PATCH and lists them on the stock read', async () => {
        const patch = await request(app)
            .patch(`/api/trips/${trip.uuid}/stocks/${stockUuid}`)
            .set('Authorization', `Bearer ${testToken}`)
            .send({ cgstRatePct: 6, sgstRatePct: 6 });
        expect(patch.statusCode).toBe(200);
        expect(patch.body.data.cgstRatePct).toBe(6);

        const read = await request(app)
            .get(`/api/trips/${trip.uuid}/stocks/${stockUuid}`)
            .set('Authorization', `Bearer ${testToken}`);
        expect(read.statusCode).toBe(200);
        expect(read.body.data.sgstRatePct).toBe(6);

        const list = await request(app)
            .get(`/api/stocks?tripUuid=${trip.uuid}`)
            .set('Authorization', `Bearer ${testToken}`);
        expect(list.statusCode).toBe(200);
        const row = list.body.data.find((s) => s.uuid === stockUuid);
        expect(row.cgstRatePct).toBe(6);
    });

    it('records CGST/SGST amounts on a vendor bill without touching total paid', async () => {
        const res = await request(app)
            .post(`/api/trips/${trip.uuid}/vendors`)
            .set('Authorization', `Bearer ${testToken}`)
            .send({
                vendorUuid: secondVendor.uuid,
                billReference: 'INV-GST-1',
                totalPaidPaise: 210000,
                cgstPaise: 5000,
                sgstPaise: 5000,
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.data.totalPaidPaise).toBe('210000');
        expect(res.body.data.cgstPaise).toBe('5000');
        expect(res.body.data.sgstPaise).toBe('5000');

        const tripRead = await request(app)
            .get(`/api/trips/${trip.uuid}`)
            .set('Authorization', `Bearer ${testToken}`);
        const bill = tripRead.body.data.vendors.find((v) => v.vendorUuid === secondVendor.uuid);
        expect(bill.cgstPaise).toBe('5000');
        // Total paid is GST-inclusive as entered: no derived variance from the GST fields
        expect(tripRead.body.data.totalPaidPaise).toBe(String(500000 + 210000));
    });

    it('rejects a negative GST amount on a bill', async () => {
        const res = await request(app)
            .post(`/api/trips/${trip.uuid}/vendors`)
            .set('Authorization', `Bearer ${testToken}`)
            .send({ vendorUuid: secondVendor.uuid, totalPaidPaise: 1000, cgstPaise: -1 });
        expect(res.statusCode).toBe(400);
    });
});
