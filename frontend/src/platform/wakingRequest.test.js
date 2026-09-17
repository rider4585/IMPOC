import { describe, it, expect, vi, afterEach } from 'vitest';
import { wakingRequest } from './wakingRequest.js';

describe('wakingRequest', () => {
  afterEach(() => {
    vi.clearAllTimers();
  });

  it('resolves immediately if promise resolves in <1200ms', async () => {
    vi.useFakeTimers();

    const fn = vi.fn().mockResolvedValue({ success: true, data: { items: [] } });
    const promise = wakingRequest(fn, { requestKey: 'test-key-1' });

    vi.advanceTimersByTime(500);

    const result = await promise;
    expect(result).toEqual({ success: true, data: { items: [] } });
    expect(result.status).toBeUndefined();
  });

  it('signals waking via onStatus at 1200ms but keeps the promise pending', async () => {
    vi.useFakeTimers();

    let resolveResult;
    const fn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResult = resolve;
        })
    );

    const onStatus = vi.fn();
    const requestKey = 'test-key-2';
    const promise = wakingRequest(fn, { requestKey, onStatus });

    // At 1200ms, onStatus('waking') fires but the promise is NOT settled
    vi.advanceTimersByTime(1200);
    expect(onStatus).toHaveBeenCalledWith('waking', requestKey);

    // Still pending — the eventual real result must still be delivered
    resolveResult({ success: true });
    const result = await promise;
    expect(result).toEqual({ success: true });
    expect(result.status).toBeUndefined();
  });

  it('delivers the real result after waking (not dropped)', async () => {
    vi.useFakeTimers();

    let resolveResult;
    const fn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResult = resolve;
        })
    );

    const onStatus = vi.fn();
    const promise = wakingRequest(fn, { requestKey: 'test-key-3', onStatus });

    vi.advanceTimersByTime(1200);
    expect(onStatus).toHaveBeenCalledWith('waking', 'test-key-3');

    // A slow cold-start response arrives after the waking banner
    resolveResult({ data: new ArrayBuffer(8), headers: { 'content-type': 'application/pdf' } });
    const result = await promise;
    expect(result.data).toBeInstanceOf(ArrayBuffer);
    expect(result.headers['content-type']).toBe('application/pdf');
  });

  it('signals failed via onStatus and resolves {status:failed} at 90s', async () => {
    vi.useFakeTimers();

    const fn = vi.fn(
      () =>
        new Promise(() => {
          // Never resolves
        })
    );

    const onStatus = vi.fn();
    const requestKey = 'test-key-4';
    const promise = wakingRequest(fn, { requestKey, onStatus });

    vi.advanceTimersByTime(1200);
    expect(onStatus).toHaveBeenCalledWith('waking', requestKey);

    vi.advanceTimersByTime(100000);
    const result = await promise;
    expect(onStatus).toHaveBeenCalledWith('failed', requestKey);
    expect(result).toEqual({ status: 'failed', requestKey });
  });

  it('uses provided requestKey when reporting status', async () => {
    vi.useFakeTimers();

    const fn = vi.fn(() => new Promise(() => {}));
    const customKey = 'custom-request-key-5';
    const onStatus = vi.fn();

    const promise = wakingRequest(fn, { requestKey: customKey, onStatus });

    vi.advanceTimersByTime(1200);
    expect(onStatus).toHaveBeenCalledWith('waking', customKey);

    vi.advanceTimersByTime(88800);
    const result = await promise;
    expect(result.status).toBe('failed');
    expect(result.requestKey).toBe(customKey);
  });

  it('generates requestKey if not provided', async () => {
    vi.useFakeTimers();

    const fn = vi.fn(() => new Promise(() => {}));
    const promise = wakingRequest(fn);

    vi.advanceTimersByTime(90000);
    const result = await promise;

    expect(result.status).toBe('failed');
    // Should have a requestKey (generated UUID)
    expect(result.requestKey).toBeDefined();
    expect(typeof result.requestKey).toBe('string');
    expect(result.requestKey.length).toBe(36); // UUID v4 length
  });

  it('resolves with the wrapped result between 1200ms and 90s (not a status)', async () => {
    vi.useFakeTimers();

    let resolveResult;
    const fn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResult = resolve;
        })
    );

    const promise = wakingRequest(fn, { requestKey: 'test-key-6' });

    // Move past waking threshold
    vi.advanceTimersByTime(1200);

    resolveResult({ items: [1, 2, 3] });
    const result = await promise;
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('retries with exponential backoff then resolves on success', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const fn = vi.fn(() => {
      callCount += 1;
      if (callCount < 3) {
        return Promise.reject(new Error('Cold start'));
      }
      return Promise.resolve({ recovered: true });
    });

    const promise = wakingRequest(fn, { requestKey: 'test-key-7' });

    // First attempt fails immediately → retry scheduled (~1.2s ±10%)
    await vi.advanceTimersByTimeAsync(2000);
    // Second attempt fails (retry scheduled ~2.4s ±10%)
    await vi.advanceTimersByTimeAsync(3000);
    // Third attempt succeeds
    const result = await promise;
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ recovered: true });
  });

  it('resolves failed after 90s even while retrying a rejecting fn', async () => {
    vi.useFakeTimers();

    const fn = vi.fn(() => Promise.reject(new Error('Cold start')));

    const onStatus = vi.fn();
    const promise = wakingRequest(fn, { requestKey: 'test-key-8', onStatus });

    vi.advanceTimersByTime(90000);
    const result = await promise;

    expect(onStatus).toHaveBeenCalledWith('failed', 'test-key-8');
    expect(result.status).toBe('failed');
  });

  it('handles synchronous function that returns a promise', async () => {
    vi.useFakeTimers();

    const fn = () => Promise.resolve({ data: 'test' });
    const promise = wakingRequest(fn, { requestKey: 'test-key-9' });

    vi.advanceTimersByTime(100);

    const result = await promise;
    expect(result.data).toBe('test');
  });

  it('throws TypeError if fn is not a function', () => {
    expect(() => wakingRequest('not a function')).toThrow(TypeError);
    expect(() => wakingRequest('not a function')).toThrow('expects a function');
  });

  it('throws TypeError if fn is null', () => {
    expect(() => wakingRequest(null)).toThrow(TypeError);
  });

  it('throws TypeError if fn is undefined', () => {
    expect(() => wakingRequest(undefined)).toThrow(TypeError);
  });

  it('throws TypeError if fn is an object', () => {
    expect(() => wakingRequest({})).toThrow(TypeError);
  });

  it('throws TypeError if fn is a number', () => {
    expect(() => wakingRequest(123)).toThrow(TypeError);
  });
});