import apiClient from '../platform/apiClient.js';

/**
 * Checks whether an IP address or hostname is loopback / localhost.
 */
export function isLoopbackAddress(address) {
  if (!address) return true;
  const clean = String(address).trim().toLowerCase();
  return (
    clean === 'localhost' ||
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean.startsWith('127.')
  );
}

/**
 * System Network API (Ticket R-67):
 * Fetches dynamic local network information (interfaces, primary LAN URL, port)
 * from the backend for generating Wi-Fi access QR codes and share links.
 *
 * Harmonizes the companion URL with the current client's protocol (e.g. https: in dev for camera SSL)
 * and active port (e.g. 5173/5174 in Vite dev or 3000 in production).
 */
export async function getNetworkInfo() {
  const clientProtocol = typeof window !== 'undefined' && window.location?.protocol
    ? window.location.protocol
    : 'http:';
  const clientPort = typeof window !== 'undefined' && window.location?.port
    ? window.location.port
    : '';
  const portSuffix = clientPort ? `:${clientPort}` : '';

  try {
    const res = await apiClient.get('/system/network');
    // Handle both wrapped { success, data } and raw data payloads
    const payload = res?.data?.data || res?.data;

    if (!payload || (!payload.primaryUrl && !payload.interfaces)) {
      throw new Error('Invalid response received from network API');
    }

    const rawInterfaces = Array.isArray(payload.interfaces) ? payload.interfaces : [];

    // Filter to only non-loopback LAN interfaces
    const lanInterfaces = rawInterfaces.filter(
      (iface) => iface?.address && !isLoopbackAddress(iface.address)
    );

    const hasLan = lanInterfaces.length > 0;
    const isLoopback = payload.isLoopback || !hasLan;

    // Harmonize interface URLs with active web application protocol and port
    const interfaces = (hasLan ? lanInterfaces : rawInterfaces).map((iface, index) => {
      const activePortSuffix = portSuffix || (payload.port ? `:${payload.port}` : '');
      const url = `${clientProtocol}//${iface.address}${activePortSuffix}`;
      return {
        ...iface,
        url,
        isDefault: index === 0,
      };
    });

    const primaryUrl = interfaces.length > 0 ? interfaces[0].url : '';

    return {
      success: true,
      port: clientPort || payload.port || 3000,
      backendPort: payload.port || 3000,
      primaryUrl,
      interfaces,
      isLoopback,
    };
  } catch (error) {
    console.warn('Could not fetch system network info from backend:', error);

    // If the client is already accessing via a real LAN IP (not localhost), use window.location
    const clientHost = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
    if (clientHost && !isLoopbackAddress(clientHost)) {
      const lanUrl = `${clientProtocol}//${clientHost}${portSuffix}`;
      return {
        success: true,
        port: clientPort || 3000,
        backendPort: 3000,
        primaryUrl: lanUrl,
        interfaces: [
          {
            name: 'lan',
            address: clientHost,
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            cidr: null,
            url: lanUrl,
            isDefault: true,
          },
        ],
        isLoopback: false,
      };
    }

    // Never return localhost as a Wi-Fi URL! Return an explicit failure status
    return {
      success: false,
      error: 'Cannot reach backend server to detect Wi-Fi IP. Please check that the server is running.',
      port: clientPort || 3000,
      backendPort: 3000,
      primaryUrl: '',
      interfaces: [],
      isLoopback: true,
    };
  }
}
