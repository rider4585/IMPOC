import { describe, it, expect } from 'vitest';
import {
  BARCODE_ROUTES,
  STOCK_INTAKE_ROUTES,
  STOCK_INTAKE_LINE_ROUTES,
  SALES_ROUTES,
  UNIT_ROUTES,
} from '../routes.js';

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
  it('exposes list/create constants', () => {
    expect(STOCK_INTAKE_ROUTES.LIST).toBe('/stock-intakes');
    expect(STOCK_INTAKE_ROUTES.CREATE).toBe('/stock-intakes');
  });

  it('builds a GET path for a trip uuid', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(STOCK_INTAKE_ROUTES.GET(uuid)).toBe(`/stock-intakes/${uuid}`);
  });

  it('builds the clone-last-lot path', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(STOCK_INTAKE_ROUTES.CLONE_LAST_LOT(uuid)).toBe(
      `/stock-intakes/${uuid}/clone-last-lot`
    );
    expect(STOCK_INTAKE_ROUTES.CLONE_LAST_LOT(uuid)).not.toContain('/api/');
  });
});

describe('STOCK_INTAKE_LINE_ROUTES', () => {
  describe('SCAN', () => {
    const trip = '11111111-1111-4111-8111-111111111111';
    const uuid = '550e8400-e29b-41d4-a716-446655440000';

    it('returns the correct path under the trip lines mount', () => {
      expect(STOCK_INTAKE_LINE_ROUTES.SCAN(trip, uuid)).toBe(
        `/stock-intakes/${trip}/lines/${uuid}/scan`
      );
    });

    it('is a function', () => {
      expect(typeof STOCK_INTAKE_LINE_ROUTES.SCAN).toBe('function');
    });

    it('does not include /api prefix', () => {
      expect(STOCK_INTAKE_LINE_ROUTES.SCAN(trip, uuid)).not.toContain('/api/');
    });

    it('encodes special characters in both params', () => {
      const result = STOCK_INTAKE_LINE_ROUTES.SCAN('trip@x', 'line@y');
      expect(result).toContain('trip%40x');
      expect(result).toContain('line%40y');
    });
  });

  it('builds list/create/update paths', () => {
    const trip = '11111111-1111-4111-8111-111111111111';
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(STOCK_INTAKE_LINE_ROUTES.LIST(trip)).toBe(`/stock-intakes/${trip}/lines`);
    expect(STOCK_INTAKE_LINE_ROUTES.CREATE(trip)).toBe(`/stock-intakes/${trip}/lines`);
    expect(STOCK_INTAKE_LINE_ROUTES.UPDATE(trip, uuid)).toBe(
      `/stock-intakes/${trip}/lines/${uuid}`
    );
  });
});

describe('SALES_ROUTES', () => {
  it('list/create are constants', () => {
    expect(SALES_ROUTES.LIST).toBe('/sales');
    expect(SALES_ROUTES.CREATE).toBe('/sales');
  });

  it('builds GET/CANCEL/REFUND paths for a sale uuid', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(SALES_ROUTES.GET(uuid)).toBe(`/sales/${uuid}`);
    expect(SALES_ROUTES.CANCEL(uuid)).toBe(`/sales/${uuid}/cancel`);
    expect(SALES_ROUTES.REFUND(uuid)).toBe(`/sales/${uuid}/refund`);
    expect(SALES_ROUTES.REFUND(uuid)).not.toContain('/api/');
  });
});

describe('UNIT_ROUTES', () => {
  it('builds the by-barcode path', () => {
    expect(UNIT_ROUTES.BY_BARCODE('ABC123')).toBe('/units/by-barcode/ABC123');
    expect(UNIT_ROUTES.BY_BARCODE('ABC123')).not.toContain('/api/');
  });

  it('builds the get path for a unit uuid', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(UNIT_ROUTES.GET(uuid)).toBe(`/units/${uuid}`);
  });
});
