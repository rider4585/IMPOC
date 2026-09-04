import { describe, it, expect } from 'vitest';
import {
  BARCODE_ROUTES,
  TRIP_ROUTES,
  STOCK_ROUTES,
  TEMPLATE_ROUTES,
  SALES_ROUTES,
  RENTAL_ROUTES,
  EXPENSE_ROUTES,
  UNIT_ROUTES,
  CUSTOMER_ROUTES,
  RECEIPT_ROUTES,
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

describe('TRIP_ROUTES', () => {
  it('exposes list/create constants', () => {
    expect(TRIP_ROUTES.LIST).toBe('/trips');
    expect(TRIP_ROUTES.CREATE).toBe('/trips');
  });

  it('builds a GET path for a trip uuid', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(TRIP_ROUTES.GET(uuid)).toBe(`/trips/${uuid}`);
  });

  it('builds the add-vendor path', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(TRIP_ROUTES.ADD_VENDOR(uuid)).toBe(`/trips/${uuid}/vendors`);
    expect(TRIP_ROUTES.ADD_VENDOR(uuid)).not.toContain('/api/');
  });

  it('builds the clone-last-stock path', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(TRIP_ROUTES.CLONE_LAST_STOCK(uuid)).toBe(`/trips/${uuid}/clone-last-stock`);
    expect(TRIP_ROUTES.CLONE_LAST_STOCK(uuid)).not.toContain('/api/');
  });
});

describe('STOCK_ROUTES', () => {
  describe('SCAN', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';

    it('returns the correct path under the stocks mount', () => {
      expect(STOCK_ROUTES.SCAN(uuid)).toBe(`/stocks/${uuid}/scan`);
    });

    it('is a function', () => {
      expect(typeof STOCK_ROUTES.SCAN).toBe('function');
    });

    it('does not include /api prefix', () => {
      expect(STOCK_ROUTES.SCAN(uuid)).not.toContain('/api/');
    });

    it('encodes special characters in the param', () => {
      const result = STOCK_ROUTES.SCAN('stock@y');
      expect(result).toContain('stock%40y');
    });
  });

  it('builds list/create/update paths under the trip', () => {
    const trip = '11111111-1111-4111-8111-111111111111';
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(STOCK_ROUTES.LIST(trip)).toBe(`/trips/${trip}/stocks`);
    expect(STOCK_ROUTES.CREATE(trip)).toBe(`/trips/${trip}/stocks`);
    expect(STOCK_ROUTES.UPDATE(trip, uuid)).toBe(`/trips/${trip}/stocks/${uuid}`);
  });

  it('builds a GET path for a single stock', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(STOCK_ROUTES.GET(uuid)).toBe(`/stocks/${uuid}`);
  });
});

describe('TEMPLATE_ROUTES', () => {
  it('list/create are constants', () => {
    expect(TEMPLATE_ROUTES.LIST).toBe('/templates');
    expect(TEMPLATE_ROUTES.CREATE).toBe('/templates');
  });

  it('builds GET/UPDATE/DELETE paths for a template uuid', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(TEMPLATE_ROUTES.GET(uuid)).toBe(`/templates/${uuid}`);
    expect(TEMPLATE_ROUTES.UPDATE(uuid)).toBe(`/templates/${uuid}`);
    expect(TEMPLATE_ROUTES.DELETE(uuid)).toBe(`/templates/${uuid}`);
    expect(TEMPLATE_ROUTES.DELETE(uuid)).not.toContain('/api/');
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

describe('RENTAL_ROUTES', () => {
  it('list/create are constants', () => {
    expect(RENTAL_ROUTES.LIST).toBe('/rentals');
    expect(RENTAL_ROUTES.CREATE).toBe('/rentals');
  });

  it('builds GET/RETURN/CANCEL paths for an agreement uuid', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(RENTAL_ROUTES.GET(uuid)).toBe(`/rentals/${uuid}`);
    expect(RENTAL_ROUTES.RETURN(uuid)).toBe(`/rentals/${uuid}/return`);
    expect(RENTAL_ROUTES.CANCEL(uuid)).toBe(`/rentals/${uuid}/cancel`);
    expect(RENTAL_ROUTES.CANCEL(uuid)).not.toContain('/api/');
  });
});

describe('EXPENSE_ROUTES', () => {
  it('list/create are constants', () => {
    expect(EXPENSE_ROUTES.LIST).toBe('/expenses');
    expect(EXPENSE_ROUTES.CREATE).toBe('/expenses');
  });

  it('builds GET/UPDATE/CANCEL paths for an expense uuid', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(EXPENSE_ROUTES.GET(uuid)).toBe(`/expenses/${uuid}`);
    expect(EXPENSE_ROUTES.UPDATE(uuid)).toBe(`/expenses/${uuid}`);
    expect(EXPENSE_ROUTES.CANCEL(uuid)).toBe(`/expenses/${uuid}/cancel`);
    expect(EXPENSE_ROUTES.CANCEL(uuid)).not.toContain('/api/');
  });
});

describe('CUSTOMER_ROUTES', () => {
  it('list/create are constants', () => {
    expect(CUSTOMER_ROUTES.LIST).toBe('/customers');
    expect(CUSTOMER_ROUTES.CREATE).toBe('/customers');
    expect(CUSTOMER_ROUTES.LIST).not.toContain('/api/');
  });

  it('builds GET/UPDATE/CONSENT paths for a customer uuid', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(CUSTOMER_ROUTES.GET(uuid)).toBe(`/customers/${uuid}`);
    expect(CUSTOMER_ROUTES.UPDATE(uuid)).toBe(`/customers/${uuid}`);
    expect(CUSTOMER_ROUTES.CONSENT(uuid)).toBe(`/customers/${uuid}/consent`);
    expect(CUSTOMER_ROUTES.CONSENT(uuid)).not.toContain('/api/');
  });

  it('encodes special characters in the uuid param', () => {
    expect(CUSTOMER_ROUTES.CONSENT('a b')).toBe('/customers/a%20b/consent');
  });
});

describe('RECEIPT_ROUTES', () => {
  it('exposes preview + print constants', () => {
    expect(RECEIPT_ROUTES.PREVIEW).toBe('/receipts/preview');
    expect(RECEIPT_ROUTES.PRINT).toBe('/receipts/print');
    expect(RECEIPT_ROUTES.PRINT).not.toContain('/api/');
  });
});