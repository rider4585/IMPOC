import { getNetworkInfo } from './system.service.js';

/**
 * GET /api/system/network — Public endpoint returning local Wi-Fi / LAN IP addresses
 * and connection URLs for connecting companion devices (Ticket R-67).
 */
export const getNetworkInfoHandler = async (req, res, next) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        const networkInfo = getNetworkInfo();
        return res.status(200).json({
            success: true,
            data: networkInfo,
            ...networkInfo,
        });
    } catch (error) {
        next(error);
    }
};
