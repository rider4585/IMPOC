import {
    createEnquiryBodySchema,
    updateEnquiryBodySchema,
    listEnquiriesQuerySchema,
    enquiryUuidParamSchema,
    closeEnquiryBodySchema,
} from './enquiries.validation.js';
import {
    createEnquiry as createEnquiryService,
    listEnquiries as listEnquiriesService,
    getEnquiryByUuid as getEnquiryByUuidService,
    updateEnquiry as updateEnquiryService,
    closeEnquiry as closeEnquiryService,
    reopenEnquiry as reopenEnquiryService,
} from './enquiries.service.js';

/**
 * POST /api/enquiries - Log an enquiry (existing or brand-new customer)
 */
export const createEnquiry = async (req, res, next) => {
    try {
        const body = createEnquiryBodySchema.parse(req.body);
        const enquiry = await createEnquiryService({ payload: body, actorUserId: req.user?.id });
        return res.status(201).json({ success: true, data: { enquiry } });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/enquiries - List enquiries (?status, ?search, ?customerUuid, ?limit, ?offset)
 */
export const listEnquiries = async (req, res, next) => {
    try {
        const query = listEnquiriesQuerySchema.parse(req.query);
        const data = await listEnquiriesService(query);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/enquiries/:uuid
 */
export const getEnquiryByUuid = async (req, res, next) => {
    try {
        const { uuid } = enquiryUuidParamSchema.parse(req.params);
        const enquiry = await getEnquiryByUuidService(uuid);
        if (!enquiry) {
            return res.status(404).json({ success: false, message: `Enquiry with UUID ${uuid} not found` });
        }
        return res.status(200).json({ success: true, data: { enquiry } });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/enquiries/:uuid
 */
export const updateEnquiry = async (req, res, next) => {
    try {
        const { uuid } = enquiryUuidParamSchema.parse(req.params);
        const body = updateEnquiryBodySchema.parse(req.body);
        const enquiry = await updateEnquiryService({ uuid, payload: body });
        return res.status(200).json({ success: true, data: { enquiry } });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/enquiries/:uuid/close
 */
export const closeEnquiry = async (req, res, next) => {
    try {
        const { uuid } = enquiryUuidParamSchema.parse(req.params);
        const body = closeEnquiryBodySchema.parse(req.body);
        const { enquiry, handoffs } = await closeEnquiryService({
            uuid,
            notify: body.notify,
            channels: body.channels ?? [],
            note: body.note,
            actorUserId: req.user?.id,
        });
        return res.status(200).json({ success: true, data: { enquiry, handoffs } });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/enquiries/:uuid/reopen
 */
export const reopenEnquiry = async (req, res, next) => {
    try {
        const { uuid } = enquiryUuidParamSchema.parse(req.params);
        const enquiry = await reopenEnquiryService({ uuid });
        return res.status(200).json({ success: true, data: { enquiry } });
    } catch (error) {
        next(error);
    }
};
