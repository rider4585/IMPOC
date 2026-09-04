import request from 'supertest';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase, createTripWithVendor, createTestStock } from '../utils/test-setup.js';
import argon2 from 'argon2';
import app from '../../app.js';

describe('Story 3.3: Scan units into a stock', () => {
    let testDb;
    let testToken;
    let trip;
    let tripVendor;
    let vendor;
    let stock;
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
        vendor = await db.Vendor.create({ name: 'Test Vendor' });

        // Create trip + trip_vendors bill
        const pair = await createTripWithVendor({
            vendor,
            name: 'TEST Scan Trip',
            totalPaidPaise: 1000000,
        });
        trip = pair.trip;
        tripVendor = pair.tripVendor;

        // Create a stock (declared quantity 5)
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
        await db.Unit.destroy({ where: { stockId: stock.id }, force: true });
        await db.Stock.destroy({ where: { id: stock.id }, force: true });
        await db.TripVendor.destroy({ where: { tripId: trip.id }, force: true });
        await db.Trip.destroy({ where: { id: trip.id }, force: true });
        await closeDatabase();
    });

    function scan(payload) {
        return request(app)
            .post(`/api/trips/${trip.uuid}/stocks/${stock.uuid}/scan`)
            .set('Authorization', `Bearer ${testToken}`)
            .send(payload);
    }

    describe('POST /api/trips/:tripUuid/stocks/:uuid/scan', () => {
        it('should scan into an open stock with valid barcode', async () => {
            const res = await scan({
                barcode: '123456789012',
                colourUuid: colour.uuid,
                sizeUuid: size.uuid,
            }).expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('uuid');
            expect(res.body.data.barcode).toBe('123456789012');
            expect(res.body.data.status).toBe('in_stock');
            expect(res.body.data.channel).toBe('RETAIL');
            expect(res.body.data.stockUuid).toBe(stock.uuid);
            expect(res.body.data.buyingPricePaise).toBe('100000');
            expect(res.body.data.sellingPricePaise).toBe('200000');
            expect(res.body.data.floorPricePaise).toBe('150000');

            // Verify UnitStatusEvent was created atomically
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
            await scan({
                barcode: '999999999999',
                colourUuid: colour.uuid,
                sizeUuid: size.uuid,
            }).expect(201);

            // Second scan with same barcode
            const res = await scan({
                barcode: '999999999999',
                colourUuid: colour.uuid,
                sizeUuid: size.uuid,
            }).expect(409);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Barcode already bound to unit');
        });

        it('should reject scan when stock has reached its declared quantity', async () => {
            // Create a new stock with quantity 1
            const smallStock = await createTestStock({
                trip,
                tripVendor,
                vendor,
                productType,
                overrides: {
                    quantity: 1,
                    buyingPricePaise: 100000,
                    sellingPricePaise: 200000,
                    floorPricePaise: 150000,
                    channel: 'RETAIL',
                },
            });

            try {
                // Scan one unit
                await request(app)
                    .post(`/api/trips/${trip.uuid}/stocks/${smallStock.uuid}/scan`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({
                        barcode: '111111111111',
                        colourUuid: colour.uuid,
                        sizeUuid: size.uuid,
                    })
                    .expect(201);

                // Try to scan another
                const res = await request(app)
                    .post(`/api/trips/${trip.uuid}/stocks/${smallStock.uuid}/scan`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({
                        barcode: '222222222222',
                        colourUuid: colour.uuid,
                        sizeUuid: size.uuid,
                    })
                    .expect(400);

                expect(res.body.message).toContain('Stock has reached its declared quantity of 1');
            } finally {
                await db.Unit.destroy({ where: { stockId: smallStock.id }, force: true });
                await db.Stock.destroy({ where: { id: smallStock.id }, force: true });
            }
        });

        it('should reject scan with inactive colour', async () => {
            const inactiveColour = await db.Colour.create({
                name: 'Inactive',
                hexValue: '#000000',
                isActive: false,
            });

            const res = await scan({
                barcode: '333333333333',
                colourUuid: inactiveColour.uuid,
                sizeUuid: size.uuid,
            }).expect(400);

            expect(res.body.message).toContain('Colour is inactive');
        });

        it('should reject scan with inactive size', async () => {
            const inactiveSize = await db.Size.create({
                name: 'Inactive',
                isActive: false,
            });

            const res = await scan({
                barcode: '444444444444',
                colourUuid: colour.uuid,
                sizeUuid: inactiveSize.uuid,
            }).expect(400);

            expect(res.body.message).toContain('Size is inactive');
        });

        it('should return 404 when colour UUID not found', async () => {
            const res = await scan({
                barcode: '555555555555',
                colourUuid: '00000000-0000-0000-0000-000000000000',
                sizeUuid: size.uuid,
            }).expect(404);

            expect(res.body.message).toContain('Colour not found');
        });

        it('should return 404 when size UUID not found', async () => {
            const res = await scan({
                barcode: '666666666666',
                colourUuid: colour.uuid,
                sizeUuid: '00000000-0000-0000-0000-000000000000',
            }).expect(404);

            expect(res.body.message).toContain('Size not found');
        });

        it('should return 404 when stock UUID not found', async () => {
            const res = await request(app)
                .post(`/api/trips/${trip.uuid}/stocks/00000000-0000-0000-0000-000000000000/scan`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    barcode: '555555555556',
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(404);

            expect(res.body.message).toContain('Stock not found');
        });

        it('should scan into a RENTAL stock with pricing snapshot', async () => {
            const rentalStock = await createTestStock({
                trip,
                tripVendor,
                vendor,
                productType,
                overrides: {
                    quantity: 5,
                    buyingPricePaise: 100000,
                    sellingPricePaise: 200000,
                    floorPricePaise: 150000,
                    channel: 'RENTAL',
                    rentPerDayPaise: 10000,
                    depositPaise: 100000,
                    overduePerDayPaise: 50000,
                },
            });

            try {
                const res = await request(app)
                    .post(`/api/trips/${trip.uuid}/stocks/${rentalStock.uuid}/scan`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({
                        barcode: '777777777777',
                        colourUuid: colour.uuid,
                        sizeUuid: size.uuid,
                    })
                    .expect(201);

                expect(res.body.data.channel).toBe('RENTAL');
                expect(res.body.data.rentPerDayPaise).toBe('10000');
                expect(res.body.data.depositPaise).toBe('100000');
                expect(res.body.data.overduePerDayPaise).toBe('50000');
            } finally {
                await db.Unit.destroy({ where: { stockId: rentalStock.id }, force: true });
                await db.Stock.destroy({ where: { id: rentalStock.id }, force: true });
            }
        });

        it('should preserve unit prices after stock edit', async () => {
            // Scan unit at T1
            const scanRes = await scan({
                barcode: '888888888888',
                colourUuid: colour.uuid,
                sizeUuid: size.uuid,
            }).expect(201);

            const unitUuid = scanRes.body.data.uuid;
            const originalPrice = scanRes.body.data.buyingPricePaise;

            // Edit stock prices at T2
            await request(app)
                .patch(`/api/trips/${trip.uuid}/stocks/${stock.uuid}`)
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

    describe('GET /api/trips/:tripUuid/stocks/:uuid', () => {
        it('should include unitsScannedCount in response', async () => {
            // Create a fresh stock to isolate this test from previous scans
            const freshStock = await createTestStock({
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

            try {
                // Scan two units into the fresh stock
                await request(app)
                    .post(`/api/trips/${trip.uuid}/stocks/${freshStock.uuid}/scan`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({
                        barcode: '111222333444',
                        colourUuid: colour.uuid,
                        sizeUuid: size.uuid,
                    })
                    .expect(201);

                await request(app)
                    .post(`/api/trips/${trip.uuid}/stocks/${freshStock.uuid}/scan`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({
                        barcode: '555666777888',
                        colourUuid: colour.uuid,
                        sizeUuid: size.uuid,
                    })
                    .expect(201);

                // Get fresh stock
                const res = await request(app)
                    .get(`/api/trips/${trip.uuid}/stocks/${freshStock.uuid}`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .expect(200);

                expect(res.body.data).toHaveProperty('unitsScannedCount');
                expect(res.body.data.unitsScannedCount).toBe(2);
            } finally {
                await db.Unit.destroy({ where: { stockId: freshStock.id }, force: true });
                await db.Stock.destroy({ where: { id: freshStock.id }, force: true });
            }
        });
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 Unauthorized when no auth header', async () => {
            const res = await request(app)
                .post(`/api/trips/${trip.uuid}/stocks/${stock.uuid}/scan`)
                .send({
                    barcode: '999888777666',
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
                .post(`/api/trips/${trip.uuid}/stocks/${stock.uuid}/scan`)
                .set('Authorization', `Bearer ${unauthorizedToken}`)
                .send({
                    barcode: '111222333555',
                    colourUuid: colour.uuid,
                    sizeUuid: size.uuid,
                })
                .expect(403);

            expect(res.body.message).toContain('Forbidden');
        });
    });
});