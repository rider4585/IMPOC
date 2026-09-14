import express from 'express';
import request from 'supertest';
import argon2 from 'argon2';
import * as db from '../../database/models/index.js';
import {
    initializeTestDatabase,
    generateTestUser,
    generateTestCustomer,
    closeDatabase,
} from '../utils/test-setup.js';
import app from '../../app.js';
import enquiriesRoutes from '../../src/modules/enquiries/enquiries.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';

const testApp = express();
testApp.use(express.json());
testApp.use('/api/enquiries', enquiriesRoutes);
testApp.use(errorMiddleware);

const PREFIX = 'ENQ_TEST_';

describe('Enquiries module - /api/enquiries (R-63)', () => {
    let adminToken;
    let accountantToken;
    let productType;
    let colour;

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
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: data.username, password: data.password });
        return res.body.data.accessToken;
    };

    const describeWhat = (extra = {}) => ({
        description: `${PREFIX}red silk saree for a wedding`,
        ...extra,
    });

    beforeAll(async () => {
        await initializeTestDatabase();
        adminToken = await login('ADMIN');
        // ACCOUNTANT has no enquiries.* permission in the test seed.
        accountantToken = await login('ACCOUNTANT');
        productType = await db.ProductType.create({ name: `${PREFIX}Saree`, isActive: true });
        colour = await db.Colour.create({ name: `${PREFIX}Red`, hexValue: '#FF0000', isActive: true });
    });

    afterEach(async () => {
        await db.CustomerEnquiry.destroy({
            where: { description: { [db.Sequelize.Op.like]: `${PREFIX}%` } },
            force: true,
        });
        await db.Customer.destroy({
            where: { name: { [db.Sequelize.Op.like]: 'TEST_Customer_%' } },
            force: true,
        });
    });

    afterAll(async () => {
        await closeDatabase();
    });

    describe('POST /enquiries', () => {
        it('creates the customer and the enquiry together when a new customer is given', async () => {
            const customer = generateTestCustomer({ consentWhatsapp: true });
            const res = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(describeWhat({
                    customer,
                    productTypeUuid: productType.uuid,
                    colourUuid: colour.uuid,
                    promisedDate: '2026-09-30',
                }));

            expect(res.statusCode).toBe(201);
            const { enquiry } = res.body.data;
            expect(enquiry.status).toBe('OPEN');
            expect(enquiry.customer.name).toBe(customer.name);
            expect(enquiry.customer.phone).toBe(customer.phone);
            expect(enquiry.customer.consentWhatsapp).toBe(true);
            expect(enquiry.productType).toEqual({ uuid: productType.uuid, name: productType.name });
            expect(enquiry.colour.name).toBe(colour.name);
            expect(enquiry.size).toBeNull();
            expect(enquiry.promisedDate).toBe('2026-09-30');
            expect(enquiry.createdBy).toBeTruthy();

            const stored = await db.Customer.findOne({ where: { uuid: enquiry.customer.uuid } });
            expect(stored).not.toBeNull();
        });

        it('attaches the enquiry to an existing customer by uuid', async () => {
            const existing = await db.Customer.create(generateTestCustomer());
            const res = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(describeWhat({ customerUuid: existing.uuid }));

            expect(res.statusCode).toBe(201);
            expect(res.body.data.enquiry.customer.uuid).toBe(existing.uuid);
        });

        it('returns 409 when the inline customer phone already exists (pick them instead)', async () => {
            const existing = await db.Customer.create(generateTestCustomer());
            const res = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(describeWhat({ customer: generateTestCustomer({ phone: existing.phone }) }));

            expect(res.statusCode).toBe(409);
            // The transaction rolled back: no orphan enquiry.
            const count = await db.CustomerEnquiry.count({ where: { description: { [db.Sequelize.Op.like]: `${PREFIX}%` } } });
            expect(count).toBe(0);
        });

        it('rejects a body with both customerUuid and customer, or neither', async () => {
            const existing = await db.Customer.create(generateTestCustomer());
            const both = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(describeWhat({ customerUuid: existing.uuid, customer: generateTestCustomer() }));
            expect(both.statusCode).toBe(400);

            const neither = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(describeWhat());
            expect(neither.statusCode).toBe(400);
        });

        it('rejects an empty description and an unknown product type', async () => {
            const existing = await db.Customer.create(generateTestCustomer());
            const empty = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ customerUuid: existing.uuid, description: '   ' });
            expect(empty.statusCode).toBe(400);

            const badRef = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(describeWhat({ customerUuid: existing.uuid, productTypeUuid: '00000000-0000-4000-8000-000000000000' }));
            expect(badRef.statusCode).toBe(400);
        });

        it('returns 403 for a role without enquiries.create and 401 without a token', async () => {
            const existing = await db.Customer.create(generateTestCustomer());
            const forbidden = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${accountantToken}`)
                .send(describeWhat({ customerUuid: existing.uuid }));
            expect(forbidden.statusCode).toBe(403);

            const anon = await request(testApp)
                .post('/api/enquiries')
                .send(describeWhat({ customerUuid: existing.uuid }));
            expect(anon.statusCode).toBe(401);
        });
    });

    describe('GET /enquiries', () => {
        it('lists by status with counts and searches by customer phone or description', async () => {
            const a = await db.Customer.create(generateTestCustomer({ phone: '+919900001111' }));
            const b = await db.Customer.create(generateTestCustomer({ phone: '+919900002222' }));

            const first = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ customerUuid: a.uuid, description: `${PREFIX}blue lehenga` });
            await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ customerUuid: b.uuid, description: `${PREFIX}green kurta` });
            await request(testApp)
                .post(`/api/enquiries/${first.body.data.enquiry.uuid}/close`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ notify: false });

            const open = await request(testApp)
                .get('/api/enquiries?status=OPEN')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(open.statusCode).toBe(200);
            expect(open.body.data.enquiries.map((e) => e.description)).toEqual([`${PREFIX}green kurta`]);
            expect(open.body.data.counts.OPEN).toBeGreaterThanOrEqual(1);
            expect(open.body.data.counts.CLOSED).toBeGreaterThanOrEqual(1);

            const byPhone = await request(testApp)
                .get('/api/enquiries?search=9900001111')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(byPhone.body.data.enquiries).toHaveLength(1);
            expect(byPhone.body.data.enquiries[0].customer.uuid).toBe(a.uuid);

            const byText = await request(testApp)
                .get(`/api/enquiries?search=${encodeURIComponent('green kurta')}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(byText.body.data.enquiries).toHaveLength(1);
            expect(byText.body.data.enquiries[0].customer.uuid).toBe(b.uuid);

            const byCustomer = await request(testApp)
                .get(`/api/enquiries?customerUuid=${a.uuid}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(byCustomer.body.data.enquiries).toHaveLength(1);
            expect(byCustomer.body.data.enquiries[0].status).toBe('CLOSED');
        });

        it('returns 403 for a role without enquiries.view', async () => {
            const res = await request(testApp)
                .get('/api/enquiries')
                .set('Authorization', `Bearer ${accountantToken}`);
            expect(res.statusCode).toBe(403);
        });
    });

    describe('PATCH / close / reopen', () => {
        let enquiryUuid;

        beforeEach(async () => {
            const customer = await db.Customer.create(generateTestCustomer());
            const res = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(describeWhat({ customerUuid: customer.uuid, productTypeUuid: productType.uuid }));
            enquiryUuid = res.body.data.enquiry.uuid;
        });

        it('edits the ask and can clear a picklist ref with null', async () => {
            const res = await request(testApp)
                .patch(`/api/enquiries/${enquiryUuid}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ description: `${PREFIX}changed`, productTypeUuid: null, colourUuid: colour.uuid, notes: 'call after 6pm', promisedDate: '2026-10-01' });

            expect(res.statusCode).toBe(200);
            const { enquiry } = res.body.data;
            expect(enquiry.description).toBe(`${PREFIX}changed`);
            expect(enquiry.productType).toBeNull();
            expect(enquiry.colour.uuid).toBe(colour.uuid);
            expect(enquiry.notes).toBe('call after 6pm');
            expect(enquiry.promisedDate).toBe('2026-10-01');
        });

        it('closes quietly: nothing sent, no delivery log', async () => {
            const closed = await request(testApp)
                .post(`/api/enquiries/${enquiryUuid}/close`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ notify: false, note: 'never came in' });
            expect(closed.statusCode).toBe(200);
            const { enquiry, handoffs } = closed.body.data;
            expect(enquiry.status).toBe('CLOSED');
            expect(enquiry.closedReason).toBe('NOT_NOTIFIED');
            expect(enquiry.closedNote).toBe('never came in');
            expect(enquiry.notifiedAt).toBeNull();
            expect(enquiry.notifiedChannels).toEqual([]);
            expect(enquiry.closedBy).toBeTruthy();
            expect(handoffs).toEqual([]);
            const logs = await db.DeliveryLog.count({ where: { entityType: 'ENQUIRY', entityId: enquiryUuid } });
            expect(logs).toBe(0);
        });

        it('closes as available: builds the message, logs a delivery per channel, returns tap-to-send links', async () => {
            const customer = await db.Customer.create(generateTestCustomer({
                name: 'Priya Sharma',
                phone: '98765 43210',
                email: 'priya@example.com',
                consentWhatsapp: true,
                consentEmail: true,
                consentSms: false,
            }));
            const created = await request(testApp)
                .post('/api/enquiries')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(describeWhat({ customerUuid: customer.uuid, productTypeUuid: productType.uuid, colourUuid: colour.uuid }));
            const uuid = created.body.data.enquiry.uuid;
            expect(created.body.data.enquiry.channelReadiness).toEqual({
                WHATSAPP: { ok: true, reason: null },
                EMAIL: { ok: true, reason: null },
                SMS: { ok: false, reason: 'No consent' },
            });

            const closed = await request(testApp)
                .post(`/api/enquiries/${uuid}/close`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ notify: true, channels: ['WHATSAPP', 'EMAIL'] });
            expect(closed.statusCode).toBe(200);
            const { enquiry, handoffs } = closed.body.data;
            expect(enquiry.status).toBe('CLOSED');
            expect(enquiry.closedReason).toBe('NOTIFIED');
            expect(enquiry.notifiedAt).toBeTruthy();
            expect(enquiry.notifiedChannels).toEqual(['WHATSAPP', 'EMAIL']);

            expect(handoffs).toHaveLength(2);
            const wa = handoffs.find((h) => h.channel === 'WHATSAPP');
            expect(wa.url).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
            const text = decodeURIComponent(wa.url.split('text=')[1]);
            expect(text).toMatch(/^Hello Priya, good news!/);
            expect(text).toContain(`${productType.name} ${colour.name} (${PREFIX}red silk saree for a wedding)`);
            const mail = handoffs.find((h) => h.channel === 'EMAIL');
            expect(mail.url).toMatch(/^mailto:priya%40example\.com\?subject=/);

            const logs = await db.DeliveryLog.findAll({ where: { entityType: 'ENQUIRY', entityId: uuid }, order: [['channel', 'ASC']] });
            expect(logs.map((l) => l.channel)).toEqual(['EMAIL', 'WHATSAPP']);
            expect(logs[1].status).toBe('SENT');
            expect(logs[1].provider).toBe('handoff');
            expect(logs[1].receiptPayload.body).toContain('Priya');
            await db.DeliveryLog.destroy({ where: { entityType: 'ENQUIRY', entityId: uuid }, force: true });
        });

        it('refuses to notify on a channel the customer cannot be reached on, and needs a channel when notifying', async () => {
            // The beforeEach customer has no consent at all.
            const blocked = await request(testApp)
                .post(`/api/enquiries/${enquiryUuid}/close`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ notify: true, channels: ['WHATSAPP'] });
            expect(blocked.statusCode).toBe(400);
            expect(blocked.body.message).toMatch(/WHATSAPP: No consent/);

            const none = await request(testApp)
                .post(`/api/enquiries/${enquiryUuid}/close`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ notify: true, channels: [] });
            expect(none.statusCode).toBe(400);

            // Still open after both refusals.
            const still = await request(testApp)
                .get(`/api/enquiries/${enquiryUuid}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(still.body.data.enquiry.status).toBe('OPEN');
        });

        it('refuses a second close and reopens back to OPEN', async () => {
            await request(testApp)
                .post(`/api/enquiries/${enquiryUuid}/close`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ notify: false });

            const again = await request(testApp)
                .post(`/api/enquiries/${enquiryUuid}/close`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ notify: false });
            expect(again.statusCode).toBe(409);

            const reopened = await request(testApp)
                .post(`/api/enquiries/${enquiryUuid}/reopen`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(reopened.statusCode).toBe(200);
            expect(reopened.body.data.enquiry.status).toBe('OPEN');
            expect(reopened.body.data.enquiry.closedReason).toBeNull();
            expect(reopened.body.data.enquiry.closedAt).toBeNull();

            const reopenOpen = await request(testApp)
                .post(`/api/enquiries/${enquiryUuid}/reopen`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(reopenOpen.statusCode).toBe(409);
        });

        it('rejects a malformed close body and a missing enquiry', async () => {
            const bad = await request(testApp)
                .post(`/api/enquiries/${enquiryUuid}/close`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ reason: 'FULFILLED' });
            expect(bad.statusCode).toBe(400);

            const missing = await request(testApp)
                .get('/api/enquiries/00000000-0000-4000-8000-000000000000')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(missing.statusCode).toBe(404);
        });
    });
});
