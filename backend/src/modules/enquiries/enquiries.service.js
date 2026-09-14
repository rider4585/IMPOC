import {
    CustomerEnquiry,
    Customer,
    ProductType,
    Colour,
    Size,
    User,
    DeliveryLog,
    Sequelize,
    sequelize,
} from '../../../database/models/index.js';
import { escapeLike } from '../../utils/escapeLike.js';
import { createCustomer } from '../customers/customers.service.js';
import { getShopName } from '../branding/branding.service.js';
import { buildAvailableMessage, channelReadiness, buildHandoffLink } from './enquiries.notify.js';

const { Op } = Sequelize;

const INCLUDES = [
    { model: Customer, as: 'customer', attributes: ['uuid', 'name', 'phone', 'email', 'consentWhatsapp', 'consentEmail', 'consentSms'], paranoid: false },
    { model: ProductType, as: 'productType', attributes: ['uuid', 'name'], paranoid: false },
    { model: Colour, as: 'colour', attributes: ['uuid', 'name'], paranoid: false },
    { model: Size, as: 'size', attributes: ['uuid', 'name'], paranoid: false },
    { model: User, as: 'createdBy', attributes: ['uuid', 'firstName', 'lastName', 'username'] },
    { model: User, as: 'closedBy', attributes: ['uuid', 'firstName', 'lastName', 'username'] },
];

function httpError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function userLabel(user) {
    if (!user) {
        return null;
    }
    const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return full || user.username || null;
}

function refDTO(row) {
    return row ? { uuid: row.uuid, name: row.name } : null;
}

export function mapEnquiryDTO(enquiry) {
    return {
        uuid: enquiry.uuid,
        status: enquiry.status,
        description: enquiry.description,
        notes: enquiry.notes,
        promisedDate: enquiry.promisedDate,
        customer: enquiry.customer
            ? {
                uuid: enquiry.customer.uuid,
                name: enquiry.customer.name,
                phone: enquiry.customer.phone,
                email: enquiry.customer.email,
                consentWhatsapp: enquiry.customer.consentWhatsapp,
                consentEmail: enquiry.customer.consentEmail,
                consentSms: enquiry.customer.consentSms,
            }
            : null,
        productType: refDTO(enquiry.productType),
        colour: refDTO(enquiry.colour),
        size: refDTO(enquiry.size),
        notifiedAt: enquiry.notifiedAt,
        notifiedChannels: enquiry.notifiedChannels ? enquiry.notifiedChannels.split(',') : [],
        channelReadiness: enquiry.customer ? channelReadiness(enquiry.customer) : null,
        closedAt: enquiry.closedAt,
        closedReason: enquiry.closedReason,
        closedNote: enquiry.closedNote,
        closedBy: userLabel(enquiry.closedBy),
        createdBy: userLabel(enquiry.createdBy),
        createdAt: enquiry.createdAt,
        updatedAt: enquiry.updatedAt,
    };
}

/**
 * Resolve an optional picklist uuid to its id. `undefined` = not supplied
 * (leave alone), `null` = clear, a uuid must exist (active or not — an
 * enquiry can still point at a retired colour).
 */
async function resolveRef(model, uuid, label, transaction) {
    if (uuid === undefined) {
        return undefined;
    }
    if (uuid === null) {
        return null;
    }
    const row = await model.findOne({ where: { uuid, deletedAt: null }, attributes: ['id'], transaction });
    if (!row) {
        throw httpError(`${label} not found`, 400);
    }
    return row.id;
}

async function resolveRefs(payload, transaction) {
    const [productTypeId, colourId, sizeId] = await Promise.all([
        resolveRef(ProductType, payload.productTypeUuid, 'Product type', transaction),
        resolveRef(Colour, payload.colourUuid, 'Colour', transaction),
        resolveRef(Size, payload.sizeUuid, 'Size', transaction),
    ]);
    return { productTypeId, colourId, sizeId };
}

async function loadEnquiry(uuid, transaction) {
    const enquiry = await CustomerEnquiry.findOne({
        where: { uuid, deletedAt: null },
        include: INCLUDES,
        transaction,
    });
    if (!enquiry) {
        throw httpError('Enquiry not found', 404);
    }
    return enquiry;
}

/**
 * Log an enquiry. Either attach it to an existing customer (customerUuid) or
 * create the customer in the same transaction (customer). A duplicate
 * phone/email on the inline customer surfaces as the customers module's 409
 * so the counter can pick the existing person instead.
 */
export const createEnquiry = async ({ payload, actorUserId }) => {
    const uuid = await sequelize.transaction(async (transaction) => {
        let customerId;
        if (payload.customerUuid) {
            const customer = await Customer.findOne({
                where: { uuid: payload.customerUuid, deletedAt: null },
                attributes: ['id'],
                transaction,
            });
            if (!customer) {
                throw httpError('Customer not found', 400);
            }
            customerId = customer.id;
        } else {
            const created = await createCustomer(payload.customer, { transaction });
            const row = await Customer.findOne({ where: { uuid: created.uuid }, attributes: ['id'], transaction });
            customerId = row.id;
        }

        const refs = await resolveRefs(payload, transaction);

        const enquiry = await CustomerEnquiry.create(
            {
                customerId,
                productTypeId: refs.productTypeId ?? null,
                colourId: refs.colourId ?? null,
                sizeId: refs.sizeId ?? null,
                description: payload.description,
                notes: payload.notes ?? null,
                promisedDate: payload.promisedDate ?? null,
                status: 'OPEN',
                createdByUserId: actorUserId ?? null,
            },
            { transaction }
        );
        return enquiry.uuid;
    });

    return mapEnquiryDTO(await loadEnquiry(uuid));
};

/**
 * List enquiries, newest first, plus a per-status count so the tabs can show
 * badges without a second call. Search matches customer name/phone/email and
 * the description.
 */
export const listEnquiries = async ({ status, search, customerUuid, limit, offset } = {}) => {
    const where = { deletedAt: null };
    if (status) {
        where.status = status;
    }

    const customerWhere = {};
    if (customerUuid) {
        customerWhere.uuid = customerUuid;
    }

    if (search && search.trim()) {
        // SEC-L-5: escape LIKE wildcards so "%" / "_" match literally.
        const term = `%${escapeLike(search.trim())}%`;
        where[Op.or] = [
            { description: { [Op.iLike]: term } },
            { '$customer.name$': { [Op.iLike]: term } },
            { '$customer.phone$': { [Op.iLike]: term } },
            { '$customer.email$': { [Op.iLike]: term } },
        ];
    }

    const include = INCLUDES.map((inc) =>
        inc.as === 'customer' && Object.keys(customerWhere).length > 0 ? { ...inc, where: customerWhere } : inc
    );

    const [rows, countRows] = await Promise.all([
        CustomerEnquiry.findAll({
            where,
            include,
            order: [['createdAt', 'DESC']],
            limit: limit ?? 200,
            offset: offset ?? 0,
            subQuery: false,
        }),
        CustomerEnquiry.findAll({
            where: { deletedAt: null },
            attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['status'],
            raw: true,
        }),
    ]);

    const counts = { OPEN: 0, CLOSED: 0 };
    for (const row of countRows) {
        counts[row.status] = Number(row.count);
    }

    return { enquiries: rows.map(mapEnquiryDTO), counts };
};

export const getEnquiryByUuid = async (uuid) => {
    const enquiry = await CustomerEnquiry.findOne({ where: { uuid, deletedAt: null }, include: INCLUDES });
    return enquiry ? mapEnquiryDTO(enquiry) : null;
};

/**
 * Edit what the customer asked for. Status changes go through close/reopen.
 */
export const updateEnquiry = async ({ uuid, payload }) => {
    await sequelize.transaction(async (transaction) => {
        const enquiry = await loadEnquiry(uuid, transaction);
        const refs = await resolveRefs(payload, transaction);

        const updates = {};
        if (refs.productTypeId !== undefined) updates.productTypeId = refs.productTypeId;
        if (refs.colourId !== undefined) updates.colourId = refs.colourId;
        if (refs.sizeId !== undefined) updates.sizeId = refs.sizeId;
        if (payload.description !== undefined) updates.description = payload.description;
        if (payload.notes !== undefined) updates.notes = payload.notes ?? null;
        if (payload.promisedDate !== undefined) updates.promisedDate = payload.promisedDate ?? null;

        if (Object.keys(updates).length > 0) {
            await enquiry.update(updates, { transaction });
        }
    });

    return mapEnquiryDTO(await loadEnquiry(uuid));
};

/** "Saree · Red · M — free text" for the message; falls back to the free text. */
function describeItem(enquiry) {
    const parts = [enquiry.productType?.name, enquiry.colour?.name, enquiry.size?.name].filter(Boolean);
    return parts.length > 0 ? `${parts.join(' ')} (${enquiry.description})` : enquiry.description;
}

/**
 * Close an enquiry. Two outcomes, nothing else is recorded about the sale:
 *  - notify=true: the item is available — build the message, log one
 *    delivery_logs row per chosen channel and return the tap-to-send links
 *    (hand-off, see enquiries.notify.js). A chosen channel the customer
 *    cannot be reached on is a 400, not a silent skip.
 *  - notify=false: close quietly.
 */
export const closeEnquiry = async ({ uuid, notify, channels = [], note, actorUserId }) => {
    const handoffs = [];
    await sequelize.transaction(async (transaction) => {
        const enquiry = await loadEnquiry(uuid, transaction);
        if (enquiry.status === 'CLOSED') {
            throw httpError('Enquiry is already closed', 409);
        }

        const now = new Date();
        const updates = {
            status: 'CLOSED',
            closedAt: now,
            closedReason: notify ? 'NOTIFIED' : 'NOT_NOTIFIED',
            closedNote: note ?? null,
            closedByUserId: actorUserId ?? null,
        };

        if (notify) {
            const readiness = channelReadiness(enquiry.customer);
            const blocked = channels.filter((c) => !readiness[c]?.ok);
            if (blocked.length > 0) {
                const why = blocked.map((c) => `${c}: ${readiness[c]?.reason || 'unavailable'}`).join(', ');
                throw httpError(`Cannot reach the customer on ${why}`, 400);
            }

            const shopName = await getShopName(transaction);
            const message = buildAvailableMessage({
                customerName: enquiry.customer.name,
                item: describeItem(enquiry),
                shopName,
            });

            for (const channel of channels) {
                const url = buildHandoffLink(channel, enquiry.customer, message);
                await DeliveryLog.create(
                    {
                        entityType: 'ENQUIRY',
                        entityId: enquiry.uuid,
                        channel,
                        status: 'SENT',
                        provider: 'handoff',
                        receiptPayload: {
                            kind: 'enquiry_available',
                            recipient: channel === 'EMAIL' ? enquiry.customer.email : enquiry.customer.phone,
                            subject: message.subject,
                            body: message.body,
                        },
                        sentAt: now,
                        notes: `Enquiry closed as available by user ${actorUserId ?? 'unknown'}`,
                    },
                    { transaction }
                );
                handoffs.push({ channel, url });
            }
            updates.notifiedAt = now;
            updates.notifiedChannels = channels.join(',');
        }

        await enquiry.update(updates, { transaction });
    });

    return { enquiry: mapEnquiryDTO(await loadEnquiry(uuid)), handoffs };
};

/**
 * Reopen a closed enquiry (back to OPEN; the notified_* trail is kept so
 * the history stays honest).
 */
export const reopenEnquiry = async ({ uuid }) => {
    await sequelize.transaction(async (transaction) => {
        const enquiry = await loadEnquiry(uuid, transaction);
        if (enquiry.status !== 'CLOSED') {
            throw httpError('Only a closed enquiry can be reopened', 409);
        }
        await enquiry.update(
            {
                status: 'OPEN',
                closedAt: null,
                closedReason: null,
                closedNote: null,
                closedByUserId: null,
            },
            { transaction }
        );
    });

    return mapEnquiryDTO(await loadEnquiry(uuid));
};
