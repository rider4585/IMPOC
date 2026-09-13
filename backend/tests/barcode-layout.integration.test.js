import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import app from '../app.js';

import {
    sequelize,
    User,
    Role,
    UserRole,
    Permission,
    RolePermission,
    AuthSession,
    BarcodeLayout,
} from '../database/models/index.js';

import { generateAccessToken } from '../src/modules/auth/token.service.js';
import { DEFAULT_LAYOUT, computeSheetGeometry } from '../src/modules/barcode-layouts/barcode-layout.geometry.js';

/**
 * R-50: single-row barcode label layout — read / write / preview.
 */
describe('Barcode layout (R-50)', () => {
    let readerToken;
    let adminToken;

    const makeUser = async (suffix, permissionNames) => {
        const role = await Role.create({ name: `ROLE_${suffix}`, description: suffix });
        for (const name of permissionNames) {
            const [permission] = await Permission.findOrCreate({ where: { name }, defaults: { name, description: name } });
            await RolePermission.create({ roleId: role.id, permissionId: permission.id });
        }
        const user = await User.create({
            username: `layout-${suffix}`,
            email: `layout-${suffix}@example.com`,
            passwordHash: 'hashed',
            firstName: 'Layout',
            lastName: suffix,
            status: 'ACTIVE',
        });
        await UserRole.create({ userId: user.id, roleId: role.id });
        const session = await AuthSession.create({
            userId: user.id,
            refreshTokenHash: `hash-${suffix}`,
            expiresAt: new Date(Date.now() + 86400000),
        });
        return generateAccessToken({ userUuid: user.uuid, sessionUuid: session.uuid });
    };

    beforeAll(async () => {
        await sequelize.sync({ force: true });
        readerToken = await makeUser('reader', ['inventory.barcode_generate']);
        adminToken = await makeUser('admin', ['inventory.barcode_generate', 'inventory.barcode_layout_manage']);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('GET returns the default layout (creating the row on first read)', async () => {
        expect(await BarcodeLayout.count()).toBe(0);

        const response = await request(app)
            .get('/api/barcode-layouts')
            .set('Authorization', `Bearer ${readerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject(DEFAULT_LAYOUT);
        expect(typeof response.body.data.barcodeWidthMm).toBe('number');
        expect(await BarcodeLayout.count()).toBe(1);
    });

    it('PUT is refused without the layout-manage permission', async () => {
        const response = await request(app)
            .put('/api/barcode-layouts')
            .set('Authorization', `Bearer ${readerToken}`)
            .send({ ...DEFAULT_LAYOUT, barcodeWidthMm: 40 });

        expect(response.status).toBe(403);
    });

    it('PUT saves a valid layout and the next GET returns it', async () => {
        const response = await request(app)
            .put('/api/barcode-layouts')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ...DEFAULT_LAYOUT, barcodeWidthMm: 40, columns: 2, showDivider: false });

        expect(response.status).toBe(200);
        expect(response.body.data.barcodeWidthMm).toBe(40);
        expect(response.body.data.columns).toBe(2);
        expect(response.body.data.showDivider).toBe(false);

        const again = await request(app)
            .get('/api/barcode-layouts')
            .set('Authorization', `Bearer ${readerToken}`);
        expect(again.body.data.barcodeWidthMm).toBe(40);
        expect(await BarcodeLayout.count()).toBe(1);
    });

    it('PUT rejects a layout whose grid does not fit the page', async () => {
        const response = await request(app)
            .put('/api/barcode-layouts')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ...DEFAULT_LAYOUT, marginLeftMm: 100, marginRightMm: 100 });

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/Layout does not fit/);
    });

    it('PUT rejects out-of-range and unknown fields', async () => {
        const tooSmall = await request(app)
            .put('/api/barcode-layouts')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ...DEFAULT_LAYOUT, barcodeWidthMm: 2 });
        expect(tooSmall.status).toBe(400);

        const unknown = await request(app)
            .put('/api/barcode-layouts')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ...DEFAULT_LAYOUT, presetName: 'x' });
        expect(unknown.status).toBe(400);
    });

    it('GET /api/barcodes/preview renders one sample page without touching the sequence', async () => {
        await sequelize.query(
            'CREATE SEQUENCE IF NOT EXISTS public.barcode_seq AS bigint INCREMENT BY 1 START WITH 1 NO CYCLE CACHE 1 OWNED BY NONE;'
        );
        const [[before]] = await sequelize.query("SELECT last_value, is_called FROM public.barcode_seq");

        const response = await request(app)
            .get('/api/barcodes/preview')
            .set('Authorization', `Bearer ${readerToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/pdf/);
        expect(response.headers['content-disposition']).toMatch(/inline/);
        expect(Buffer.from(response.body).subarray(0, 4).toString()).toBe('%PDF');

        const [[after]] = await sequelize.query("SELECT last_value, is_called FROM public.barcode_seq");
        expect(after).toEqual(before);
    });
});

describe('computeSheetGeometry (R-50)', () => {
    it('reproduces the historic A4 3x5 sheet from the defaults', () => {
        const g = computeSheetGeometry(DEFAULT_LAYOUT);
        expect(g.perPage).toBe(15);
        expect(g.label.width).toBeCloseTo(173.86, 1);
        expect(g.label.height).toBeCloseTo(145.70, 1);
        expect(g.barcode.width).toBeCloseTo(99.21, 1);
        expect(g.problems).toEqual([]);
    });

    it('swaps page dimensions in landscape', () => {
        const g = computeSheetGeometry({ ...DEFAULT_LAYOUT, orientation: 'landscape' });
        expect(g.page.width).toBeCloseTo(841.89, 1);
        expect(g.page.height).toBeCloseTo(595.28, 1);
    });

    it('gives the info box the label remainder and flags impossible layouts', () => {
        const g = computeSheetGeometry(DEFAULT_LAYOUT);
        expect(g.codeAreaHeight + g.infoBox.height).toBeCloseTo(g.label.height, 5);

        expect(computeSheetGeometry({ ...DEFAULT_LAYOUT, columns: 10, barcodeWidthMm: 60 }).problems[0]).toMatch(/wider than the label/);
        expect(computeSheetGeometry({ ...DEFAULT_LAYOUT, rows: 10, barcodeHeightMm: 40 }).problems[0]).toMatch(/too short/);
        expect(computeSheetGeometry({ ...DEFAULT_LAYOUT, marginTopMm: 200, marginBottomMm: 200 }).problems[0]).toMatch(/does not fit/);
    });
});
