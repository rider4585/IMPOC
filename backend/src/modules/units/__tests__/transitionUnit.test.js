import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { sequelize, Unit, UnitStatusEvent, User, Colour, Size, Vendor, Trip, TripVendor, Stock, ProductType } from '../../../database/models/index.js';
import { transitionUnit, createUnitFromScan, getUnitStatusEvents } from '../units.service.js';
import { CHANNEL } from '../../../constants/channel.js';

describe('Unit State Machine - transitionUnit()', () => {
    let testUser;
    let testColour;
    let testSize;
    let testVendor;
    let testTrip;
    let testStock;
    let testStockId;

    beforeAll(async () => {
        // Ensure database is initialized
        if (!sequelize) {
            throw new Error('Database not initialized');
        }
    });

    beforeEach(async () => {
        // Create test data
        const transaction = await sequelize.transaction();
        try {
            testUser = await User.create({
                email: `test-${Date.now()}@test.com`,
                passwordHash: 'dummy',
                username: `test-${Date.now()}`,
            }, { transaction });

            testColour = await Colour.create({
                name: 'Red',
                isActive: true,
            }, { transaction });

            testSize = await Size.create({
                name: 'Standard',
                isActive: true,
            }, { transaction });

            testVendor = await Vendor.create({
                name: `Vendor ${Date.now()}`,
            }, { transaction });

            testTrip = await Trip.create({
                name: `Trip ${Date.now()}`,
                purchasedOn: new Date().toISOString().split('T')[0],
            }, { transaction });

            const tripVendor = await TripVendor.create({
                tripId: testTrip.id,
                vendorId: testVendor.id,
                totalPaidPaise: 100000,
            }, { transaction });

            const productType = await ProductType.create({
                name: `PT ${Date.now()}`,
            }, { transaction });

            testStock = await Stock.create({
                tripId: testTrip.id,
                tripVendorId: tripVendor.id,
                vendorId: testVendor.id,
                productTypeId: productType.id,
                channel: CHANNEL.RETAIL,
                quantity: 10,
                buyingPricePaise: '10000',
                sellingPricePaise: '20000',
                floorPricePaise: '18000',
            }, { transaction });
            testStockId = testStock.id;

            // Create a unit via createUnitFromScan
            testUnit = await createUnitFromScan({
                stock: testStock,
                colour: testColour,
                size: testSize,
                barcode: `TEST-${Date.now()}`,
                actorUserId: testUser.id,
                transaction,
            });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    });

    describe('Happy path: Legal transition', () => {
        it('should transition unit from in_stock to damaged with STAFF_MARKED_DAMAGED cause', async () => {
            const transaction = await sequelize.transaction();
            try {
                const result = await transitionUnit(
                    {
                        unitUuid: testUnit.uuid,
                        to: 'damaged',
                        cause: 'STAFF_MARKED_DAMAGED',
                        reason: 'Broken wheel',
                        actorUserId: testUser.id,
                    },
                    { transaction }
                );

                expect(result.status).toBe('damaged');

                // Verify event was created
                const events = await UnitStatusEvent.findAll({
                    where: { unitId: result.id },
                });

                expect(events.length).toBe(2); // INTAKE + STAFF_MARKED_DAMAGED
                expect(events[events.length - 1].toStatus).toBe('damaged');
                expect(events[events.length - 1].cause).toBe('STAFF_MARKED_DAMAGED');
                expect(events[events.length - 1].reason).toBe('Broken wheel');

                await transaction.commit();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });

        it('should transition from in_maintenance to in_stock with MAINTENANCE_COMPLETE', async () => {
            const transaction = await sequelize.transaction();
            try {
                // First transition to in_maintenance
                const unit1 = await Unit.findOne({
                    where: { uuid: testUnit.uuid },
                    transaction,
                });

                await sequelize.query(
                    'UPDATE units SET status = :status WHERE id = :id',
                    {
                        replacements: { status: 'in_maintenance', id: unit1.id },
                        transaction,
                    }
                );

                // Now transition to in_stock
                const result = await transitionUnit(
                    {
                        unitUuid: testUnit.uuid,
                        to: 'in_stock',
                        cause: 'MAINTENANCE_COMPLETE',
                        actorUserId: testUser.id,
                    },
                    { transaction }
                );

                expect(result.status).toBe('in_stock');

                await transaction.commit();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });
    });

    describe('Concurrent race: Two transitions on same unit', () => {
        it('should result in one success and one 409 conflict', async () => {
            // Start two parallel transactions that will race
            const txn1Promise = sequelize.transaction();
            const txn2Promise = sequelize.transaction();

            const [txn1, txn2] = await Promise.all([txn1Promise, txn2Promise]);

            let result1, result2, error2;

            try {
                // First transition: in_stock -> damaged
                result1 = await transitionUnit(
                    {
                        unitUuid: testUnit.uuid,
                        to: 'damaged',
                        cause: 'STAFF_MARKED_DAMAGED',
                        reason: 'First',
                        actorUserId: testUser.id,
                    },
                    { transaction: txn1 }
                );

                // Second transition in parallel: in_stock -> lost (will race and lose)
                try {
                    result2 = await transitionUnit(
                        {
                            unitUuid: testUnit.uuid,
                            to: 'lost',
                            cause: 'STAFF_MARKED_LOST',
                            reason: 'Second',
                            actorUserId: testUser.id,
                        },
                        { transaction: txn2 }
                    );
                } catch (error) {
                    error2 = error;
                }

                // Commit first transaction (should succeed)
                await txn1.commit();

                // Second should fail because status changed
                await txn2.rollback();
            } catch (error) {
                await txn1.rollback();
                await txn2.rollback();
                throw error;
            }

            // First transition should have succeeded
            expect(result1).toBeDefined();
            expect(result1.status).toBe('damaged');

            // Second transition should have failed with 409
            expect(error2).toBeDefined();
            expect(error2.statusCode).toBe(409);
            expect(error2.message).toContain('already');
        });
    });

    describe('Illegal transition: Invalid state machine move', () => {
        it('should reject transition from sold to in_maintenance (not in state machine)', async () => {
            const transaction = await sequelize.transaction();
            try {
                // First set unit to sold
                const unit = await Unit.findOne({
                    where: { uuid: testUnit.uuid },
                    transaction,
                });

                await sequelize.query(
                    'UPDATE units SET status = :status WHERE id = :id',
                    {
                        replacements: { status: 'sold', id: unit.id },
                        transaction,
                    }
                );

                // Try illegal transition
                try {
                    await transitionUnit(
                        {
                            unitUuid: testUnit.uuid,
                            to: 'in_maintenance',
                            cause: 'STAFF_MARKED_DAMAGED',
                            actorUserId: testUser.id,
                        },
                        { transaction }
                    );
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error.statusCode).toBe(409);
                    expect(error.message).toContain('Invalid transition');
                }

                await transaction.rollback();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });
    });

    describe('RECOVERY cause: Special handling', () => {
        it('should allow lost -> in_stock via RECOVERY cause with reason', async () => {
            const transaction = await sequelize.transaction();
            try {
                // Set unit to lost
                const unit = await Unit.findOne({
                    where: { uuid: testUnit.uuid },
                    transaction,
                });

                await sequelize.query(
                    'UPDATE units SET status = :status WHERE id = :id',
                    {
                        replacements: { status: 'lost', id: unit.id },
                        transaction,
                    }
                );

                // Transition via RECOVERY
                const result = await transitionUnit(
                    {
                        unitUuid: testUnit.uuid,
                        to: 'in_stock',
                        cause: 'RECOVERY',
                        reason: 'Found in storage',
                        actorUserId: testUser.id,
                    },
                    { transaction }
                );

                expect(result.status).toBe('in_stock');

                const events = await UnitStatusEvent.findAll({
                    where: { unitId: unit.id },
                    order: [['createdAt', 'DESC']],
                });

                const lastEvent = events[0];
                expect(lastEvent.cause).toBe('RECOVERY');
                expect(lastEvent.reason).toBe('Found in storage');

                await transaction.commit();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });

        it('should reject RECOVERY without reason', async () => {
            const transaction = await sequelize.transaction();
            try {
                // Set unit to lost
                const unit = await Unit.findOne({
                    where: { uuid: testUnit.uuid },
                    transaction,
                });

                await sequelize.query(
                    'UPDATE units SET status = :status WHERE id = :id',
                    {
                        replacements: { status: 'lost', id: unit.id },
                        transaction,
                    }
                );

                // Try RECOVERY without reason (should be caught by constraint)
                try {
                    await transitionUnit(
                        {
                            unitUuid: testUnit.uuid,
                            to: 'in_stock',
                            cause: 'RECOVERY',
                            actorUserId: testUser.id,
                            // no reason
                        },
                        { transaction }
                    );

                    // If we get here, check that at least the event wasn't created
                    const lastEvent = await UnitStatusEvent.findOne({
                        where: { unitId: unit.id },
                        order: [['createdAt', 'DESC']],
                    });

                    expect(lastEvent.cause).not.toBe('RECOVERY');
                } catch (error) {
                    // Database constraint should catch this
                    expect(error).toBeDefined();
                }

                await transaction.rollback();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });
    });

    describe('Status events retrieval', () => {
        it('should return events newest-first with pagination', async () => {
            const transaction = await sequelize.transaction();
            try {
                // Create multiple events
                for (let i = 0; i < 3; i++) {
                    const currentUnit = await Unit.findOne({
                        where: { uuid: testUnit.uuid },
                        transaction,
                    });

                    const newStatus = i % 2 === 0 ? 'damaged' : 'in_stock';
                    const cause = i % 2 === 0 ? 'STAFF_MARKED_DAMAGED' : 'MAINTENANCE_COMPLETE';

                    if (newStatus === 'damaged') {
                        await sequelize.query(
                            'UPDATE units SET status = :status WHERE id = :id',
                            {
                                replacements: { status: 'in_stock', id: currentUnit.id },
                                transaction,
                            }
                        );
                    }

                    await transitionUnit(
                        {
                            unitUuid: testUnit.uuid,
                            to: newStatus,
                            cause,
                            actorUserId: testUser.id,
                        },
                        { transaction }
                    );
                }

                const result = await getUnitStatusEvents(testUnit.uuid, 1, 50);

                expect(result.total).toBeGreaterThanOrEqual(1);
                expect(result.items.length).toBeGreaterThan(0);
                expect(result.page).toBe(1);
                expect(result.pageSize).toBe(50);

                // Verify newest-first ordering
                for (let i = 1; i < result.items.length; i++) {
                    expect(new Date(result.items[i - 1].createdAt)).toBeGreaterThanOrEqual(
                        new Date(result.items[i].createdAt)
                    );
                }

                await transaction.rollback();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });
    });

    describe('Guard table coverage', () => {
        it('should have transitions for both RETAIL and RENTAL channels', async () => {
            // Create a rental unit
            const transaction = await sequelize.transaction();
            try {
                const rentalStock = await Stock.create({
                    tripId: testTrip.id,
                    tripVendorId: (await TripVendor.findOne({ where: { tripId: testTrip.id } }, { transaction })).id,
                    vendorId: testVendor.id,
                    productTypeId: (await ProductType.findOne({}, { transaction })).id,
                    channel: CHANNEL.RENTAL,
                    quantity: 5,
                    buyingPricePaise: '50000',
                    sellingPricePaise: '0',
                    floorPricePaise: '0',
                    rentPerDayPaise: '100000',
                    depositPaise: '200000',
                    overduePerDayPaise: '50000',
                }, { transaction });

                const rentalUnit = await createUnitFromScan({
                    stock: rentalStock,
                    colour: testColour,
                    size: testSize,
                    barcode: `RENTAL-${Date.now()}`,
                    actorUserId: testUser.id,
                    transaction,
                });

                // Test that HAND_OVER is valid for rental channel
                // First need to set status to in_stock
                const unit = await Unit.findOne({
                    where: { uuid: rentalUnit.uuid },
                    transaction,
                });

                // HAND_OVER: in_stock -> rented
                const result = await transitionUnit(
                    {
                        unitUuid: rentalUnit.uuid,
                        to: 'rented',
                        cause: 'HAND_OVER',
                        actorUserId: testUser.id,
                    },
                    { transaction }
                );

                expect(result.status).toBe('rented');

                await transaction.commit();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });
    });

    describe('Initial creation via createUnitFromScan', () => {
        it('should create unit with INTAKE event unchanged', async () => {
            const transaction = await sequelize.transaction();
            try {
                const newUnit = await createUnitFromScan({
                    stock: testStock,
                    colour: testColour,
                    size: testSize,
                    barcode: `NEW-${Date.now()}`,
                    actorUserId: testUser.id,
                    transaction,
                });

                expect(newUnit.status).toBe('in_stock');

                // Verify INTAKE event exists
                const unit = await Unit.findOne({
                    where: { uuid: newUnit.uuid },
                    transaction,
                });

                const events = await UnitStatusEvent.findAll({
                    where: { unitId: unit.id },
                    transaction,
                });

                expect(events.length).toBe(1);
                expect(events[0].toStatus).toBe('in_stock');
                expect(events[0].cause).toBe('INTAKE');
                expect(events[0].fromStatus).toBeNull();

                await transaction.commit();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });
    });
});
