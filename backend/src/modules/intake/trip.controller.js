import {
    createTripSchema,
    tripUuidParamSchema,
    addTripVendorSchema,
} from './trip.validation.js';
import {
    listTrips as listTripsService,
    createTrip as createTripService,
    getTripByUuid as getTripByUuidService,
    addTripVendor as addTripVendorService,
    getLastStockForTrip as getLastStockForTripService,
} from './trip.service.js';

/**
 * HTML escape function to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
    if (!text || typeof text !== 'string') return text;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, char => map[char]);
}

function escapeTripDTO(trip) {
    return {
        ...trip,
        name: escapeHtml(trip.name),
        notes: trip.notes ? escapeHtml(trip.notes) : null,
    };
}

function escapeTripVendorDTO(tripVendor) {
    return {
        ...tripVendor,
        billReference: tripVendor.billReference ? escapeHtml(tripVendor.billReference) : null,
        notes: tripVendor.notes ? escapeHtml(tripVendor.notes) : null,
    };
}

export const getTrips = async (req, res, next) => {
    try {
        const trips = await listTripsService();

        return res.status(200).json({
            success: true,
            data: trips.map(escapeTripDTO),
        });
    } catch (error) {
        next(error);
    }
};

export const createTrip = async (req, res, next) => {
    try {
        const data = createTripSchema.parse(req.body);

        const trip = await createTripService(data);

        return res.status(201).json({
            success: true,
            data: {
                ...escapeTripDTO(trip),
                vendors: (trip.vendors || []).map(escapeTripVendorDTO),
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getTripByUuid = async (req, res, next) => {
    try {
        const { uuid } = tripUuidParamSchema.parse(req.params);

        const trip = await getTripByUuidService(uuid);

        const dto = {
            ...escapeTripDTO(trip),
            vendors: (trip.vendors || []).map(escapeTripVendorDTO),
            stocks: trip.stocks || [],
        };

        return res.status(200).json({
            success: true,
            data: dto,
        });
    } catch (error) {
        next(error);
    }
};

export const addTripVendor = async (req, res, next) => {
    try {
        const { uuid } = tripUuidParamSchema.parse(req.params);
        const data = addTripVendorSchema.parse(req.body);

        const tripVendor = await addTripVendorService(uuid, data);

        return res.status(201).json({
            success: true,
            data: escapeTripVendorDTO(tripVendor),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get the most recent stock for a trip to pre-fill clone form
 * Response includes createdAt for reference only (audit trail).
 * Frontend must NOT use historical createdAt as the new stock's timestamp;
 * instead, set purchasedOn to today or user-selected date when creating the new stock.
 */
export const getCloneLastStock = async (req, res, next) => {
    try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.params.tripUuid)) {
            const error = new Error('Invalid UUID format');
            error.statusCode = 400;
            throw error;
        }

        const { tripUuid } = req.params;

        const cloneStockData = await getLastStockForTripService(tripUuid);

        return res.status(200).json({
            success: true,
            data: cloneStockData,
        });
    } catch (error) {
        next(error);
    }
};