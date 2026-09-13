import request from 'supertest';
import * as db from '../database/models/index.js';
import { initializeTestDatabase, generateTestUser, closeDatabase } from './utils/test-setup.js';
import argon2 from 'argon2';
import app from '../app.js';

/** R-54: review links picklist (label + https url + active). */
describe('Review links picklist (R-54)', () => {
    let token;
    let created;

    beforeAll(async () => {
        await initializeTestDatabase();
        const userData = generateTestUser({ password: 'TestPassword123!' });
        const user = await db.User.create({
            username: userData.username, firstName: userData.firstName, lastName: userData.lastName,
            email: userData.email, passwordHash: await argon2.hash(userData.password),
        });
        // MANAGER holds picklists.create/update; avoid creating an extra ADMIN (the shared
        // test DB's SEC-CR-2 suite asserts on the number of active admins).
        const manager = await db.Role.findOne({ where: { name: 'MANAGER' } });
        await user.addRole(manager);
        const login = await request(app).post('/api/auth/login').send({ username: userData.username, password: userData.password });
        token = login.body.data.accessToken;
    });

    afterAll(async () => {
        await db.ReviewLink.destroy({ where: {}, force: true });
        await db.User.destroy({ where: { username: { [db.Sequelize.Op.like]: 'testuser_%' } } });
        await closeDatabase();
    });

    it('creates an https review link', async () => {
        const res = await request(app)
            .post('/api/picklists/review-links')
            .set('Authorization', `Bearer ${token}`)
            .send({ label: 'Google Maps', url: 'https://search.google.com/local/writereview?placeid=ChIJabc123' });
        expect(res.statusCode).toBe(201);
        expect(res.body.data).toMatchObject({ label: 'Google Maps', url: 'https://search.google.com/local/writereview?placeid=ChIJabc123', isActive: true });
        created = res.body.data;
    });

    it('rejects non-https links and duplicate labels', async () => {
        const http = await request(app).post('/api/picklists/review-links').set('Authorization', `Bearer ${token}`)
            .send({ label: 'Insecure', url: 'http://example.com' });
        expect(http.statusCode).toBe(400);
        expect(http.body.message).toMatch(/https/);

        const dup = await request(app).post('/api/picklists/review-links').set('Authorization', `Bearer ${token}`)
            .send({ label: 'Google Maps', url: 'https://example.com/other' });
        expect(dup.statusCode).toBe(409);
    });

    it('lists, updates and deactivates', async () => {
        const list = await request(app).get('/api/picklists/review-links').set('Authorization', `Bearer ${token}`);
        expect(list.statusCode).toBe(200);
        expect(list.body.data.some((l) => l.uuid === created.uuid)).toBe(true);

        const patch = await request(app).patch(`/api/picklists/review-links/${created.uuid}`).set('Authorization', `Bearer ${token}`)
            .send({ url: 'https://g.page/r/abc/review', isActive: false });
        expect(patch.statusCode).toBe(200);
        expect(patch.body.data.url).toBe('https://g.page/r/abc/review');
        expect(patch.body.data.isActive).toBe(false);
    });

    it('requires auth', async () => {
        const res = await request(app).get('/api/picklists/review-links');
        expect(res.statusCode).toBe(401);
    });
});
