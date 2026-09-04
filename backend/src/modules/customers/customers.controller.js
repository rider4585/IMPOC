import {
    createCustomerBodySchema,
    listCustomersQuerySchema,
    customerUuidParamSchema,
    updateCustomerBodySchema,
    consentBodySchema,
} from './customers.validation.js';
import {
    createCustomer as createCustomerService,
    listCustomers as listCustomersService,
    getCustomerByUuid as getCustomerByUuidService,
    updateCustomer as updateCustomerService,
    updateConsent as updateConsentService,
    deleteCustomer as deleteCustomerService,
} from './customers.service.js';

/**
 * POST /api/customers - Create a customer
 */
export const createCustomer = async (req, res, next) => {
    try {
        const body = createCustomerBodySchema.parse(req.body);
        const customer = await createCustomerService(body);
        return res.status(201).json({ success: true, data: { customer } });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/customers - List customers (optional partial search)
 */
export const listCustomers = async (req, res, next) => {
    try {
        const query = listCustomersQuerySchema.parse(req.query);
        const customers = await listCustomersService({ search: query.search });
        return res.status(200).json({ success: true, data: { customers } });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/customers/:uuid - Get a customer
 */
export const getCustomerByUuid = async (req, res, next) => {
    try {
        const { uuid } = customerUuidParamSchema.parse(req.params);
        const customer = await getCustomerByUuidService(uuid);
        if (!customer) {
            return res.status(404).json({ success: false, message: `Customer with UUID ${uuid} not found` });
        }
        return res.status(200).json({ success: true, data: { customer } });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/customers/:uuid - Update a customer
 */
export const updateCustomer = async (req, res, next) => {
    try {
        const { uuid } = customerUuidParamSchema.parse(req.params);
        const body = updateCustomerBodySchema.parse(req.body);
        const customer = await updateCustomerService({ uuid, payload: body });
        return res.status(200).json({ success: true, data: { customer } });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/customers/:uuid/consent - Set a consent channel
 */
export const updateConsent = async (req, res, next) => {
    try {
        const { uuid } = customerUuidParamSchema.parse(req.params);
        const body = consentBodySchema.parse(req.body);
        const customer = await updateConsentService({
            uuid,
            channel: body.channel,
            consented: body.consented,
        });
        return res.status(200).json({ success: true, data: { customer } });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/customers/:uuid - Soft delete a customer
 */
export const deleteCustomer = async (req, res, next) => {
    try {
        const { uuid } = customerUuidParamSchema.parse(req.params);
        const result = await deleteCustomerService(uuid);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};