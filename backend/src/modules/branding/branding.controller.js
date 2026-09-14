import { updateBrandingSchema } from './branding.validation.js';
import { getBranding, updateBranding } from './branding.service.js';

export const getBrandingHandler = async (req, res, next) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ success: true, data: await getBranding() });
    } catch (error) {
        next(error);
    }
};

export const putBrandingHandler = async (req, res, next) => {
    try {
        const data = updateBrandingSchema.parse(req.body);
        return res.status(200).json({ success: true, data: await updateBranding(data) });
    } catch (error) {
        next(error);
    }
};
