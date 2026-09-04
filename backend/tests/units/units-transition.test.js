import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';

describe('Unit transition HTTP routes (T-06)', () => {
    let testToken;
    let unit;
    let colour;
    let size;
    let trip;
    let tripVendor;
    let vendor;
    let stock;
    let productType;

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

        colour = await db.Colour.create({ name: 'Red', hexValue: '#FF0000', isActive: true });
        size = await db.Size.create({ name: 'M', isActive: true });
        productType = await db.ProductType.create({ name: `PT_${Date.now()}` });

        // Create a vendor + trip + stock + scan a RETAIL unit
        vendor = await db.Vendor.create({ name: 'Test Vendor' });
        const pair = await createTripWithVendor({
            vendor,
            name: 'TEST Transition Trip',
            totalPaidPaise: 1000000,
        });
        trip = pair.trip;
        tripVendor = pair.tripVendor;
        stock = await createTestStock({
            trip,
            tripVendor,
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

        const scanRes = await request(app)
            .post(`/api/trips/${trip.uuid}/stocks/${stock.uuid}/scan`)
            .set('Authorization', `Bearer ${testToken}`)
            .send({
                barcode: '111111111111',
                colourUuid: colour.uuid,
                sizeUuid: size.uuid,
            })
            .expect(201);

        unit = scanRes.body.data;
    });

    afterAll(async () => {
        await db.User.destroy({
            where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } },
        });
        await db.Unit.destroy({ where: { stockId: stock.id }, force: true });
        await db.Stock.destroy({ where: { id: stock.id }, force: true });
        await db.TripVendor.destroy({ where: { tripId: trip.id }, force: true });
        await db.Trip.destroy({ where: { id: trip.id }, force: true });
        await closeDatabase();
    });

    describe('POST /api/units/:uuid/transition', () => {
        it('should reject unauthenticated request', async () => {
            await request(app)
                .post(`/api/units/${unit.uuid}/transition`)
                .send({ toStatus: 'damaged', cause: 'STAFF_MARKED_DAMAGED' })
                .expect(401);
        });

        it('should transition a unit via a legal state machine move', async () => {
            const res = await request(app)
                .post(`/api/units/${unit.uuid}/transition`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ toStatus: 'damaged', cause: 'STAFF_MARKED_DAMAGED', reason: 'Broken on floor' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('damaged');

            const dbUnit = await db.Unit.findOne({ where: { uuid: unit.uuid } });
            expect(dbUnit.status).toBe('damaged');
        });

        it('should reject an illegal transition with 409', async () => {
            // Unit is now damaged; retrying damaged from a non-matching from-status (sold) is illegal
            // Instead use an impossible cause/status combo: try to go to sold via STAFF_MARKED_DAMAGED
            const res = await request(app)
                .post(`/api/units/${unit.uuid}/transition`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ toStatus: 'sold', cause: 'STAFF_MARKED_DAMAGED' })
                .expect(409);

            expect(res.body.success).toBe(false);
        });

        it('should reject invalid body with 400', async () => {
            await request(app)
                .post(`/api/units/${unit.uuid}/transition`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ toStatus: 'not_a_status', cause: 'NOPE' })
                .expect(400);
        });

        it('should require a reason for RECOVERY transitions', async () => {
            // Move unit to lost first (legal: damaged? no) - set directly for setup then recover requires reason
            const dbUnit = await db.Unit.findOne({ where: { uuid: unit.uuid } });
            await db.Unit.update({ status: 'lost' }, { where: { id: dbUnit.id } });

            const res = await request(app)
                .post(`/api/units/${unit.uuid}/transition`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ toStatus: 'in_stock', cause: 'RECOVERY' })
                .expect(400);

            expect(res.body.success).toBe(false);
        });
    });
});
