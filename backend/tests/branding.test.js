import request from 'supertest';
import * as db from '../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase } from './utils/test-setup.js';
import argon2 from 'argon2';
import app from '../app.js';
import { getShopName } from '../src/modules/branding/branding.service.js';

/** R-58: shop name + logo, public read, admin-only write. */
describe('Branding (R-58)', () => {
    let adminToken;
    let managerToken;
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    // A dedicated role instead of ADMIN: the shared test DB's SEC-CR-2 suite counts active admins.
    const login = async (roleName) => {
        const userData = generateTestUser({ password: 'TestPassword123!' });
        const user = await db.User.create({ username: userData.username, firstName: userData.firstName, lastName: userData.lastName, email: userData.email, passwordHash: await argon2.hash(userData.password) });
        let role = await db.Role.findOne({ where: { name: roleName } });
        if (!role) {
            role = await db.Role.create({ name: roleName, description: roleName });
            const [perm] = await db.Permission.findOrCreate({ where: { name: 'branding.manage' }, defaults: { name: 'branding.manage', description: 'brand' } });
            await db.RolePermission.create({ roleId: role.id, permissionId: perm.id });
        }
        await user.addRole(role);
        const res = await request(app).post('/api/auth/login').send({ username: userData.username, password: userData.password });
        return res.body.data.accessToken;
    };

    beforeAll(async () => {
        await initializeTestDatabase();
        adminToken = await login('BRAND_MANAGER_TEST');
        managerToken = await login('MANAGER');
    });

    afterAll(async () => {
        await db.sequelize.query("DELETE FROM app_settings WHERE key IN ('shop_name','shop_logo')");
        await db.User.destroy({ where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } } });
        await closeDatabase();
    });

    it('GET is public and falls back to the default name with no logo', async () => {
        const res = await request(app).get('/api/branding');
        expect(res.statusCode).toBe(200);
        expect(res.body.data.shopName).toBeTruthy();
        expect(res.body.data.logoDataUrl).toBeNull();
    });

    it('PUT needs branding.manage', async () => {
        const anon = await request(app).put('/api/branding').send({ shopName: 'X' });
        expect(anon.statusCode).toBe(401);
        const mgr = await request(app).put('/api/branding').set('Authorization', `Bearer ${managerToken}`).send({ shopName: 'X' });
        expect(mgr.statusCode).toBe(403);
    });

    it('admin sets name + logo; receipts pick up the name; logo can be removed', async () => {
        const set = await request(app).put('/api/branding').set('Authorization', `Bearer ${adminToken}`).send({ shopName: '  Shree Fashion Hub  ', logoDataUrl: tinyPng });
        expect(set.statusCode).toBe(200);
        expect(set.body.data).toEqual({ shopName: 'Shree Fashion Hub', logoDataUrl: tinyPng });
        expect(await getShopName()).toBe('Shree Fashion Hub');

        const pub = await request(app).get('/api/branding');
        expect(pub.body.data.logoDataUrl).toBe(tinyPng);

        const keep = await request(app).put('/api/branding').set('Authorization', `Bearer ${adminToken}`).send({ shopName: 'Shree Fashion Hub' });
        expect(keep.body.data.logoDataUrl).toBe(tinyPng); // undefined = keep

        const remove = await request(app).put('/api/branding').set('Authorization', `Bearer ${adminToken}`).send({ shopName: 'Shree Fashion Hub', logoDataUrl: null });
        expect(remove.body.data.logoDataUrl).toBeNull();
    });

    it('rejects a non-image data-URL, an oversized logo and an empty name', async () => {
        const bad = await request(app).put('/api/branding').set('Authorization', `Bearer ${adminToken}`).send({ shopName: 'X', logoDataUrl: 'data:text/html;base64,PHNjcmlwdD4=' });
        expect(bad.statusCode).toBe(400);
        const big = await request(app).put('/api/branding').set('Authorization', `Bearer ${adminToken}`).send({ shopName: 'X', logoDataUrl: `data:image/png;base64,${'A'.repeat(300 * 1024)}` });
        expect(big.statusCode).toBe(400);
        const empty = await request(app).put('/api/branding').set('Authorization', `Bearer ${adminToken}`).send({ shopName: '   ' });
        expect(empty.statusCode).toBe(400);
    });
});
