import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';


describe('Role Escalation Prevention - SEC-CR-2', () => {
  let adminToken;
  let managerToken;
  let adminActor;
  let managerActor;
  let adminRole;

  const makeUser = async ({ password = 'Password123!', roleName }) => {
    const data = generateTestUser({ password });
    const user = await db.User.create({
      username: data.username,
      email: data.email,
      firstName: data.firstName,
      passwordHash: await argon2.hash(data.password),
      status: 'ACTIVE',
    });
    const role = await db.Role.findOne({ where: { name: roleName } });
    await user.addRole(role);
    return { user, data };
  };

  const login = async (username, password) => {
    const res = await request(app).post('/api/auth/login').send({ username, password });
    return res.body.data.accessToken;
  };

  // Ensure adminActor is the ONLY active ADMIN in the DB so the
  // "last active admin" guard is exercised deterministically.
  const ensureOnlyAdminIsActor = async () => {
    const admins = await db.User.findAll({
      include: {
        model: db.Role,
        as: 'roles',
        where: { name: 'ADMIN' },
        through: { attributes: [] },
      },
    });

    for (const admin of admins) {
      if (admin.uuid !== adminActor.uuid) {
        await admin.update({ status: 'DELETED' });
        await db.UserRole.destroy({
          where: { userId: admin.id },
        });
      }
    }
  };

  beforeAll(async () => {
    await initializeTestDatabase();

    adminRole = await db.Role.findOne({ where: { name: 'ADMIN' } });

    const adminFixture = await makeUser({ password: 'Admin123!', roleName: 'ADMIN' });
    adminActor = adminFixture.user;
    adminToken = await login(adminFixture.user.username, 'Admin123!');

    const managerFixture = await makeUser({ roleName: 'MANAGER' });
    managerActor = managerFixture.user;
    managerToken = await login(managerFixture.user.username, 'Password123!');
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('MANAGER cannot escalate to ADMIN', () => {
    it('MANAGER cannot assign ADMIN role to another user -> 403', async () => {
      const { user } = await makeUser({ roleName: 'MANAGER' });

      const res = await request(app)
        .post(`/api/users/${user.uuid}/roles`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ roleUuid: adminRole.uuid });

      expect(res.statusCode).toBe(403);
    });

    it('MANAGER cannot assign ADMIN role to self -> 403', async () => {
      const res = await request(app)
        .post(`/api/users/${managerActor.uuid}/roles`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ roleUuid: adminRole.uuid });

      expect(res.statusCode).toBe(403);
    });

    it('MANAGER cannot remove a privileged role from another user -> 403', async () => {
      const { user } = await makeUser({ roleName: 'ADMIN' });

      const res = await request(app)
        .delete(`/api/users/${user.uuid}/roles/${adminRole.uuid}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('ADMIN can assign ADMIN role', () => {
    it('ADMIN can assign ADMIN role to another user -> 201', async () => {
      const { user: target } = await makeUser({ roleName: 'MANAGER' });

      const res = await request(app)
        .post(`/api/users/${target.uuid}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleUuid: adminRole.uuid });

      expect(res.statusCode).toBe(201);
    });
  });

  describe('Privileged (ADMIN) users are protected from non-privileged mutation', () => {
    it('MANAGER cannot update an ADMIN user -> 403', async () => {
      const { user: admin } = await makeUser({ roleName: 'ADMIN' });

      const res = await request(app)
        .patch(`/api/users/${admin.uuid}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ firstName: 'Hacked' });

      expect(res.statusCode).toBe(403);
    });

    it('MANAGER cannot suspend an ADMIN user -> 403', async () => {
      const { user: admin } = await makeUser({ roleName: 'ADMIN' });

      const res = await request(app)
        .patch(`/api/users/${admin.uuid}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.statusCode).toBe(403);
    });

    it('MANAGER cannot delete an ADMIN user -> 403', async () => {
      const { user: admin } = await makeUser({ roleName: 'ADMIN' });

      const res = await request(app)
        .delete(`/api/users/${admin.uuid}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Last active admin protection', () => {
    it('cannot suspend the LAST active admin -> 403', async () => {
      await ensureOnlyAdminIsActor();

      const res = await request(app)
        .patch(`/api/users/${adminActor.uuid}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.statusCode).toBe(403);
    });

    it('cannot delete the LAST active admin -> 403', async () => {
      await ensureOnlyAdminIsActor();

      const res = await request(app)
        .delete(`/api/users/${adminActor.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('cannot demote (remove ADMIN role from) the only admin -> 403', async () => {
      await ensureOnlyAdminIsActor();

      const res = await request(app)
        .delete(`/api/users/${adminActor.uuid}/roles/${adminRole.uuid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Create user cannot grant a privileged role via non-privileged actor', () => {
    it('MANAGER creating a user with ADMIN role -> 403', async () => {
      const data = generateTestUser();

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          username: data.username,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          password: data.password,
          phone: data.phone,
          roleUuid: adminRole.uuid,
        });

      expect(res.statusCode).toBe(403);
    });

    it('ADMIN creating a user with ADMIN role -> 201', async () => {
      const data = generateTestUser();

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: data.username,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          password: data.password,
          phone: data.phone,
          roleUuid: adminRole.uuid,
        });

      expect(res.statusCode).toBe(201);
    });
  });
});
