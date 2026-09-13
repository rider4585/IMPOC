import { updateBarcodeLayoutSchema } from './barcode-layout.validation.js';
import { getLayout, updateLayout } from './barcode-layout.service.js';

export const getBarcodeLayout = async (req, res, next) => {
    try {
        const layout = await getLayout();
        return res.status(200).json({ success: true, data: layout });
    } catch (error) {
        next(error);
    }
};

export const putBarcodeLayout = async (req, res, next) => {
    try {
        const data = updateBarcodeLayoutSchema.parse(req.body);
        const layout = await updateLayout(data, req.auth?.userUuid);
        return res.status(200).json({ success: true, data: layout });
    } catch (error) {
        next(error);
    }
};
