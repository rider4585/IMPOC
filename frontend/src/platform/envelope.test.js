import { describe, it, expect } from 'vitest';
import { parseEnvelope } from './envelope.js';

describe('envelope', () => {
  describe('parseEnvelope', () => {
    it('parses valid collection envelope', () => {
      const response = {
        success: true,
        data: {
          items: [{ uuid: '123' }],
          page: 1,
          pageSize: 50,
          total: 100,
        },
      };
      const result = parseEnvelope(response);
      expect(result).toEqual({
        items: [{ uuid: '123' }],
        page: 1,
        pageSize: 50,
        total: 100,
      });
    });

    it('parses collection with empty items array', () => {
      const response = {
        success: true,
        data: {
          items: [],
          page: 1,
          pageSize: 50,
          total: 0,
        },
      };
      const result = parseEnvelope(response);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('parses collection with multiple items', () => {
      const response = {
        success: true,
        data: {
          items: [
            { uuid: '111', name: 'Item 1' },
            { uuid: '222', name: 'Item 2' },
          ],
          page: 2,
          pageSize: 100,
          total: 250,
        },
      };
      const result = parseEnvelope(response);
      expect(result.items.length).toBe(2);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(100);
      expect(result.total).toBe(250);
    });

    it('throws error on bare array', () => {
      const response = [{ uuid: '123' }];
      expect(() => parseEnvelope(response)).toThrow('bare array');
    });

    it('throws error on non-object response', () => {
      expect(() => parseEnvelope(null)).toThrow();
      expect(() => parseEnvelope(undefined)).toThrow();
      expect(() => parseEnvelope('string')).toThrow();
      expect(() => parseEnvelope(123)).toThrow();
    });

    it('throws error on missing data field', () => {
      const response = { success: true };
      expect(() => parseEnvelope(response)).toThrow();
    });

    it('throws error on data field being non-object', () => {
      const response = {
        success: true,
        data: 'not an object',
      };
      expect(() => parseEnvelope(response)).toThrow();
    });

    it('throws error on data field being an array', () => {
      const response = {
        success: true,
        data: [{ uuid: '123' }],
      };
      expect(() => parseEnvelope(response)).toThrow();
    });

    it('throws error on missing items field', () => {
      const response = {
        success: true,
        data: {
          page: 1,
          pageSize: 50,
          total: 100,
        },
      };
      expect(() => parseEnvelope(response)).toThrow('items');
    });

    it('throws error on missing page field', () => {
      const response = {
        success: true,
        data: {
          items: [],
          pageSize: 50,
          total: 100,
        },
      };
      expect(() => parseEnvelope(response)).toThrow('page');
    });

    it('throws error on missing pageSize field', () => {
      const response = {
        success: true,
        data: {
          items: [],
          page: 1,
          total: 100,
        },
      };
      expect(() => parseEnvelope(response)).toThrow('pageSize');
    });

    it('throws error on missing total field', () => {
      const response = {
        success: true,
        data: {
          items: [],
          page: 1,
          pageSize: 50,
        },
      };
      expect(() => parseEnvelope(response)).toThrow('total');
    });

    it('throws error when items is not an array', () => {
      const response = {
        success: true,
        data: {
          items: 'not an array',
          page: 1,
          pageSize: 50,
          total: 100,
        },
      };
      expect(() => parseEnvelope(response)).toThrow('array');
    });

    it('throws error on non-collection data (string)', () => {
      const response = {
        success: true,
        data: 'not a collection',
      };
      expect(() => parseEnvelope(response)).toThrow();
    });

    it('throws error when success is not true', () => {
      const response = {
        success: false,
        data: {
          items: [],
          page: 1,
          pageSize: 50,
          total: 0,
        },
      };
      expect(() => parseEnvelope(response)).toThrow('success');
    });

    it('throws error when success is missing', () => {
      const response = {
        data: {
          items: [],
          page: 1,
          pageSize: 50,
          total: 0,
        },
      };
      expect(() => parseEnvelope(response)).toThrow('success');
    });

    it('throws error when page is not a number', () => {
      const response = {
        success: true,
        data: {
          items: [],
          page: '1',
          pageSize: 50,
          total: 100,
        },
      };
      expect(() => parseEnvelope(response)).toThrow('number');
    });

    it('throws error when pageSize is not a number', () => {
      const response = {
        success: true,
        data: {
          items: [],
          page: 1,
          pageSize: '50',
          total: 100,
        },
      };
      expect(() => parseEnvelope(response)).toThrow('number');
    });

    it('throws error when total is not a number', () => {
      const response = {
        success: true,
        data: {
          items: [],
          page: 1,
          pageSize: 50,
          total: '100',
        },
      };
      expect(() => parseEnvelope(response)).toThrow('number');
    });
  });
});
