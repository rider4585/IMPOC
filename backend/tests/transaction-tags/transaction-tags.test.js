import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import argon2 from 'argon2';
import * as db from '../../database/models/index.js';
import {
    initializeTestDatabase,
    generateTestUser,
    closeDatabase,
    createTripWithVendor,
    createTestStock,
} from '../utils/test-setup.js';
import app from '../../app.js';

/**
 * R-73: transaction_tags picklist (name + showOnPos + isDefault) and the
 * exhibition/expo labels a retail sale carries.
 */
describe('Transaction tags picklist (R-73)', () => {
    let managerToken;
    let cashierToken;
    let expo;
    let defaultTag;
    let trip;
    let tripVendor;
    let vendor;
    let stock;
    let colour;
    let size;
    let productType;
    const createdStockIds = [];
    let barcodeSeq = 0;

    async function makeSellableUnit() {
        barcodeSeq += 1;
        const unitStock = await createTestStock({
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
        createdStockIds.push(unitStock.id);
        return db.Unit.create({
            barcode: `R73T${String(barcodeSeq).padStart(8, '0')}`,
            stockId: unitStock.id,
            colourId: colour.id,
            sizeId: size.id,
            status: 'in_stock',
            channel: 'RETAIL',
            buyingPricePaise: 100000,
            sellingPricePaise: 200000,
            floorPricePaise: 150000,
        });
    }

    async function checkout({ tagUuids }) {
        const unit = await makeSellableUnit();
        const res = await request(app)
            .post('/api/sales')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit.uuid }], tagUuids })
            .expect(201);
        return res.body.data;
    }

    beforeAll(async () => {
        await initializeTestDatabase();

        // MANAGER holds picklists.create/update + sales.create.
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

        // CASHIER has neither picklists.create nor picklists.update.
        const cashData = generateTestUser({ password: 'TestPassword123!' });
        const cashier = await db.User.create({
            username: cashData.username,
            firstName: cashData.firstName,
            lastName: cashData.lastName,
            email: cashData.email,
            passwordHash: await argon2.hash(cashData.password),
        });
        const cashRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
        await cashier.addRole(cashRole);
        const cashLogin = await request(app)
            .post('/api/auth/login')
            .send({ username: cashData.username, password: cashData.password });
        cashierToken = cashLogin.body.data.accessToken;

        colour = await db.Colour.create({ name: `C${Date.now()}`, hexValue: '#00FF00', isActive: true });
        size = await db.Size.create({ name: `S${Date.now()}`, isActive: true });
        productType = await db.ProductType.create({ name: `PT_R73_${Date.now()}` });
        vendor = await db.Vendor.create({ name: `V_R73_${Date.now()}` });
        const pair = await createTripWithVendor({
            vendor,
            name: `TEST R73 Trip ${Date.now()}`,
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
                quantity: 1,
                buyingPricePaise: 100000,
                sellingPricePaise: 200000,
                floorPricePaise: 150000,
                channel: 'RETAIL',
            },
        });
        createdStockIds.push(stock.id);
    });

    afterAll(async () => {
        await db.User.destroy({
            where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } },
        });
        await db.TransactionTag.destroy({ where: {}, force: true });
        await db.Unit.destroy({ where: { stockId: { [db.Sequelize.Op.in]: createdStockIds } }, force: true });
        await db.Stock.destroy({ where: { id: { [db.Sequelize.Op.in]: createdStockIds } }, force: true });
        await db.TripVendor.destroy({ where: { tripId: trip.id }, force: true });
        await db.Trip.destroy({ where: { id: trip.id }, force: true });
        await closeDatabase();
    });

    describe('picklist CRUD', () => {
        it('requires auth', async () => {
            await request(app).get('/api/picklists/transaction-tags').expect(401);
            await request(app)
                .post('/api/picklists/transaction-tags')
                .send({ name: 'No Auth Expo' })
                .expect(401);
        });

        it('forbids a user without picklists.create / .update', async () => {
            await request(app)
                .post('/api/picklists/transaction-tags')
                .set('Authorization', `Bearer ${cashierToken}`)
                .send({ name: 'Cashier Expo' })
                .expect(403);
        });

        it('creates a tag with the two POS booleans', async () => {
            const res = await request(app)
                .post('/api/picklists/transaction-tags')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ name: 'Bengaluru Expo', showOnPos: true, isDefault: true })
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(Object.keys(res.body.data).sort()).toEqual(
                ['isActive', 'isDefault', 'name', 'showOnPos', 'uuid'].sort()
            );
            expect(res.body.data).toMatchObject({
                name: 'Bengaluru Expo',
                isActive: true,
                showOnPos: true,
                isDefault: true,
            });
            expo = res.body.data;
        });

        it('defaults showOnPos/isDefault to false and rejects a blank name', async () => {
            const res = await request(app)
                .post('/api/picklists/transaction-tags')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ name: 'Wedding Season' })
                .expect(201);
            expect(res.body.data).toMatchObject({
                name: 'Wedding Season',
                isActive: true,
                showOnPos: false,
                isDefault: false,
            });

            const blank = await request(app)
                .post('/api/picklists/transaction-tags')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ name: '   ' })
                .expect(400);
            expect(blank.body.errors[0].field).toBe('name');
        });

        it('rejects a duplicate active name but allows reuse after deactivation', async () => {
            const dup = await request(app)
                .post('/api/picklists/transaction-tags')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ name: 'Bengaluru Expo' })
                .expect(409);
            expect(dup.body.message).toMatch(/already exists/i);

            await request(app)
                .patch(`/api/picklists/transaction-tags/${expo.uuid}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ isActive: false })
                .expect(200);

            const reused = await request(app)
                .post('/api/picklists/transaction-tags')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ name: 'Bengaluru Expo' })
                .expect(201);

            defaultTag = reused.body.data;
        });

        it('lists and fetches by uuid', async () => {
            const list = await request(app)
                .get('/api/picklists/transaction-tags')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);
            const names = list.body.data.map((t) => t.name);
            expect(names).toContain('Wedding Season');
            expect(names).toContain('Bengaluru Expo');

            const one = await request(app)
                .get(`/api/picklists/transaction-tags/${defaultTag.uuid}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);
            expect(one.body.data).toMatchObject({ uuid: defaultTag.uuid, name: 'Bengaluru Expo' });

            await request(app)
                .get('/api/picklists/transaction-tags/00000000-0000-4000-8000-000000000000')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(404);
        });

        it('updates both booleans and renames', async () => {
            const res = await request(app)
                .patch(`/api/picklists/transaction-tags/${defaultTag.uuid}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ name: 'Bengaluru Expo 2026', showOnPos: true, isDefault: true })
                .expect(200);

            expect(res.body.data).toMatchObject({
                uuid: defaultTag.uuid,
                name: 'Bengaluru Expo 2026',
                showOnPos: true,
                isDefault: true,
            });

            const empty = await request(app)
                .patch(`/api/picklists/transaction-tags/${defaultTag.uuid}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({})
                .expect(400);
            expect(empty.body.message).toMatch(/At least one field is required/);
        });
    });

    describe('tags on a sale', () => {
        let weddingSeason;
        let expoSale;

        beforeAll(async () => {
            const res = await request(app)
                .post('/api/picklists/transaction-tags')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ name: 'Wedding Season Tags', showOnPos: true })
                .expect(201);
            weddingSeason = res.body.data;
        });

        it('persists tags and returns them on the sale DTO', async () => {
            const sale = await checkout({ tagUuids: [defaultTag.uuid, weddingSeason.uuid] });

            expect(sale.tags).toEqual([
                { uuid: defaultTag.uuid, name: 'Bengaluru Expo 2026' },
                { uuid: weddingSeason.uuid, name: 'Wedding Season Tags' },
            ]);

            const saleRow = await db.Sale.findOne({ where: { uuid: sale.uuid } });
            const rows = await db.SaleTag.findAll({ where: { saleId: saleRow.id } });
            expect(rows).toHaveLength(2);

            const reloaded = await request(app)
                .get(`/api/sales/${sale.uuid}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);
            expect(reloaded.body.data.tags).toHaveLength(2);
        });

        it('allows an untagged sale', async () => {
            const sale = await checkout({ tagUuids: undefined });
            expect(sale.tags).toEqual([]);
            expoSale = sale;
            expect(expoSale.uuid).toBeTruthy();
        });

        it('rejects an unknown tagUuid with 400', async () => {
            const badUuid = uuidv4();
            const unit = await makeSellableUnit();

            const res = await request(app)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit.uuid }], tagUuids: [badUuid] })
                .expect(400);

            expect(res.body.message).toMatch(/not in the transaction tags picklist/);
            // SEC-M-7: the offending uuid is deliberately NOT echoed to the client
            // (the error middleware masks any allow-listed message that embeds a
            // row uuid). It rides on error.badTagUuid and is logged server-side,
            // which is what the contract's "message naming the bad uuid" has to
            // degrade to here.
            expect(res.body.message).not.toContain(badUuid);
            // The whole checkout rolled back: no sale and the unit stays sellable.
            const rows = await db.SaleLine.count({ where: { unitUuid: unit.uuid } });
            expect(rows).toBe(0);
            const stillInStock = await db.Unit.findOne({ where: { uuid: unit.uuid } });
            expect(stillInStock.status).toBe('in_stock');
        });

        it('rejects a deactivated tagUuid with 400', async () => {
            const inactive = await db.TransactionTag.create({
                name: `Retired Expo ${Date.now()}`,
                isActive: false,
            });

            const unit = await makeSellableUnit();
            const res = await request(app)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit.uuid }], tagUuids: [inactive.uuid] })
                .expect(400);

            expect(res.body.message).toMatch(/not in the transaction tags picklist/);
        });

        it('rejects a malformed or over-long tagUuids list', async () => {
            const unit = await makeSellableUnit();
            await request(app)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ requestUuid: uuidv4(), items: [{ unitUuid: unit.uuid }], tagUuids: ['not-a-uuid'] })
                .expect(400);

            const many = await request(app)
                .post('/api/sales')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    requestUuid: uuidv4(),
                    items: [{ unitUuid: unit.uuid }],
                    tagUuids: Array.from({ length: 21 }, () => uuidv4()),
                })
                .expect(400);
            expect(many.body.message).toMatch(/At most 20 tags/);
        });
    });
});