import express from 'express';
import request from 'supertest';
import * as db from '../../database/models/index.js';
import {
    initializeTestDatabase,
    generateTestUser,
    closeDatabase,
    createTripWithVendor,
    createTestStock,
} from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';
import receiptsRoutes from '../../src/modules/receipts/receipts.routes.js';
import errorMiddleware from '../../src/middleware/error.middleware.js';

const testApp = express();
testApp.use(express.json());
testApp.use('/api/receipts', receiptsRoutes);
testApp.use(errorMiddleware);

describe('Receipts PII masking by role', () => {
    let managerToken;
    let adminToken;
    let saleUuid;

    beforeAll(async () => {
        await initializeTestDatabase();

        const colour = await db.Colour.create({ name: 'Green', hexValue: '#00FF00', isActive: true });
        const size = await db.Size.create({ name: 'M', isActive: true });
        const productType = await db.ProductType.create({ name: `PT_PII_${Date.now()}` });
        const vendor = await db.Vendor.create({ name: 'PII Test Vendor' });
        const pair = await createTripWithVendor({
            vendor,
            name: 'PII Test Trip',
            totalPaidPaise: 1000000,
        });
        const trip = pair.trip;
        const tripVendor = pair.tripVendor;

        const customer = await db.Customer.create({
            name: 'PII_Customer_Alice',
            phone: '+919876543210',
            email: 'alice@example.com',
            consentWhatsapp: true,
        });

        const stock = await createTestStock({
            trip,
            tripVendor,
            vendor,
            productType,
            overrides: {
                quantity: 1,
                buyingPricePaise: 100000,
                sellingPricePaise: 300000,
                floorPricePaise: 150000,
                channel: 'RETAIL',
            },
        });
        const unit = await db.Unit.create({
            barcode: 'C1000000099',
            stockId: stock.id,
            colourId: colour.id,
            sizeId: size.id,
            status: 'in_stock',
            channel: 'RETAIL',
            buyingPricePaise: 100000,
            sellingPricePaise: 300000,
            floorPricePaise: 150000,
        });

        const sale = await db.Sale.create({
            saleNumber: 'S-PII-TEST',
            customerId: customer.id,
            soldAt: '2026-03-01',
            totalPaise: 300000,
            status: 'completed',
        });
        await db.SaleLine.create({
            saleId: sale.id,
            unitId: unit.id,
            unitUuid: unit.uuid,
            barcode: unit.barcode,
            sellingPricePaise: 300000,
        });
        saleUuid = sale.uuid;

        // MANAGER – has reports.view but is NOT privileged
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

        // ADMIN – IS privileged
        const adminData = generateTestUser({ password: 'TestPassword123!' });
        const admin = await db.User.create({
            username: adminData.username,
            firstName: adminData.firstName,
            lastName: adminData.lastName,
            email: adminData.email,
            passwordHash: await argon2.hash(adminData.password),
        });
        const adminRole = await db.Role.findOne({ where: { name: 'ADMIN' } });
        await admin.addRole(adminRole);
        const adminLogin = await request(app)
            .post('/api/auth/login')
            .send({ username: adminData.username, password: adminData.password });
        adminToken = adminLogin.body.data.accessToken;
    });

    afterAll(async () => {
        await closeDatabase();
    });

    describe('GET /api/receipts/preview – PII by role', () => {
        it('should mask phone/email for a non-privileged (MANAGER) caller', async () => {
            const res = await request(testApp)
                .get('/api/receipts/preview')
                .set('Authorization', `Bearer ${managerToken}`)
                .query({ entityType: 'SALE', entityUuid: saleUuid });

            expect(res.statusCode).toBe(200);
            const { customer } = res.body.data.receipt;
            expect(customer.name).toBe('PII_Customer_Alice');
            expect(customer.phone).toBeUndefined();
            expect(customer.email).toBeUndefined();
        });

        it('should expose full PII for a privileged (ADMIN) caller', async () => {
            const res = await request(testApp)
                .get('/api/receipts/preview')
                .set('Authorization', `Bearer ${adminToken}`)
                .query({ entityType: 'SALE', entityUuid: saleUuid });

            expect(res.statusCode).toBe(200);
            const { customer } = res.body.data.receipt;
            expect(customer.name).toBe('PII_Customer_Alice');
            expect(customer.phone).toBe('+919876543210');
            expect(customer.email).toBe('alice@example.com');
        });
    });

    describe('GET /api/receipts/print – PII by role', () => {
        it('should mask phone/email for a non-privileged (MANAGER) caller', async () => {
            const res = await request(testApp)
                .get('/api/receipts/print')
                .set('Authorization', `Bearer ${managerToken}`)
                .query({ entityType: 'SALE', entityUuid: saleUuid });

            expect(res.statusCode).toBe(200);
            const text = res.body.data.text;
            expect(text).toContain('PII_Customer_Alice');
            expect(text).not.toContain('+919876543210');
            expect(text).not.toContain('alice@example.com');
        });

        it('should expose full PII for a privileged (ADMIN) caller', async () => {
            const res = await request(testApp)
                .get('/api/receipts/print')
                .set('Authorization', `Bearer ${adminToken}`)
                .query({ entityType: 'SALE', entityUuid: saleUuid });

            expect(res.statusCode).toBe(200);
            const text = res.body.data.text;
            expect(text).toContain('PII_Customer_Alice');
            expect(text).toContain('+919876543210');
        });
    });
});
