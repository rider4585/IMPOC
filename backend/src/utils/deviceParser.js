/**
 * Device and client info parser
 * Zero external dependencies, robust regex-based detection
 */

function parseBrowser(ua) {
    if (!ua) return 'Unknown';
    if (/edg(?:e|a|ios)?\//i.test(ua)) return 'Edge';
    if (/opr\/|opera/i.test(ua)) return 'Opera';
    if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
    if (/chrome|crios/i.test(ua)) return 'Chrome';
    if (/firefox|fxios/i.test(ua)) return 'Firefox';
    if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) return 'Safari';
    if (/msie|trident/i.test(ua)) return 'Internet Explorer';
    return 'Other';
}

function parseOS(ua) {
    if (!ua) return 'Unknown';
    if (/windows/i.test(ua)) return 'Windows';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
    if (/android/i.test(ua)) return 'Android';
    if (/macintosh|mac os x/i.test(ua)) return 'macOS';
    if (/cros/i.test(ua)) return 'Chrome OS';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Other';
}

function parseDeviceType(ua) {
    if (!ua) return 'unknown';
    // Check tablet before mobile (many tablets include 'Safari' or 'Android' without 'Mobile')
    if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
        return 'tablet';
    }
    if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(ua)) {
        return 'mobile';
    }
    if (/windows|macintosh|linux|cros/i.test(ua)) {
        return 'desktop';
    }
    return 'unknown';
}

export const parseClientInfo = (req = {}) => {
    const headers = req?.headers || {};
    const rawIp =
        headers['x-forwarded-for'] ||
        req?.socket?.remoteAddress ||
        req?.ip ||
        '127.0.0.1';

    const ipAddress =
        (typeof rawIp === 'string' ? rawIp : '127.0.0.1')
            .split(',')[0]
            .trim()
            .replace(/^::ffff:/, '') || '127.0.0.1';

    const userAgent = (headers['user-agent'] || '').trim();

    return {
        ipAddress,
        userAgent,
        deviceType: parseDeviceType(userAgent),
        browser: parseBrowser(userAgent),
        os: parseOS(userAgent),
    };
};

export default {
    parseClientInfo,
};
