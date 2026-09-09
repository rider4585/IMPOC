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

/*
 * Receipt routes require PERMISSIONS.REPORTS.VIEW (matching the contract).
 * A MANAGER has reports.view through test-setup's role seeding. We mount the
 * receipts router on a local app but authenticate through the real app.
 */
describe('Receipts module - /api/receipts/preview and /print', () => {
    let managerToken;
    let colour;
    let size;
    let productType;
    let trip;
    let tripVendor;
    let vendor;
    let saleUuid;
    let rentalUuid;
    let createdCustomerId;

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

        colour = await db.Colour.create({ name: 'Blue', hexValue: '#0000FF', isActive: true });
        size = await db.Size.create({ name: 'L', isActive: true });
        productType = await db.ProductType.create({ name: `PT_${Date.now()}` });
        vendor = await db.Vendor.create({ name: 'Test Vendor' });
        const pair = await createTripWithVendor({
            vendor,
            name: 'TEST Receipts Trip',
            totalPaidPaise: 1000000,
        });
        trip = pair.trip;
        tripVendor = pair.tripVendor;

        const customer = await db.Customer.create({
            name: 'TEST_Customer_ReceiptBuyer',
            phone: '+919800000001',
            consentWhatsapp: true,
        });
        createdCustomerId = customer.id;

        // --- Sale for receipt ---
        const retailUnit = await makeUnit({ barcode: 'C1000000011', channel: 'RETAIL' });
        const sale = await db.Sale.create({
            saleNumber: 'S-RECEIPT', customerId: customer.id, soldAt: '2026-02-10',
            totalPaise: 200000, status: 'completed',
        });
        await db.SaleLine.create({
            saleId: sale.id, unitId: retailUnit.id, unitUuid: retailUnit.uuid,
            barcode: retailUnit.barcode, sellingPricePaise: 200000,
        });
        saleUuid = sale.uuid;

        // --- Rental for receipt ---
        const rentalUnit = await makeUnit({ barcode: 'C1000000012', channel: 'RENTAL', retail: false });
        const agreement = await db.RentalAgreement.create({
            agreementNumber: 'R-RECEIPT', customerId: customer.id,
            startDate: '2026-02-10', dueDate: '2026-02-12',
            depositRefundablePaise: 5000, status: 'active',
        });
        await db.RentalLine.create({
            agreementId: agreement.id, unitId: rentalUnit.id, unitUuid: rentalUnit.uuid,
            barcode: rentalUnit.barcode, rentPerDayPaise: 1000, depositPaise: 5000, overduePerDayPaise: 200,
        });
        rentalUuid = agreement.uuid;
    });

    afterAll(async () => {
        if (createdCustomerId) {
            await db.Customer.destroy({ where: { id: createdCustomerId } });
        }
        await closeDatabase();
    });

    describe('GET /api/receipts/preview', () => {
        it('should return 401 without authentication', async () => {
            const res = await request(testApp)
                .get('/api/receipts/preview')
                .query({ entityType: 'SALE', entityUuid: saleUuid });
            expect(res.statusCode).toBe(401);
        });

        it('should return 400 for an invalid entityType', async () => {
            const res = await request(testApp)
                .get('/api/receipts/preview')
                .set('Authorization', `Bearer ${managerToken}`)
                .query({ entityType: 'INVOICE', entityUuid: saleUuid });
            expect(res.statusCode).toBe(400);
        });

        it('should build a SALE preview with customer info and line totals', async () => {
            const res = await request(testApp)
                .get('/api/receipts/preview')
                .set('Authorization', `Bearer ${managerToken}`)
                .query({ entityType: 'SALE', entityUuid: saleUuid });

            expect(res.statusCode).toBe(200);
            const receipt = res.body.data.receipt;
            expect(receipt.transaction.type).toBe('SALE');
            expect(receipt.transaction.number).toBe('S-RECEIPT');
            expect(receipt.customer.name).toBe('TEST_Customer_ReceiptBuyer');
            expect(receipt.customer.phone).toBeUndefined();
            expect(receipt.customer.email).toBeUndefined();
            expect(receipt.lines).toHaveLength(1);
            expect(receipt.lines[0].productName).toBe(productType.name);
            expect(receipt.lines[0].colour).toBe('Blue');
            expect(receipt.lines[0].size).toBe('L');
            expect(receipt.lines[0].lineTotalPaise).toBe('200000');
            expect(receipt.totals.totalPaise).toBe('200000');
        });

        it('should build a RENTAL preview', async () => {
            const res = await request(testApp)
                .get('/api/receipts/preview')
                .set('Authorization', `Bearer ${managerToken}`)
                .query({ entityType: 'RENTAL', entityUuid: rentalUuid });

            expect(res.statusCode).toBe(200);
            const receipt = res.body.data.receipt;
            expect(receipt.transaction.type).toBe('RENTAL');
            expect(receipt.transaction.number).toBe('R-RECEIPT');
            expect(receipt.customer.name).toBe('TEST_Customer_ReceiptBuyer');
            expect(receipt.lines).toHaveLength(1);
            expect(receipt.lines[0].productName).toBe(productType.name);
        });

        it('should return 404 for an unknown sale uuid', async () => {
            const res = await request(testApp)
                .get('/api/receipts/preview')
                .set('Authorization', `Bearer ${managerToken}`)
                .query({ entityType: 'SALE', entityUuid: '00000000-0000-0000-0000-000000000000' });
            expect(res.statusCode).toBe(404);
        });
    });

    describe('GET /api/receipts/print', () => {
        it('should return a plain-text 58mm receipt for a sale', async () => {
            const res = await request(testApp)
                .get('/api/receipts/print')
                .set('Authorization', `Bearer ${managerToken}`)
                .query({ entityType: 'SALE', entityUuid: saleUuid });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            const text = res.body.data.text;
            expect(typeof text).toBe('string');
            expect(text).toContain('S-RECEIPT');
            expect(text).toContain('TEST_Customer_ReceiptBuyer');
        });

        it('should return 404 for an unknown rental uuid', async () => {
            const res = await request(testApp)
                .get('/api/receipts/print')
                .set('Authorization', `Bearer ${managerToken}`)
                .query({ entityType: 'RENTAL', entityUuid: '00000000-0000-0000-0000-000000000000' });
            expect(res.statusCode).toBe(404);
        });
    });
});