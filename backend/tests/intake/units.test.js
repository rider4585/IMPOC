import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';

describe('Story 3.3: Scan units into a lot', () => {
    let testDb;
    let testToken;
    let trip;
    let lot;
    let colour;
    let size;
    let productType;

    beforeAll(async () => {
        // Initialize test database with predefined roles and permissions
        testDb = await initializeTestDatabase();

        // Create a test user with real password
        const userData = generateTestUser({ password: 'TestPassword123!' });
        const testUser = await db.User.create({
            username: userData.username,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            passwordHash: await argon2.hash(userData.password),
        });

        // Get INVENTORY_MANAGER role (which already has inventory.create permission)
        const invRole = await db.Role.findOne({ where: { name: 'INVENTORY_MANAGER' } });
        if (!invRole) {
            throw new Error('INVENTORY_MANAGER role not found in database - ensure seedTestData() was called');
        }
        await testUser.addRole(invRole);

        // Login to get a real JWT token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                username: userData.username,
                password: userData.password,
            });
        testToken = loginRes.body.data.accessToken;

        // Create colour and size
        colour = await db.Colour.create({ name: 'Red', hexValue: '#FF0000', isActive: true });
        size = await db.Size.create({ name: 'M', isActive: true });

        // Create product type
        productType = await db.ProductType.create({ name: 'Test Product' });

        // Create a vendor
        const vendor = await db.Vendor.create({ name: 'Test Vendor' });

        // Create a stock intake (trip)
        trip = await db.StockIntake.create({
            vendorId: vendor.id,
            purchasedOn: new Date().toISOString().split('T')[0],
            totalPaidPaise: 1000000
        });

        // Create a stock intake line (lot)
        lot = await db.StockIntakeLine.create({
            stockIntakeId: trip.id,
            productTypeId: productType.id,
            quantity: 5,
            buyingPricePaise: 100000,
            sellingPricePaise: 200000,
            floorPricePaise: 150000,
            channel: 'RETAIL',
            rentPerDayPaise: null,
            depositPaise: null,
            overduePerDayPaise: null,
        });
    });

    afterAll(async () => {
        // Clean up any test users created during tests
        await db.User.destroy({
            where: {
                username: {
                    [db.Sequelize.Op.like]: 'testuser_%'
                }
            }
        });
        await closeDatabase();
    });

    describe('POST /api/stock-intake-lines/:uuid/scan', () => {
        it('should scan into an open lot with valid barcode', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '123456789012',
                    stockIntakeLineUuid: lot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('uuid');
            expect(res.body.data.barcode).toBe('123456789012');
            expect(res.body.data.status).toBe('in_stock');
            expect(res.body.data.channel).toBe('RETAIL');
            expect(res.body.data.buyingPricePaise).toBe('100000');
            expect(res.body.data.sellingPricePaise).toBe('200000');
            expect(res.body.data.floorPricePaise).toBe('150000');

            // Patch 6: Verify UnitStatusEvent was created atomically
            const unitId = res.body.data.uuid;
            const unit = await db.Unit.findOne({ where: { uuid: unitId } });
            expect(unit).toBeDefined();
            const event = await db.UnitStatusEvent.findOne({ where: { unitId: unit.id } });
            expect(event).toBeDefined();
            expect(event.toStatus).toBe('in_stock');
            expect(event.cause).toBe('INTAKE');
        });

        it('should reject barcode already bound to a non-deleted unit', async () => {
            // First scan
            await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '999999999999',
                    stockIntakeLineUuid: lot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(201);

            // Second scan with same barcode
            const res = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '999999999999',
                    stockIntakeLineUuid: lot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(409);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Barcode already bound to unit');
        });

        it('should reject scan when lot has reached its declared quantity', async () => {
            // Create a new lot with quantity 1
            const smallLot = await db.StockIntakeLine.create({
                stockIntakeId: trip.id,
                productTypeId: productType.id,
                quantity: 1,
                buyingPricePaise: 100000,
                sellingPricePaise: 200000,
                floorPricePaise: 150000,
                channel: 'RETAIL',
            });

            // Scan one unit
            await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${smallLot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '111111111111',
                    stockIntakeLineUuid: smallLot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(201);

            // Try to scan another
            const res = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${smallLot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '222222222222',
                    stockIntakeLineUuid: smallLot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(400);

            expect(res.body.message).toContain('Lot has reached its declared quantity of 1');
        });

        it('should reject scan with inactive colour', async () => {
            const inactiveColour = await db.Colour.create({
                name: 'Inactive',
                hexValue: '#000000',
                isActive: false,
            });

            const res = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '333333333333',
                    stockIntakeLineUuid: lot.uuid,
                    colourUuid: inactiveColour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(400);

            expect(res.body.message).toContain('Colour is inactive');
        });

        it('should reject scan with inactive size', async () => {
            const inactiveSize = await db.Size.create({
                name: 'Inactive',
                isActive: false,
            });

            const res = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '444444444444',
                    stockIntakeLineUuid: lot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: inactiveSize.uuid,
                })
                .expect(400);

            expect(res.body.message).toContain('Size is inactive');
        });

        it('should return 404 when colour UUID not found', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '555555555555',
                    stockIntakeLineUuid: lot.uuid,
                    colourUuid: '00000000-0000-0000-0000-000000000000',
                    sizeUuid: size.uuid,
                })
                .expect(404);

            expect(res.body.message).toContain('Colour not found');
        });

        it('should return 404 when size UUID not found', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '666666666666',
                    stockIntakeLineUuid: lot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: '00000000-0000-0000-0000-000000000000',
                })
                .expect(404);

            expect(res.body.message).toContain('Size not found');
        });

        it('should scan into a RENTAL lot with pricing snapshot', async () => {
            const rentalLot = await db.StockIntakeLine.create({
                stockIntakeId: trip.id,
                productTypeId: productType.id,
                quantity: 5,
                buyingPricePaise: 100000,
                sellingPricePaise: 200000,
                floorPricePaise: 150000,
                channel: 'RENTAL',
                rentPerDayPaise: 10000,
                depositPaise: 100000,
                overduePerDayPaise: 50000,
            });

            const res = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${rentalLot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '777777777777',
                    stockIntakeLineUuid: rentalLot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(201);

            expect(res.body.data.channel).toBe('RENTAL');
            expect(res.body.data.rentPerDayPaise).toBe('10000');
            expect(res.body.data.depositPaise).toBe('100000');
            expect(res.body.data.overduePerDayPaise).toBe('50000');
        });

        it('should preserve unit prices after lot edit', async () => {
            // Scan unit at T1
            const scanRes = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '888888888888',
                    stockIntakeLineUuid: lot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(201);

            const unitUuid = scanRes.body.data.uuid;
            const originalPrice = scanRes.body.data.buyingPricePaise;

            // Edit lot prices at T2
            await request(app)
                .patch(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    buyingPricePaise: 500000,
                })
                .expect(200);

            // Fetch unit - should retain T1 price
            const getRes = await request(app)
                .get(`/api/units/${unitUuid}`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(getRes.body.data.buyingPricePaise).toBe(originalPrice);
        });
    });

    describe('GET /api/stock-intake-lines/:uuid', () => {
        it('should include unitsScannedCount in response', async () => {
            // Create a fresh lot to isolate this test from previous scans
            const freshLot = await db.StockIntakeLine.create({
                stockIntakeId: trip.id,
                productTypeId: productType.id,
                quantity: 10,
                buyingPricePaise: 100000,
                sellingPricePaise: 200000,
                floorPricePaise: 150000,
                channel: 'RETAIL',
            });

            // Scan two units into the fresh lot
            await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${freshLot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '111222333444',
                    stockIntakeLineUuid: freshLot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(201);

            await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${freshLot.uuid}/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '555666777888',
                    stockIntakeLineUuid: freshLot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(201);

            // Get fresh lot
            const res = await request(app)
                .get(`/api/stock-intakes/${trip.uuid}/lines/${freshLot.uuid}`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(res.body.data).toHaveProperty('unitsScannedCount');
            expect(res.body.data.unitsScannedCount).toBe(2);
        });
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 Unauthorized when no auth header', async () => {
            const res = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
                .send({
                    barcode: '999888777666',
                    stockIntakeLineUuid: lot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(401);

            expect(res.body.message).toContain('Authentication required');
        });

        it('should return 403 Forbidden when user lacks INVENTORY.CREATE permission', async () => {
            // Create user without permission (with CASHIER role which lacks inventory.create)
            const userData = generateTestUser({ password: 'TestPassword123!' });
            const unauthorizedUser = await db.User.create({
                username: userData.username,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                passwordHash: await argon2.hash(userData.password),
            });

            // Add CASHIER role (which does not have inventory.create permission)
            const cashierRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
            await unauthorizedUser.addRole(cashierRole);

            // Login with unauthorized user
            const unauthorizedLoginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    username: userData.username,
                    password: userData.password,
                })
                .expect(200);
            const unauthorizedToken = unauthorizedLoginRes.body.data.accessToken;

            const res = await request(app)
                .post(`/api/stock-intakes/${trip.uuid}/lines/${lot.uuid}/scan`)
                .set('Authorization', `Bearer ${unauthorizedToken}`)
                .send({
                    barcode: '111222333555',
                    stockIntakeLineUuid: lot.uuid,
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(403);

            expect(res.body.message).toContain('Forbidden');
        });
    });
});
