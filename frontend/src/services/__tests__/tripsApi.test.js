import { describe, it, expect, beforeEach, vi } from 'vitest';
import apiClient from '../../platform/apiClient.js';
import { STOCK_ROUTES } from '../../platform/routes.js';

// Automock the shared axios instance (see BarcodePrintScreen.test.js for the convention)
vi.mock('../../platform/apiClient.js');

// Import after mocking
import { getStock, scanBarcodeIntoStock, createStock } from '../tripsApi.js';

describe('tripsApi.createStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends tripUuid in the request body along with the full payload', async () => {
    const tripUuid = '6082e02e-e0ec-4e8c-8821-70c8a35cc7f8';
    const payload = {
      vendorUuid: '9f8b8ad0-7b6e-4b4e-b8a4-3a67f5b1d2e3',
      productTypeUuid: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c',
      subTypeUuid: 'c9d2e3f4-a5b6-47a8-8b7c-6d5e4f3a2b1c',
      name: 'Silk Saree',
      quantity: 5,
      buyingPricePaise: 25000,
      wholeBuyingPricePaise: 25000,
      sellingPricePaise: 45000,
      floorPricePaise: 30000,
      channel: 'RETAIL',
    };
    apiClient.post.mockResolvedValueOnce({
      data: { success: true, data: { uuid: 'e1d2c3b4-a5b6-47a8-8b7c-6d5e4f3a2b1c' } },
    });

    const result = await createStock(tripUuid, payload);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(STOCK_ROUTES.CREATE(tripUuid), {
      ...payload,
      tripUuid,
    });

    const sentBody = apiClient.post.mock.calls[0][1];
    expect(sentBody.tripUuid).toBe(tripUuid);
    for (const [key, value] of Object.entries(payload)) {
      expect(sentBody[key]).toBe(value);
    }
    expect(result.uuid).toBe('e1d2c3b4-a5b6-47a8-8b7c-6d5e4f3a2b1c');
  });

  it('propagates a server error as an Error with statusCode', async () => {
    const tripUuid = '6082e02e-e0ec-4e8c-8821-70c8a35cc7f8';
    apiClient.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: 'Invalid input: expected string, received undefined' },
      },
    });

    await expect(createStock(tripUuid, { quantity: 1 })).rejects.toThrow(
      'Invalid input: expected string, received undefined'
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      `/trips/${tripUuid}/stocks`,
      expect.objectContaining({ tripUuid })
    );
  });
});

describe('tripsApi.getStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GETs the trip-scoped single-stock route and returns the stock DTO', async () => {
    const tripUuid = '6082e02e-e0ec-4e8c-8821-70c8a35cc7f8';
    const stockUuid = 'e1d2c3b4-a5b6-47a8-8b7c-6d5e4f3a2b1c';
    apiClient.get.mockResolvedValueOnce({
      data: { success: true, data: { uuid: stockUuid, name: 'Kurti A' } },
    });

    const result = await getStock(tripUuid, stockUuid);

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith(`/trips/${tripUuid}/stocks/${stockUuid}`);
    expect(result.uuid).toBe(stockUuid);
  });
});

describe('tripsApi.scanBarcodeIntoStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs the payload to the trip-scoped scan route and returns the created unit', async () => {
    const tripUuid = '6082e02e-e0ec-4e8c-8821-70c8a35cc7f8';
    const stockUuid = 'e1d2c3b4-a5b6-47a8-8b7c-6d5e4f3a2b1c';
    const payload = { barcode: '100001', colourUuid: 'c1', sizeUuid: 's1' };
    apiClient.post.mockResolvedValueOnce({
      data: { success: true, data: { uuid: 'u1', barcode: payload.barcode } },
    });

    const result = await scanBarcodeIntoStock(tripUuid, stockUuid, payload);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
      `/trips/${tripUuid}/stocks/${stockUuid}/scan`,
      payload
    );
    expect(result.barcode).toBe(payload.barcode);
  });
});