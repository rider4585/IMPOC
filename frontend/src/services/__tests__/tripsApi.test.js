import { describe, it, expect, beforeEach, vi } from 'vitest';
import apiClient from '../../platform/apiClient.js';
import { STOCK_ROUTES } from '../../platform/routes.js';

// Automock the shared axios instance (see BarcodePrintScreen.test.js for the convention)
vi.mock('../../platform/apiClient.js');

// Import after mocking
import { createStock } from '../tripsApi.js';

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