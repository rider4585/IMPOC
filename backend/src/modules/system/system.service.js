import os from 'node:os';

/**
 * Heuristic scoring for network interfaces to prioritize Wi-Fi / LAN connections
 * suitable for mobile devices on the same local network.
 */
function scoreInterface(name, address) {
    let score = 0;
    const lowerName = name.toLowerCase();

    // Priority 1: explicitly named Wi-Fi or wireless interfaces
    if (/wi-?fi|wlan|wireless/i.test(lowerName)) {
        score += 100;
    }
    // Priority 2: macOS standard primary Wi-Fi / interface
    else if (lowerName === 'en0') {
        score += 80;
    }
    // Priority 3: other ethernet/network interfaces
    else if (/^en\d+$/i.test(lowerName)) {
        score += 60;
    } else if (/eth/i.test(lowerName)) {
        score += 50;
    }

    // IP address subnet weighting:
    // 192.168.x.x is the most common router/AP Wi-Fi subnet
    if (address.startsWith('192.168.')) {
        score += 20;
    } else if (address.startsWith('10.')) {
        score += 15;
    } else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) {
        score += 10;
    }

    return score;
}

/**
 * Inspects host network interfaces and returns IPv4 addresses for LAN access.
 *
 * @param {Object} [options]
 * @param {Record<string, os.NetworkInterfaceInfo[]>} [options.networkInterfaces] - Optional injection for testing
 * @param {string|number} [options.port] - Optional port override for testing
 * @returns {{ port: number|string, primaryUrl: string, interfaces: Array<{ name: string, address: string, family: string, mac: string, cidr: string|null, url: string, isDefault: boolean }> }}
 */
export function getNetworkInfo(options = {}) {
    const rawPort = options.port !== undefined ? options.port : (process.env.PORT || 3000);
    const port = Number(rawPort) || rawPort;
    const allInterfaces = options.networkInterfaces || os.networkInterfaces();

    const candidates = [];

    for (const [name, netList] of Object.entries(allInterfaces)) {
        if (!Array.isArray(netList)) continue;

        for (const net of netList) {
            const isIpv4 = net.family === 'IPv4' || net.family === 4;
            if (isIpv4 && !net.internal) {
                candidates.push({
                    name,
                    address: net.address,
                    family: typeof net.family === 'number' ? 'IPv4' : net.family,
                    mac: net.mac || '',
                    cidr: net.cidr || null,
                    url: `http://${net.address}:${port}`,
                });
            }
        }
    }

    // If no active external interfaces (e.g. machine is offline / disconnected),
    // fall back gracefully to localhost (127.0.0.1).
    if (candidates.length === 0) {
        const fallbackAddress = '127.0.0.1';
        const fallbackUrl = `http://${fallbackAddress}:${port}`;
        return {
            port,
            primaryUrl: fallbackUrl,
            interfaces: [
                {
                    name: 'localhost',
                    address: fallbackAddress,
                    family: 'IPv4',
                    mac: '00:00:00:00:00:00',
                    cidr: '127.0.0.1/8',
                    url: fallbackUrl,
                    isDefault: true,
                },
            ],
            isLoopback: true,
        };
    }

    // Sort by priority so that Wi-Fi / wireless / en0 comes first
    candidates.sort((a, b) => {
        const scoreA = scoreInterface(a.name, a.address);
        const scoreB = scoreInterface(b.name, b.address);
        if (scoreB !== scoreA) {
            return scoreB - scoreA;
        }
        return a.name.localeCompare(b.name);
    });

    const interfaces = candidates.map((item, index) => ({
        ...item,
        isDefault: index === 0,
    }));

    const primaryAddress = interfaces[0].address;
    const primaryUrl = `http://${primaryAddress}:${port}`;

    return {
        port,
        primaryUrl,
        interfaces,
        isLoopback: false,
    };
}
