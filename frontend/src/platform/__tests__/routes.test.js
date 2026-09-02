import { describe, it, expect } from 'vitest';
import { BARCODE_ROUTES, STOCK_INTAKE_ROUTES } from '../routes.js';

describe('BARCODE_ROUTES', () => {
  describe('GENERATE', () => {
    it('returns the correct path for barcode generation endpoint', () => {
      expect(BARCODE_ROUTES.GENERATE).toBe('/barcodes/generate');
    });

    it('is a string constant', () => {
      expect(typeof BARCODE_ROUTES.GENERATE).toBe('string');
    });

    it('does not include /api prefix', () => {
      expect(BARCODE_ROUTES.GENERATE).not.toContain('/api/');
    });
  });
});

describe('STOCK_INTAKE_ROUTES', () => {
  describe('SCAN', () => {
    it('returns the correct path for a valid UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = STOCK_INTAKE_ROUTES.SCAN(uuid);
      expect(result).toBe('/stock-intake-lines/550e8400-e29b-41d4-a716-446655440000/scan');
    });

    it('is a function', () => {
      expect(typeof STOCK_INTAKE_ROUTES.SCAN).toBe('function');
    });

    it('does not include /api prefix', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = STOCK_INTAKE_ROUTES.SCAN(uuid);
      expect(result).not.toContain('/api/');
    });

    it('encodes special characters in the UUID', () => {
      const uuidWithSpecialChars = 'test-id-with-@-symbol';
      const result = STOCK_INTAKE_ROUTES.SCAN(uuidWithSpecialChars);
      // The @ should be encoded as %40
      expect(result).toContain('test-id-with-%40-symbol');
    });

    it('throws an error when UUID is null', () => {
      expect(() => {
        STOCK_INTAKE_ROUTES.SCAN(null);
      }).toThrow('stockIntakeLineUuid must be a non-empty string');
    });

    it('throws an error when UUID is undefined', () => {
      expect(() => {
        STOCK_INTAKE_ROUTES.SCAN(undefined);
      }).toThrow('stockIntakeLineUuid must be a non-empty string');
    });

    it('throws an error when UUID is an empty string', () => {
      expect(() => {
        STOCK_INTAKE_ROUTES.SCAN('');
      }).toThrow('stockIntakeLineUuid must not be empty or whitespace-only');
    });

    it('throws an error when UUID is whitespace-only', () => {
      expect(() => {
        STOCK_INTAKE_ROUTES.SCAN('   ');
      }).toThrow('stockIntakeLineUuid must not be empty or whitespace-only');
    });

    it('throws an error when UUID is not a string', () => {
      expect(() => {
        STOCK_INTAKE_ROUTES.SCAN(123);
      }).toThrow('stockIntakeLineUuid must be a non-empty string');
    });

    it('throws an error when UUID is an object', () => {
      expect(() => {
        STOCK_INTAKE_ROUTES.SCAN({});
      }).toThrow('stockIntakeLineUuid must be a non-empty string');
    });

    it('trims whitespace from the UUID before encoding', () => {
      const uuidWithWhitespace = '  550e8400-e29b-41d4-a716-446655440000  ';
      const result = STOCK_INTAKE_ROUTES.SCAN(uuidWithWhitespace);
      expect(result).toBe('/stock-intake-lines/550e8400-e29b-41d4-a716-446655440000/scan');
    });
  });
});
