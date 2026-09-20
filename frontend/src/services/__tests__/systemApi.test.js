import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getNetworkInfo } from '../systemApi.js';
import apiClient from '../../platform/apiClient.js';

describe('systemApi - getNetworkInfo (R-67)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches network info successfully from backend API', async () => {
    const mockData = {
      port: 3000,
      primaryUrl: 'http://192.168.1.100:3000',
      interfaces: [
        {
          name: 'en0',
          address: '192.168.1.100',
          url: 'http://192.168.1.100:3000',
          isDefault: true,
        },
      ],
    };

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: mockData,
      },
    });

    const result = await getNetworkInfo();
    expect(result.primaryUrl).toBe('http://192.168.1.100:3000');
    expect(result.interfaces).toHaveLength(1);
    expect(apiClient.get).toHaveBeenCalledWith('/system/network');
  });

  it('falls back to window.location when backend is unreachable', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Network error'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getNetworkInfo();
    expect(result).toBeDefined();
    expect(result.primaryUrl).toMatch(/^https?:\/\//);
    expect(result.interfaces).toHaveLength(1);
    expect(result.interfaces[0].isDefault).toBe(true);
  });
});
