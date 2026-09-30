import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../platform/apiClient.js', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

import apiClient from '../../platform/apiClient.js';
import { listSales } from '../salesApi.js';
import { getSalesByTag } from '../reportsApi.js';

function ok(data) {
  return { data: { success: true, data } };
}

describe('sales tag query strings (R-73)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockResolvedValue(ok([]));
  });

  it('leaves the URL untouched when no tag filter is set', async () => {
    await listSales();
    expect(apiClient.get).toHaveBeenCalledWith('/sales');

    await listSales({});
    expect(apiClient.get).toHaveBeenLastCalledWith('/sales');

    await listSales({ tagUuids: [] });
    expect(apiClient.get).toHaveBeenLastCalledWith('/sales');
  });

  it('sends tagUuids as one comma-separated value (OR semantics)', async () => {
    await listSales({ tagUuids: ['uuid-a', 'uuid-b'] });
    expect(apiClient.get).toHaveBeenCalledWith('/sales?tagUuids=uuid-a%2Cuuid-b');
  });

  it('drops empty uuids instead of sending a dangling comma', async () => {
    await listSales({ tagUuids: ['uuid-a', '', null, undefined] });
    expect(apiClient.get).toHaveBeenCalledWith('/sales?tagUuids=uuid-a');
  });

  it('returns the sale array from the envelope', async () => {
    apiClient.get.mockResolvedValue(ok([{ uuid: 's1', tags: [{ uuid: 't1', name: 'Expo' }] }]));
    await expect(listSales()).resolves.toEqual([
      { uuid: 's1', tags: [{ uuid: 't1', name: 'Expo' }] },
    ]);
  });
});

describe('getSalesByTag (R-73)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockResolvedValue(ok({ period: {}, rows: [], totals: {} }));
  });

  it('calls /reports/sales-by-tag with the period bounds', async () => {
    await getSalesByTag({ from: '2026-09-01', to: '2026-09-30' });
    expect(apiClient.get).toHaveBeenCalledWith('/reports/sales-by-tag?from=2026-09-01&to=2026-09-30');
  });

  it('appends tagUuids as a comma-separated list', async () => {
    await getSalesByTag({ from: '2026-09-01', to: '2026-09-30', tagUuids: ['t1', 't2'] });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/reports/sales-by-tag?from=2026-09-01&to=2026-09-30&tagUuids=t1%2Ct2'
    );
  });

  it('omits the query string entirely when called bare', async () => {
    await getSalesByTag();
    expect(apiClient.get).toHaveBeenCalledWith('/reports/sales-by-tag');
  });

  it('returns the report payload untouched', async () => {
    const payload = {
      period: { from: '2026-09-01', to: '2026-09-30' },
      rows: [{ tagUuid: null, tagName: 'Untagged', count: 1, grossPaise: '1000', refundedPaise: '0', netPaise: '1000', unitsSold: 2 }],
      totals: { count: 1, grossPaise: '1000', refundedPaise: '0', netPaise: '1000', unitsSold: 2, salesWithMultipleTags: 0 },
    };
    apiClient.get.mockResolvedValue(ok(payload));
    await expect(getSalesByTag({ from: '2026-09-01', to: '2026-09-30' })).resolves.toEqual(payload);
  });
});
