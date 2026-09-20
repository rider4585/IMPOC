import { describe, it, expect } from 'vitest';
import { createRequestKey } from './requestKey.js';

describe('requestKey', () => {
  it('returns a UUID v4 string', () => {
    const key = createRequestKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBe(36); // UUID v4 is 36 chars (including hyphens)
  });

  it('returns a valid UUID v4 format', () => {
    const key = createRequestKey();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidv4Regex.test(key)).toBe(true);
  });

  it('returns distinct values on repeated calls', () => {
    const key1 = createRequestKey();
    const key2 = createRequestKey();
    const key3 = createRequestKey();

    expect(key1).not.toBe(key2);
    expect(key2).not.toBe(key3);
    expect(key1).not.toBe(key3);
  });

  it('generates unique keys across multiple calls', () => {
    const keys = new Set();
    for (let i = 0; i < 100; i++) {
      keys.add(createRequestKey());
    }
    expect(keys.size).toBe(100); // All should be unique
  });

  it('wraps crypto.randomUUID errors in TypeError', () => {
    // Save original crypto.randomUUID
    const originalRandomUUID = crypto.randomUUID;

    try {
      // Mock crypto.randomUUID to throw an error
      crypto.randomUUID = () => {
        throw new Error('Crypto API unavailable');
      };

      expect(() => createRequestKey()).toThrow(TypeError);
      expect(() => createRequestKey()).toThrow('Failed to generate request key');
    } finally {
      // Restore original
      crypto.randomUUID = originalRandomUUID;
    }
  });

  it('generates a valid UUID v4 when crypto.randomUUID is undefined (e.g. non-secure mobile context)', () => {
    const originalRandomUUID = crypto.randomUUID;
    const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    try {
      delete crypto.randomUUID;
      const key = createRequestKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(36);
      expect(uuidv4Regex.test(key)).toBe(true);
    } finally {
      crypto.randomUUID = originalRandomUUID;
    }
  });

  it('generates a valid UUID v4 when crypto is completely unavailable', () => {
    const originalRandomUUID = crypto.randomUUID;
    const originalGetRandomValues = crypto.getRandomValues;
    const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    try {
      delete crypto.randomUUID;
      delete crypto.getRandomValues;
      const key = createRequestKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(36);
      expect(uuidv4Regex.test(key)).toBe(true);
    } finally {
      crypto.randomUUID = originalRandomUUID;
      crypto.getRandomValues = originalGetRandomValues;
    }
  });
});

