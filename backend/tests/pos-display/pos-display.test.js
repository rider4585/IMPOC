import http from 'http';
import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, closeDatabase, generateTestUser } from '../utils/test-setup.js';
import argon2 from 'argon2';
import { publish, subscribe, getState, IDLE_STATE, __testing } from '../../src/modules/pos-display/pos-display.state.js';

function makeFakeRes() {
  return { write: jest.fn(), writeHead: jest.fn(), flushHeaders: jest.fn(), on: jest.fn() };
}

describe('pos-display state store (in-memory)', () => {
  it('defaults an unknown code to idle', () => {
    expect(getState('UNKNOWN1')).toEqual(IDLE_STATE);
  });

  it('subscribe sends the current state immediately (late-join)', () => {
    publish('CODEJOIN', { status: 'awaiting', method: 'Cash', amountPaise: 5000 });
    const res = makeFakeRes();
    subscribe('CODEJOIN', res);
    expect(res.write).toHaveBeenCalledTimes(1);
    expect(res.write.mock.calls[0][0]).toContain('"status":"awaiting"');
    expect(res.write.mock.calls[0][0]).toContain('"amountPaise":5000');
  });

  it('publish pushes an update to every live subscriber', () => {
    const res1 = makeFakeRes();
    const res2 = makeFakeRes();
    subscribe('CODEPUSH', res1);
    subscribe('CODEPUSH', res2);
    res1.write.mockClear();
    res2.write.mockClear();

    publish('CODEPUSH', { status: 'awaiting', method: 'UPI', amountPaise: 12345, upiUri: 'upi://pay?pa=x@y' });

    expect(res1.write).toHaveBeenCalledTimes(1);
    expect(res2.write).toHaveBeenCalledTimes(1);
    expect(res1.write.mock.calls[0][0]).toContain('"upiUri":"upi://pay?pa=x@y"');
  });

  it('unsubscribing stops further pushes to that subscriber', () => {
    const res = makeFakeRes();
    const unsubscribe = subscribe('CODEUNSUB', res);
    res.write.mockClear();
    unsubscribe();

    publish('CODEUNSUB', { status: 'awaiting', method: 'Cash', amountPaise: 100 });
    expect(res.write).not.toHaveBeenCalled();
  });

  it('auto-resets to idle after a received state, on a timer', () => {
    jest.useFakeTimers();
    try {
      const res = makeFakeRes();
      subscribe('CODERESET', res);
      res.write.mockClear();

      publish('CODERESET', { status: 'received' });
      expect(res.write).toHaveBeenCalledTimes(1);
      expect(res.write.mock.calls[0][0]).toContain('"status":"received"');

      jest.advanceTimersByTime(__testing.RECEIVED_AUTO_RESET_MS);

      expect(res.write).toHaveBeenCalledTimes(2);
      expect(res.write.mock.calls[1][0]).toContain('"status":"idle"');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('POST /api/pos-display/:code (publish)', () => {
  let salesToken;
  let noPermToken;

  beforeAll(async () => {
    await initializeTestDatabase();

    const salesData = generateTestUser({ password: 'Sales123!' });
    const salesUser = await db.User.create({
      username: salesData.username,
      email: salesData.email,
      firstName: salesData.firstName,
      passwordHash: await argon2.hash(salesData.password),
    });
    const cashierRole = await db.Role.findOne({ where: { name: 'CASHIER' } });
    await salesUser.addRole(cashierRole);
    const salesLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: salesData.username, password: salesData.password });
    salesToken = salesLoginRes.body.data.accessToken;

    const noPermData = generateTestUser({ password: 'NoPerm123!' });
    const noPermUser = await db.User.create({
      username: noPermData.username,
      email: noPermData.email,
      firstName: noPermData.firstName,
      passwordHash: await argon2.hash(noPermData.password),
    });
    const accountantRole = await db.Role.findOne({ where: { name: 'ACCOUNTANT' } });
    await noPermUser.addRole(accountantRole);
    const noPermLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: noPermData.username, password: noPermData.password });
    noPermToken = noPermLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/pos-display/PUBTEST1')
      .send({ status: 'idle' });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 without sales.create permission', async () => {
    const res = await request(app)
      .post('/api/pos-display/PUBTEST2')
      .set('Authorization', `Bearer ${noPermToken}`)
      .send({ status: 'idle' });

    expect(res.statusCode).toBe(403);
  });

  it('publishes an awaiting/UPI state with sales.create permission', async () => {
    const res = await request(app)
      .post('/api/pos-display/PUBTEST3')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'awaiting', method: 'UPI', amountPaise: 25000, upiUri: 'upi://pay?pa=shop@bank&am=250.00' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      status: 'awaiting',
      method: 'UPI',
      amountPaise: 25000,
      upiUri: 'upi://pay?pa=shop@bank&am=250.00',
      customerFirstName: null,
    });
  });

  it('publishes a received state with an optional customerFirstName and round-trips it', async () => {
    const res = await request(app)
      .post('/api/pos-display/PUBTEST5')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'received', customerFirstName: 'Asha' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({
      status: 'received',
      method: null,
      amountPaise: null,
      upiUri: null,
      customerFirstName: 'Asha',
    });
  });

  it('rejects a multi-token customerFirstName', async () => {
    const res = await request(app)
      .post('/api/pos-display/PUBTEST6')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'received', customerFirstName: 'Asha Patel' });

    expect(res.statusCode).toBe(400);
  });

  it('strips unknown fields instead of storing them', async () => {
    const res = await request(app)
      .post('/api/pos-display/PUBTEST7')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'idle', hackerField: 'nope' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).not.toHaveProperty('hackerField');
  });

  it('rejects an invalid display code', async () => {
    const res = await request(app)
      .post('/api/pos-display/a')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'idle' });

    expect(res.statusCode).toBe(400);
  });

  it('rejects awaiting status without method/amount', async () => {
    const res = await request(app)
      .post('/api/pos-display/PUBTEST4')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'awaiting' });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/pos-display/:code/stream (subscribe, public)', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  function getFirstChunk(path) {
    return new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}${path}`, (res) => {
        let body = '';
        const finish = () => {
          req.destroy();
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        };
        res.on('data', (chunk) => {
          body += chunk.toString();
          if (body.includes('\n\n')) finish();
        });
        res.on('end', finish);
      });
      req.on('error', (err) => {
        // A destroyed-after-resolve socket surfaces ECONNRESET; ignore those.
        if (err.code !== 'ECONNRESET') reject(err);
      });
    });
  }

  it('requires no authentication and streams the current (idle) state on connect', async () => {
    const { statusCode, headers, body } = await getFirstChunk('/api/pos-display/STREAM01/stream');
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toMatch(/text\/event-stream/);
    expect(body).toContain('"status":"idle"');
  });

  it('late-join: a subscriber connecting after a publish sees the current state', async () => {
    publish('STREAM02', { status: 'awaiting', method: 'Cash', amountPaise: 9900 });
    const { statusCode, body } = await getFirstChunk('/api/pos-display/STREAM02/stream');
    expect(statusCode).toBe(200);
    expect(body).toContain('"status":"awaiting"');
    expect(body).toContain('"amountPaise":9900');
  });

  it('rejects an invalid display code with 400', async () => {
    const { statusCode } = await getFirstChunk('/api/pos-display/a/stream');
    expect(statusCode).toBe(400);
  });
});
