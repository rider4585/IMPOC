import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import errorMiddleware from '../src/middleware/error.middleware.js';

/*
 * SEC-M-7: 4xx responses must not echo internal row/query detail. This suite
 * exercises the error middleware directly (no DB) - it spies on console.error
 * to prove the real detail is still logged server-side while the client only
 * ever receives a generic message unless the message is on the allow-list AND
 * free of internal identifiers (UUIDs, `(status: ...)` fragments).
 */
const makeError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const testApp = express();
testApp.use(express.json());
testApp.post('/boom', (req, res, next) => {
    const { message, statusCode = 400, kind } = req.body;
    if (kind === 'zod') {
        return next(
            new ZodError([
                { code: 'custom', path: ['requestUuid'], message: 'Request UUID must be a valid UUID' },
            ])
        );
    }
    if (kind === '5xx') {
        return next(new Error('Secret query: SELECT internal_stuff FROM row_detail'));
    }
    return next(makeError(message, statusCode));
});
testApp.use(errorMiddleware);

const originalError = console.error;
let logged = [];

const captureLogs = () => {
    logged = [];
    console.error = (...args) => {
        logged.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    };
};

const restoreLogs = () => {
    console.error = originalError;
};

describe('SEC-M-7 - error message masking middleware', () => {
    afterEach(() => {
        restoreLogs();
    });

    it('should keep an allow-listed message verbatim', async () => {
        captureLogs();
        const res = await request(testApp)
            .post('/boom')
            .send({ message: 'Colour already exists' })
            .expect(400);
        expect(res.body.message).toBe('Colour already exists');
    });

    it('should keep an allow-listed low-risk message that includes a client-supplied value', async () => {
        captureLogs();
        const res = await request(testApp)
            .post('/boom')
            .send({ message: 'A template named "Widgets" already exists for this vendor and product type' })
            .expect(400);
        expect(res.body.message).toContain('already exists');
    });

    it('should pass through auth enumerable-lite messages', async () => {
        captureLogs();
        const res = await request(testApp)
            .post('/boom')
            .send({ message: 'Account temporarily locked. Try again in 15 minute(s).' })
            .expect(400);
        expect(res.body.message).toMatch(/locked/i);
    });

    it('should mask an unknown internal message and still log the real detail', async () => {
        captureLogs();
        const res = await request(testApp)
            .post('/boom')
            .send({ message: 'Unit A1000000001 has an unexpected internal stock reference' })
            .expect(400);
        expect(res.body.message).toBe('Request could not be processed');
        expect(logged.some((line) => line.includes('unexpected internal stock reference'))).toBe(true);
    });

    it('should mask an allow-listed message that embeds a row UUID', async () => {
        captureLogs();
        const res = await request(testApp)
            .post('/boom')
            .send({ message: 'Colour not found for row 123e4567-e89b-12d3-a456-426614174000' })
            .expect(400);
        expect(res.body.message).toBe('Request could not be processed');
    });

    it('should mask the (status: ...) detail fragment producers used', async () => {
        captureLogs();
        const res = await request(testApp)
            .post('/boom')
            .send({ message: 'Unit A1000000001 is not available for sale (status: sold)' })
            .expect(400);
        expect(res.body.message).toBe('Request could not be processed');
        expect(logged.some((line) => line.includes('status: sold'))).toBe(true);
    });

    it('should preserve Zod validation messages and issues', async () => {
        captureLogs();
        const res = await request(testApp)
            .post('/boom')
            .send({ kind: 'zod' })
            .expect(400);
        expect(res.body.message).toBe('Request UUID must be a valid UUID');
        expect(res.body.errors.some((e) => e.field === 'requestUuid')).toBe(true);
    });

    it('should keep 5xx responses opaque', async () => {
        captureLogs();
        const res = await request(testApp)
            .post('/boom')
            .send({ kind: '5xx' })
            .expect(500);
        expect(res.body.message).toBe('Internal server error');
        expect(res.body.message).not.toContain('internal_stuff');
        expect(logged.some((line) => line.includes('internal_stuff'))).toBe(true);
    });
});