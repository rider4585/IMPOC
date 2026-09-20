import request from 'supertest';
import app from '../../../../app.js';
import { getNetworkInfo } from '../system.service.js';

describe('System Module - Network Info & Wi-Fi Access (R-67)', () => {
    describe('system.service - getNetworkInfo()', () => {
        it('returns primaryUrl, port, and interfaces from host network', () => {
            const result = getNetworkInfo();
            expect(result).toBeDefined();
            expect(typeof result.port).toBe('number');
            expect(result.primaryUrl).toMatch(/^http:\/\/[^:]+:\d+$/);
            expect(Array.isArray(result.interfaces)).toBe(true);
            expect(result.interfaces.length).toBeGreaterThan(0);
            expect(result.interfaces[0].isDefault).toBe(true);
        });

        it('filters non-internal IPv4 and prioritizes Wi-Fi / en0 interfaces', () => {
            const mockInterfaces = {
                lo0: [
                    { address: '127.0.0.1', family: 'IPv4', internal: true },
                    { address: '::1', family: 'IPv6', internal: true },
                ],
                eth0: [
                    { address: '192.168.1.5', family: 'IPv4', internal: false, mac: '00:11:22:33:44:55' },
                ],
                en0: [
                    { address: '192.168.1.10', family: 'IPv4', internal: false, mac: 'aa:bb:cc:dd:ee:ff' },
                    { address: 'fe80::1', family: 'IPv6', internal: false },
                ],
            };

            const result = getNetworkInfo({
                networkInterfaces: mockInterfaces,
                port: 3000,
            });

            expect(result.port).toBe(3000);
            // en0 has higher score than eth0
            expect(result.primaryUrl).toBe('http://192.168.1.10:3000');
            expect(result.interfaces).toHaveLength(2);
            expect(result.interfaces[0].name).toBe('en0');
            expect(result.interfaces[0].address).toBe('192.168.1.10');
            expect(result.interfaces[0].isDefault).toBe(true);
            expect(result.interfaces[1].name).toBe('eth0');
            expect(result.interfaces[1].isDefault).toBe(false);
        });

        it('gives highest priority to explicit wi-fi / wireless named interface', () => {
            const mockInterfaces = {
                en0: [
                    { address: '10.0.0.2', family: 'IPv4', internal: false },
                ],
                'Wi-Fi': [
                    { address: '192.168.0.50', family: 'IPv4', internal: false },
                ],
            };

            const result = getNetworkInfo({
                networkInterfaces: mockInterfaces,
                port: 5000,
            });

            expect(result.primaryUrl).toBe('http://192.168.0.50:5000');
            expect(result.interfaces[0].name).toBe('Wi-Fi');
            expect(result.interfaces[0].isDefault).toBe(true);
        });

        it('falls back gracefully to 127.0.0.1 when offline with no external IPv4 interfaces', () => {
            const mockInterfaces = {
                lo: [
                    { address: '127.0.0.1', family: 'IPv4', internal: true },
                ],
            };

            const result = getNetworkInfo({
                networkInterfaces: mockInterfaces,
                port: 3000,
            });

            expect(result.primaryUrl).toBe('http://127.0.0.1:3000');
            expect(result.interfaces).toHaveLength(1);
            expect(result.interfaces[0].name).toBe('localhost');
            expect(result.interfaces[0].address).toBe('127.0.0.1');
            expect(result.interfaces[0].isDefault).toBe(true);
        });
    });

    describe('GET /api/system/network', () => {
        it('returns 200 with network configuration and no-store caching', async () => {
            const res = await request(app).get('/api/system/network');
            expect(res.status).toBe(200);
            expect(res.headers['cache-control']).toBe('no-store');
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.primaryUrl).toBeDefined();
            expect(Array.isArray(res.body.data.interfaces)).toBe(true);
            // Also top-level properties are present for flexible client consumption
            expect(res.body.primaryUrl).toBe(res.body.data.primaryUrl);
        });
    });

    describe('CORS configuration for private LAN IPs', () => {
        it('allows configured FRONTEND_ORIGIN with credentials', async () => {
            const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
            const res = await request(app)
                .get('/api/system/network')
                .set('Origin', frontendOrigin);

            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBe(frontendOrigin);
            expect(res.headers['access-control-allow-credentials']).toBe('true');
        });

        it('allows private LAN 192.168.x.x origin with credentials', async () => {
            const lanOrigin = 'http://192.168.1.120:5173';
            const res = await request(app)
                .get('/api/system/network')
                .set('Origin', lanOrigin);

            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBe(lanOrigin);
            expect(res.headers['access-control-allow-credentials']).toBe('true');
        });

        it('allows private LAN 10.x.x.x origin with credentials', async () => {
            const lanOrigin = 'http://10.0.1.45:3000';
            const res = await request(app)
                .get('/api/system/network')
                .set('Origin', lanOrigin);

            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBe(lanOrigin);
            expect(res.headers['access-control-allow-credentials']).toBe('true');
        });

        it('allows private LAN 172.16-31.x.x origin with credentials', async () => {
            const lanOrigin = 'http://172.20.5.10:8080';
            const res = await request(app)
                .get('/api/system/network')
                .set('Origin', lanOrigin);

            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBe(lanOrigin);
            expect(res.headers['access-control-allow-credentials']).toBe('true');
        });

        it('allows localhost and 127.0.0.1 origin with credentials', async () => {
            const localOrigin = 'http://localhost:5173';
            const res = await request(app)
                .get('/api/system/network')
                .set('Origin', localOrigin);

            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBe(localOrigin);
            expect(res.headers['access-control-allow-credentials']).toBe('true');
        });

        it('does not allow arbitrary untrusted public origins', async () => {
            const untrustedOrigin = 'http://untrusted-external-site.com';
            const res = await request(app)
                .get('/api/system/network')
                .set('Origin', untrustedOrigin);

            expect(res.headers['access-control-allow-origin']).toBeUndefined();
        });
    });
});
