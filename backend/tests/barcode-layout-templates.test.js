import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import app from '../app.js';

import { sequelize, User, Role, UserRole, Permission, RolePermission, AuthSession } from '../database/models/index.js';

import { generateAccessToken } from '../src/modules/auth/token.service.js';
import { DEFAULT_LAYOUT, computeSheetGeometry } from '../src/modules/barcode-layouts/barcode-layout.geometry.js';
describe('R-56: custom page sizes + layout templates', () => {
    let readerToken;
    let adminToken;

    const makeUser = async (suffix, permissionNames) => {
        const role = await Role.create({ name: `ROLE56_${suffix}`, description: suffix });
        for (const name of permissionNames) {
            const [permission] = await Permission.findOrCreate({ where: { name }, defaults: { name, description: name } });
            await RolePermission.create({ roleId: role.id, permissionId: permission.id });
        }
        const user = await User.create({
            username: `layout56-${suffix}`, email: `layout56-${suffix}@example.com`, passwordHash: 'hashed',
            firstName: 'Layout', lastName: suffix, status: 'ACTIVE',
        });
        await UserRole.create({ userId: user.id, roleId: role.id });
        const session = await AuthSession.create({ userId: user.id, refreshTokenHash: `hash56-${suffix}`, expiresAt: new Date(Date.now() + 86400000) });
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

    const custom4x6 = { ...DEFAULT_LAYOUT, pageSize: 'CUSTOM', pageCustomWidthMm: 101.6, pageCustomHeightMm: 152.4, columns: 2, rows: 3, marginTopMm: 4, marginRightMm: 4, marginBottomMm: 4, marginLeftMm: 4, gapHorizontalMm: 3, gapVerticalMm: 3 };

    it('saves an A3 layout and a custom 4x6 inch layout (stored in mm)', async () => {
        const a3 = await request(app).put('/api/barcode-layouts').set('Authorization', `Bearer ${adminToken}`).send({ ...DEFAULT_LAYOUT, pageSize: 'A3', columns: 5, rows: 8 });
        expect(a3.statusCode).toBe(200);
        expect(a3.body.data.pageSize).toBe('A3');

        const custom = await request(app).put('/api/barcode-layouts').set('Authorization', `Bearer ${adminToken}`).send(custom4x6);
        expect(custom.statusCode).toBe(200);
        expect(custom.body.data).toMatchObject({ pageSize: 'CUSTOM', pageCustomWidthMm: 101.6, pageCustomHeightMm: 152.4 });

        const preview = await request(app).get('/api/barcodes/preview').set('Authorization', `Bearer ${readerToken}`);
        expect(preview.statusCode).toBe(200);
        expect(Buffer.from(preview.body).subarray(0, 4).toString()).toBe('%PDF');
    });

    it('rejects a custom page outside 50..2000 mm', async () => {
        const res = await request(app).put('/api/barcode-layouts').set('Authorization', `Bearer ${adminToken}`).send({ ...custom4x6, pageCustomWidthMm: 10 });
        expect(res.statusCode).toBe(400);
    });

    it('templates: create (manage perm), list (read perm), duplicate name 409, delete', async () => {
        const denied = await request(app).post('/api/barcode-layouts/templates').set('Authorization', `Bearer ${readerToken}`).send({ name: 'Roll 4x6', layout: custom4x6 });
        expect(denied.statusCode).toBe(403);

        const created = await request(app).post('/api/barcode-layouts/templates').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Roll 4x6', layout: custom4x6 });
        expect(created.statusCode).toBe(201);
        expect(created.body.data).toMatchObject({ name: 'Roll 4x6', layout: expect.objectContaining({ pageSize: 'CUSTOM', columns: 2 }) });

        const dup = await request(app).post('/api/barcode-layouts/templates').set('Authorization', `Bearer ${adminToken}`).send({ name: 'roll 4X6', layout: custom4x6 });
        expect(dup.statusCode).toBe(409);

        const unfit = await request(app).post('/api/barcode-layouts/templates').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Broken', layout: { ...DEFAULT_LAYOUT, marginLeftMm: 100, marginRightMm: 100 } });
        expect(unfit.statusCode).toBe(400);

        const list = await request(app).get('/api/barcode-layouts/templates').set('Authorization', `Bearer ${readerToken}`);
        expect(list.statusCode).toBe(200);
        expect(list.body.data.map((t) => t.name)).toEqual(['Roll 4x6']);

        const del = await request(app).delete(`/api/barcode-layouts/templates/${created.body.data.uuid}`).set('Authorization', `Bearer ${adminToken}`);
        expect(del.statusCode).toBe(200);
        const after = await request(app).get('/api/barcode-layouts/templates').set('Authorization', `Bearer ${readerToken}`);
        expect(after.body.data).toEqual([]);

        const missing = await request(app).delete(`/api/barcode-layouts/templates/${created.body.data.uuid}`).set('Authorization', `Bearer ${adminToken}`);
        expect(missing.statusCode).toBe(404);
    });
});

describe('computeSheetGeometry: page sizes (R-56)', () => {
    it('knows A3 and resolves CUSTOM from mm', () => {
        expect(computeSheetGeometry({ ...DEFAULT_LAYOUT, pageSize: 'A3' }).page).toEqual({ width: 841.89, height: 1190.55 });
        const g = computeSheetGeometry({ ...DEFAULT_LAYOUT, pageSize: 'CUSTOM', pageCustomWidthMm: 254, pageCustomHeightMm: 127 });
        expect(g.page.width).toBeCloseTo(720, 1);   // 10 in
        expect(g.page.height).toBeCloseTo(360, 1);  // 5 in
        expect(computeSheetGeometry({ ...DEFAULT_LAYOUT, pageSize: 'CUSTOM', pageCustomWidthMm: 5000, pageCustomHeightMm: 100 }).problems[0]).toMatch(/Custom page size/);
    });
});

describe('grid size is bounded by fit, not by a 10-row cap', () => {
    it('validates a 4 x 14 A3 sheet as fitting and rejects the same on A5 as too short', () => {
        const tall = computeSheetGeometry({ ...DEFAULT_LAYOUT, pageSize: 'A3', columns: 4, rows: 14 });
        expect(tall.problems).toEqual([]);
        expect(tall.perPage).toBe(56);
        const cramped = computeSheetGeometry({ ...DEFAULT_LAYOUT, pageSize: 'A5', columns: 4, rows: 14 });
        expect(cramped.problems.length).toBeGreaterThan(0);
    });
});
