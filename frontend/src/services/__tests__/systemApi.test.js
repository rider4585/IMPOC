import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getNetworkInfo, isLoopbackAddress } from '../systemApi.js';
import apiClient from '../../platform/apiClient.js';

describe('systemApi - getNetworkInfo (R-67)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isLoopbackAddress', () => {
    it('correctly identifies loopback addresses', () => {
      expect(isLoopbackAddress('localhost')).toBe(true);
      expect(isLoopbackAddress('127.0.0.1')).toBe(true);
      expect(isLoopbackAddress('127.0.1.1')).toBe(true);
      expect(isLoopbackAddress('::1')).toBe(true);
      expect(isLoopbackAddress('')).toBe(true);
      expect(isLoopbackAddress(null)).toBe(true);

      expect(isLoopbackAddress('192.168.1.100')).toBe(false);
      expect(isLoopbackAddress('10.0.0.1')).toBe(false);
      expect(isLoopbackAddress('172.16.0.5')).toBe(false);
    });
  });

  it('fetches network info and harmonizes with client protocol and port', async () => {
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
    expect(result.success).toBe(true);
    expect(result.primaryUrl).toContain('192.168.1.100');
    expect(result.interfaces).toHaveLength(1);
    expect(result.isLoopback).toBe(false);
    expect(apiClient.get).toHaveBeenCalledWith('/system/network');
  });

  it('filters out loopback interfaces from LAN interfaces', async () => {
    const mockData = {
      port: 3000,
      primaryUrl: 'http://192.168.1.100:3000',
      interfaces: [
        {
          name: 'lo0',
          address: '127.0.0.1',
          url: 'http://127.0.0.1:3000',
          isDefault: false,
        },
        {
          name: 'en0',
          address: '192.168.1.100',
          url: 'http://192.168.1.100:3000',
          isDefault: true,
        },
      ],
    };

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: mockData },
    });

    const result = await getNetworkInfo();
    expect(result.interfaces).toHaveLength(1);
    expect(result.interfaces[0].address).toBe('192.168.1.100');
    expect(result.isLoopback).toBe(false);
  });

  it('returns failure status and does NOT return localhost when backend is unreachable on localhost', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Network error'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getNetworkInfo();
    expect(result.success).toBe(false);
    expect(result.isLoopback).toBe(true);
    expect(result.primaryUrl).toBe('');
    expect(result.interfaces).toHaveLength(0);
    expect(result.error).toContain('Cannot reach backend server');
  });
});
