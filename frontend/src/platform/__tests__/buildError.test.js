import { describe, it, expect } from 'vitest';
import { buildError, isSafeClientMessage, SAFE_4XX_MESSAGES } from '../buildError.js';

describe('isSafeClientMessage (SEC-L-7 lockstep)', () => {
  it('mirrors the backend M-7 allow-list phrases', () => {
    expect(SAFE_4XX_MESSAGES.length).toBeGreaterThan(50);
    expect(isSafeClientMessage('Invalid username or password')).toBe(true);
    expect(isSafeClientMessage('Account is suspended')).toBe(true);
    expect(isSafeClientMessage('Stock not found')).toBe(true);
    expect(isSafeClientMessage('Floor price cannot exceed selling price')).toBe(true);
    expect(isSafeClientMessage('Request could not be processed')).toBe(true);
    expect(isSafeClientMessage('Internal server error')).toBe(true);
  });

  it('rejects messages carrying a UUID', () => {
    expect(
      isSafeClientMessage('Stock not found (id: 550e8400-e29b-41d4-a716-446655440000)')
    ).toBe(false);
  });

  it('rejects messages carrying a (status: ...) fragment', () => {
    expect(isSafeClientMessage('Vendor not found (status: cancelled)')).toBe(false);
  });

  it('rejects opaque / raw server strings not on the allow-list', () => {
    expect(isSafeClientMessage('relation "payment_methods" does not exist')).toBe(false);
    expect(isSafeClientMessage('Column "buying_price" is of type integer')).toBe(false);
    expect(isSafeClientMessage('select * from users where 1=1')).toBe(false);
    expect(isSafeClientMessage('')).toBe(false);
    expect(isSafeClientMessage(null)).toBe(false);
  });
});

describe('buildError (SEC-L-7)', () => {
  const apiError = (status, body) => ({
    response: { status, data: body },
  });

  it('surfaces an allow-listed server message with its status', () => {
    const err = buildError(
      apiError(400, { success: false, message: 'Invalid username or password' }),
      'Login failed'
    );
    expect(err.message).toBe('Invalid username or password');
    expect(err.statusCode).toBe(400);
  });

  it('falls back when the server message is opaque and not allow-listed', () => {
    const err = buildError(
      apiError(400, { success: false, message: 'relation "payment_methods" does not exist' }),
      'Failed to fetch picklists'
    );
    expect(err.message).toBe('Failed to fetch picklists');
  });

  it('falls back when the server message embeds an internal identifier', () => {
    const err = buildError(
      apiError(409, {
        success: false,
        message: 'Stock already exists (id: 550e8400-e29b-41d4-a716-446655440000)',
      }),
      'Create stock failed'
    );
    expect(err.message).toBe('Create stock failed');
    expect(err.statusCode).toBeUndefined();
  });

  it('passes through Zod validation responses with sanitized field errors', () => {
    const err = buildError(
      apiError(400, {
        success: false,
        message: 'Validation failed',
        errors: [
          { field: 'items', message: 'At least one item is required' },
          { field: 'soldAt', message: 'Invalid date' },
        ],
      }),
      'Checkout failed'
    );
    expect(err.message).toBe('Validation failed');
    expect(err.statusCode).toBe(400);
    expect(err.errors).toEqual([
      { field: 'items', message: 'At least one item is required' },
      { field: 'soldAt', message: 'Invalid date' },
    ]);
  });

  it('drops Zod field errors that embed an internal identifier', () => {
    const err = buildError(
      apiError(400, {
        success: false,
        message: 'Validation failed',
        errors: [
          { field: 'unitUuid', message: 'Invalid UUID format' },
          { field: 'vendor', message: 'Vendor not found (uuid: 550e8400-e29b-41d4-a716-446655440000)' },
        ],
      }),
      'Scan failed'
    );
    expect(err.errors).toEqual([{ field: 'unitUuid', message: 'Invalid UUID format' }]);
  });

  it('falls back on transport errors without a server body', () => {
    const err = buildError(new Error('Network Error'), 'Failed to load trips');
    expect(err.message).toBe('Network Error');
  });

  it('uses the fallback when there is no error message at all', () => {
    const err = buildError({}, 'Failed to load trips');
    expect(err.message).toBe('Failed to load trips');
  });

  it('keeps statusCode on serverless errors when present', () => {
    const thrown = new Error('boom');
    thrown.statusCode = 503;
    const err = buildError(thrown, 'Failed');
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(503);
  });

  it('surfaces the backend generic 4xx mask', () => {
    const err = buildError(
      apiError(400, { success: false, message: 'Request could not be processed' }),
      'Failed'
    );
    expect(err.message).toBe('Request could not be processed');
  });

  it('surfaces the backend 5xx mask', () => {
    const err = buildError(
      apiError(500, { success: false, message: 'Internal server error' }),
      'Failed'
    );
    expect(err.message).toBe('Internal server error');
  });
});