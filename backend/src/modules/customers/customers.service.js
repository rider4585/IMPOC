import { Customer, sequelize } from '../../../database/models/index.js';
import { Sequelize } from '../../../database/models/index.js';

const CONSENT_CHANNELS = {
    WHATSAPP: 'consentWhatsapp',
    EMAIL: 'consentEmail',
    SMS: 'consentSms',
    WHATSAPP_GROUP: 'consentWhatsappGroup',
};

function mapCustomerDTO(customer) {
    return {
        uuid: customer.uuid,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        dob: customer.dob,
        address: customer.address,
        notes: customer.notes,
        consentWhatsapp: customer.consentWhatsapp,
        consentEmail: customer.consentEmail,
        consentSms: customer.consentSms,
        consentWhatsappGroup: customer.consentWhatsappGroup,
        consentRecordedAt: customer.consentRecordedAt,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
    };
}

function uniqueError(field) {
    const error = new Error(`A customer with this ${field} already exists`);
    error.statusCode = 409;
    return error;
}

/**
 * Resolve a unique violation into a friendly 409. Sequelize throws
 * UniqueConstraintError (or wraps a raw SequelizeUniqueConstraintError)
 * when a partial unique index on phone/email fires.
 */
function rethrowUnique(error) {
    if (
        error.name === 'SequelizeUniqueConstraintError' ||
        (error.errors || []).some((e) => e.type === 'unique violation')
    ) {
        const fields = (error.fields && Object.keys(error.fields)) || [];
        const field = fields[0] || 'field';
        throw uniqueError(field);
    }
    throw error;
}

/**
 * Create a customer. name is required; phone/email are unique when present.
 */
export const createCustomer = async (payload) => {
    const customer = await Customer.create({
        name: payload.name,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        dob: payload.dob ?? null,
        address: payload.address ?? null,
        notes: payload.notes ?? null,
        consentWhatsapp: payload.consentWhatsapp ?? false,
        consentEmail: payload.consentEmail ?? false,
        consentSms: payload.consentSms ?? false,
        consentWhatsappGroup: payload.consentWhatsappGroup ?? false,
        consentRecordedAt: (payload.consentWhatsapp || payload.consentEmail || payload.consentSms || payload.consentWhatsappGroup)
            ? new Date()
            : null,
    }).catch(rethrowUnique);

    return mapCustomerDTO(customer);
};

/**
 * List customers, newest first. Partial match on name, phone, or email.
 * Empty search returns the most recent 20.
 */
export const listCustomers = async ({ search } = {}) => {
    const where = { deletedAt: null };

    if (search && search.trim()) {
        const term = search.trim();
        where[Sequelize.Op.or] = [
            { name: { [Sequelize.Op.iLike]: `%${term}%` } },
            { phone: { [Sequelize.Op.iLike]: `%${term}%` } },
            { email: { [Sequelize.Op.iLike]: `%${term}%` } },
        ];
    }

    const customers = await Customer.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: search && search.trim() ? 50 : 20,
    });

    return customers.map(mapCustomerDTO);
};

/**
 * Get a single customer by uuid.
 */
export const getCustomerByUuid = async (uuid) => {
    const customer = await Customer.findOne({ where: { uuid, deletedAt: null } });
    return customer ? mapCustomerDTO(customer) : null;
};

/**
 * Update a customer by uuid (partial update).
 */
export const updateCustomer = async ({ uuid, payload }) => {
    const customer = await Customer.findOne({ where: { uuid, deletedAt: null } });
    if (!customer) {
        const error = new Error('Customer not found');
        error.statusCode = 404;
        throw error;
    }

    const updates = {};
    for (const key of ['name', 'phone', 'email', 'dob', 'address', 'notes']) {
        if (key in payload) {
            updates[key] = payload[key] ?? null;
        }
    }

    const consentFields = ['consentWhatsapp', 'consentEmail', 'consentSms', 'consentWhatsappGroup'];
    let consentChanged = false;
    for (const key of consentFields) {
        if (typeof payload[key] === 'boolean') {
            updates[key] = payload[key];
            consentChanged = true;
        }
    }

    if (Object.keys(updates).length > 0) {
        if (consentChanged) {
            updates.consentRecordedAt = new Date();
        }
        await customer.update(updates, { individualHooks: false }).catch(rethrowUnique);
    }

    return mapCustomerDTO(customer);
};

/**
 * Set (or clear) a single consent channel on a customer.
 */
export const updateConsent = async ({ uuid, channel, consented }) => {
    const attribute = CONSENT_CHANNELS[channel];
    if (!attribute) {
        const error = new Error(`Unknown consent channel: ${channel}`);
        error.statusCode = 400;
        throw error;
    }

    const customer = await Customer.findOne({ where: { uuid, deletedAt: null } });
    if (!customer) {
        const error = new Error('Customer not found');
        error.statusCode = 404;
        throw error;
    }

    await customer.update({
        [attribute]: consented,
        consentRecordedAt: consented ? new Date() : null,
    });

    return mapCustomerDTO(customer);
};

/**
 * Soft delete a customer.
 */
export const deleteCustomer = async (uuid) => {
    const customer = await Customer.findOne({ where: { uuid, deletedAt: null } });
    if (!customer) {
        const error = new Error('Customer not found');
        error.statusCode = 404;
        throw error;
    }

    await customer.destroy();
    return { deleted: true };
};