import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';

describe('UPI Accounts Module - /api/picklists/upi-accounts', () => {
  let adminToken;
  let picklitToken;

  beforeAll(async () => {
    await initializeTestDatabase();

    const adminData = generateTestUser({ password: 'Admin123!' });
    const adminUser = await db.User.create({
      username: adminData.username,
      email: adminData.email,
      firstName: adminData.firstName,
      passwordHash: await argon2.hash(adminData.password),
    });
    const adminRole = await db.Role.findOne({ where: { name: 'ADMIN' } });
    await adminUser.addRole(adminRole);

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: adminData.username,
        password: adminData.password,
      });
    adminToken = adminLoginRes.body.data.accessToken;

    const picklestData = generateTestUser({ password: 'Picklist123!' });
    const picklistUser = await db.User.create({
      username: picklestData.username,
      email: picklestData.email,
      firstName: picklestData.firstName,
      passwordHash: await argon2.hash(picklestData.password),
    });
    const managerRole = await db.Role.findOne({ where: { name: 'MANAGER' } });
    await picklistUser.addRole(managerRole);
    const picklistsCreatePerm = await db.Permission.findOne({ where: { name: 'picklists.create' } });
    const picklistsUpdatePerm = await db.Permission.findOne({ where: { name: 'picklists.update' } });
    await managerRole.addPermissions([picklistsCreatePerm, picklistsUpdatePerm]);

    const picklistLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: picklestData.username,
        password: picklestData.password,
      });
    picklitToken = picklistLoginRes.body.data.accessToken;
  });

  afterEach(async () => {
    await db.UpiAccount.destroy({ where: { label: { [db.Sequelize.Op.like]: 'TEST_%' } } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /upi-accounts', () => {
    it('should list upi accounts with authentication', async () => {
      await db.UpiAccount.create({ label: 'TEST_Shop', vpa: 'test1@okbank' });
      await db.UpiAccount.create({ label: 'TEST_Counter2', vpa: 'test2@okbank' });

      const res = await request(app)
        .get('/api/picklists/upi-accounts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const labels = res.body.data.map((t) => t.label);
      expect(labels).toContain('TEST_Shop');
      expect(labels).toContain('TEST_Counter2');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/picklists/upi-accounts');

      expect(res.statusCode).toBe(401);
    });

    it('should not expose internal id field', async () => {
      await db.UpiAccount.create({ label: 'TEST_Other', vpa: 'other@okbank' });

      const res = await request(app)
        .get('/api/picklists/upi-accounts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      res.body.data.forEach((account) => {
        expect(account).not.toHaveProperty('id');
        expect(account).toHaveProperty('uuid');
        expect(account).toHaveProperty('label');
        expect(account).toHaveProperty('vpa');
        expect(account).toHaveProperty('isActive');
      });
    });
  });

  describe('POST /upi-accounts', () => {
    it('should create upi account with picklists.create permission', async () => {
      const res = await request(app)
        .post('/api/picklists/upi-accounts')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ label: 'TEST_Entertainment', vpa: 'entertainment@okbank' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uuid');
      expect(res.body.data.label).toBe('TEST_Entertainment');
      expect(res.body.data.vpa).toBe('entertainment@okbank');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data).not.toHaveProperty('id');
    });

    it('should return 409 for duplicate active label', async () => {
      await db.UpiAccount.create({ label: 'TEST_Utilities', vpa: 'utilities@okbank' });

      const res = await request(app)
        .post('/api/picklists/upi-accounts')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ label: 'TEST_Utilities', vpa: 'utilities2@okbank' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('UPI account already exists');
    });

    it('should allow creating an upi account with same label as a deactivated one', async () => {
      const account = await db.UpiAccount.create({ label: 'TEST_Medical', vpa: 'medical@okbank' });
      await account.update({ isActive: false });

      const res = await request(app)
        .post('/api/picklists/upi-accounts')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ label: 'TEST_Medical', vpa: 'medical@okbank' });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.label).toBe('TEST_Medical');
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/picklists/upi-accounts')
        .send({ label: 'TEST_NoAuth', vpa: 'noauth@okbank' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 400 for missing label', async () => {
      const res = await request(app)
        .post('/api/picklists/upi-accounts')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ vpa: 'noname@okbank' });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for an invalid vpa', async () => {
      const res = await request(app)
        .post('/api/picklists/upi-accounts')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ label: 'TEST_BadVpa', vpa: 'not-a-vpa' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /upi-accounts/:uuid', () => {
    it('should update upi account label and vpa with picklists.update permission', async () => {
      const account = await db.UpiAccount.create({ label: 'TEST_Original', vpa: 'original@okbank' });

      const res = await request(app)
        .patch(`/api/picklists/upi-accounts/${account.uuid}`)
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ label: 'TEST_Updated', vpa: 'updated@okbank' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.label).toBe('TEST_Updated');
      expect(res.body.data.vpa).toBe('updated@okbank');
      expect(res.body.data.uuid).toBe(account.uuid);
    });

    it('should deactivate an upi account by setting isActive to false', async () => {
      const account = await db.UpiAccount.create({ label: 'TEST_Deactivate', vpa: 'deactivate@okbank' });

      const res = await request(app)
        .patch(`/api/picklists/upi-accounts/${account.uuid}`)
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ isActive: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should return 404 for non-existent upi account', async () => {
      const res = await request(app)
        .patch('/api/picklists/upi-accounts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ label: 'TEST_New' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when updating to a duplicate label', async () => {
      const account1 = await db.UpiAccount.create({ label: 'TEST_Type1', vpa: 'type1@okbank' });
      const account2 = await db.UpiAccount.create({ label: 'TEST_Type2', vpa: 'type2@okbank' });

      const res = await request(app)
        .patch(`/api/picklists/upi-accounts/${account2.uuid}`)
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({ label: 'TEST_Type1' });

      expect(res.statusCode).toBe(409);
    });

    it('should return 400 when update has no fields', async () => {
      const account = await db.UpiAccount.create({ label: 'TEST_Empty', vpa: 'empty@okbank' });

      const res = await request(app)
        .patch(`/api/picklists/upi-accounts/${account.uuid}`)
        .set('Authorization', `Bearer ${picklitToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });
});
