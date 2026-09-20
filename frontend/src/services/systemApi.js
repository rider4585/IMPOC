import apiClient from '../platform/apiClient.js';

/**
 * System Network API (Ticket R-67):
 * Fetches dynamic local network information (interfaces, primary LAN URL, port)
 * from the backend for generating Wi-Fi access QR codes and share links.
 */
export async function getNetworkInfo() {
  try {
    const res = await apiClient.get('/system/network');
    // Handle both wrapped { success, data } and raw data payloads
    const payload = res?.data?.data || res?.data;
    if (payload && (payload.primaryUrl || payload.interfaces)) {
      return payload;
    }
    return res?.data;
  } catch (error) {
    console.warn('Could not fetch system network info from backend, using client location fallback:', error);
    const fallbackUrl = typeof window !== 'undefined' && window.location
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://127.0.0.1:3000';
    const fallbackHost = typeof window !== 'undefined' && window.location ? window.location.hostname : '127.0.0.1';
    const fallbackPort = typeof window !== 'undefined' && window.location ? window.location.port || (window.location.protocol === 'https:' ? '443' : '80') : 3000;

    return {
      port: fallbackPort,
      primaryUrl: fallbackUrl,
      interfaces: [
        {
          name: 'local',
          address: fallbackHost,
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          cidr: null,
          url: fallbackUrl,
          isDefault: true,
        },
      ],
    };
  }
}
