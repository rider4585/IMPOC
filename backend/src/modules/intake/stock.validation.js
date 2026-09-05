import { z } from 'zod';
import { CHANNEL } from '../../constants/channel.js';

export const createStockSchema = z
    .object({
        tripUuid: z
            .string()
            .uuid('Invalid trip UUID format'),

        vendorUuid: z
            .string()
            .uuid('Invalid vendor UUID format'),

        productTypeUuid: z
            .string()
            .uuid('Invalid product type UUID format'),

        subTypeUuid: z
            .string()
            .uuid('Invalid sub type UUID format')
            .nullable()
            .optional(),

        quantity: z
            .number()
            .int('Quantity must be an integer')
            .min(1, 'Quantity must be at least 1')
            .max(2147483647, 'Quantity exceeds maximum INTEGER value'),

        buyingPricePaise: z
            .number()
            .int('Buying price must be an integer')
            .min(0, 'Buying price cannot be negative')
            .max(9223372036854775807, 'Buying price exceeds maximum BIGINT value'),

        wholeBuyingPricePaise: z
            .number()
            .int('Whole buying price must be an integer')
            .min(0, 'Whole buying price cannot be negative')
            .max(9223372036854775807, 'Whole buying price exceeds maximum BIGINT value')
            .nullable()
            .optional(),

        sellingPricePaise: z
            .number()
            .int('Selling price must be an integer')
            .min(0, 'Selling price cannot be negative')
            .max(9223372036854775807, 'Selling price exceeds maximum BIGINT value'),

        floorPricePaise: z
            .number()
            .int('Floor price must be an integer')
            .min(0, 'Floor price cannot be negative')
            .max(9223372036854775807, 'Floor price exceeds maximum BIGINT value'),

        channel: z
            .enum([CHANNEL.RETAIL, CHANNEL.RENTAL])
            .default(CHANNEL.RETAIL),

        rentPerDayPaise: z
            .number()
            .int('Rent per day must be an integer')
            .min(0, 'Rent per day cannot be negative')
            .max(9223372036854775807, 'Rent per day exceeds maximum BIGINT value')
            .nullable()
            .optional(),

        depositPaise: z
            .number()
            .int('Deposit must be an integer')
            .min(0, 'Deposit cannot be negative')
            .max(9223372036854775807, 'Deposit exceeds maximum BIGINT value')
            .nullable()
            .optional(),

        overduePerDayPaise: z
            .number()
            .int('Overdue per day must be an integer')
            .min(1, 'Overdue per day must be greater than 0')
            .max(9223372036854775807, 'Overdue per day exceeds maximum BIGINT value')
            .nullable()
            .optional(),
    })
    .refine(
        (data) => {
            // If RENTAL, all rental fields must be provided
            if (data.channel === CHANNEL.RENTAL) {
                return (
                    data.rentPerDayPaise !== null &&
                    data.rentPerDayPaise !== undefined &&
                    data.depositPaise !== null &&
                    data.depositPaise !== undefined &&
                    data.overduePerDayPaise !== null &&
                    data.overduePerDayPaise !== undefined
                );
            }
            // If RETAIL, rental fields must not be provided
            if (data.channel === CHANNEL.RETAIL) {
                return (
                    data.rentPerDayPaise === null ||
                    data.rentPerDayPaise === undefined
                ) &&
                    (data.depositPaise === null || data.depositPaise === undefined) &&
                    (data.overduePerDayPaise === null || data.overduePerDayPaise === undefined);
            }
            return true;
        },
        {
            message: 'Rental fields are required for RENTAL channel and must not be provided for RETAIL channel',
            path: ['channel'],
        }
    )
    .refine(
        (data) => {
            // Floor price cannot exceed selling price
            return data.floorPricePaise <= data.sellingPricePaise;
        },
        {
            message: 'Floor price cannot exceed selling price',
            path: ['floorPricePaise'],
        }
    )
    .refine(
        (data) => {
            // For RENTAL, overdue per day must be greater than rent per day
            if (data.channel === CHANNEL.RENTAL) {
                return (
                    data.overduePerDayPaise !== null &&
                    data.overduePerDayPaise !== undefined &&
                    data.rentPerDayPaise !== null &&
                    data.rentPerDayPaise !== undefined &&
                    data.overduePerDayPaise > data.rentPerDayPaise
                );
            }
            return true;
        },
        {
            message: 'Overdue per day must be greater than rent per day',
            path: ['overduePerDayPaise'],
        }
    );

export const updateStockSchema = z
    .object({
        subTypeUuid: z
            .string()
            .uuid('Invalid sub type UUID format')
            .nullable()
            .optional(),

        wholeBuyingPricePaise: z
            .number()
            .int('Whole buying price must be an integer')
            .min(0, 'Whole buying price cannot be negative')
            .max(9223372036854775807, 'Whole buying price exceeds maximum BIGINT value')
            .nullable()
            .optional(),

        quantity: z
            .number()
            .int('Quantity must be an integer')
            .min(1, 'Quantity must be at least 1')
            .max(2147483647, 'Quantity exceeds maximum INTEGER value')
            .optional(),

        buyingPricePaise: z
            .number()
            .int('Buying price must be an integer')
            .min(0, 'Buying price cannot be negative')
            .max(9223372036854775807, 'Buying price exceeds maximum BIGINT value')
            .optional(),

        sellingPricePaise: z
            .number()
            .int('Selling price must be an integer')
            .min(0, 'Selling price cannot be negative')
            .max(9223372036854775807, 'Selling price exceeds maximum BIGINT value')
            .optional(),

        floorPricePaise: z
            .number()
            .int('Floor price must be an integer')
            .min(0, 'Floor price cannot be negative')
            .max(9223372036854775807, 'Floor price exceeds maximum BIGINT value')
            .optional(),

        rentPerDayPaise: z
            .number()
            .int('Rent per day must be an integer')
            .min(0, 'Rent per day cannot be negative')
            .max(9223372036854775807, 'Rent per day exceeds maximum BIGINT value')
            .nullable()
            .optional(),

        depositPaise: z
            .number()
            .int('Deposit must be an integer')
            .min(0, 'Deposit cannot be negative')
            .max(9223372036854775807, 'Deposit exceeds maximum BIGINT value')
            .nullable()
            .optional(),

        overduePerDayPaise: z
            .number()
            .int('Overdue per day must be an integer')
            .min(1, 'Overdue per day must be greater than 0')
            .max(9223372036854775807, 'Overdue per day exceeds maximum BIGINT value')
            .nullable()
            .optional(),
    })
    .refine(
        (data) => {
            // When both defined, floor price cannot exceed selling price
            if (data.floorPricePaise !== undefined && data.sellingPricePaise !== undefined) {
                return data.floorPricePaise <= data.sellingPricePaise;
            }
            return true;
        },
        {
            message: 'Floor price cannot exceed selling price',
            path: ['floorPricePaise'],
        }
    );

export const stockUuidParamSchema = z.object({
    uuid: z.string().uuid('Invalid UUID format'),
});

/**
 * Schema for POST /api/trips/:tripUuid/stocks/:uuid/scan
 */
export const scanIntoStockSchema = z.object({
    barcode: z
        .string()
        .min(1, 'Barcode must be at least 1 character')
        .max(12, 'Barcode must be at most 12 characters'),

    colourUuid: z
        .string()
        .uuid('Invalid colour UUID format'),

    sizeUuid: z
        .string()
        .uuid('Invalid size UUID format'),
});

/**
 * Query schema for GET /api/stocks (bare list-all endpoint)
 */
export const listAllStocksQuerySchema = z.object({
    tripUuid: z.string().uuid('Invalid trip UUID format').optional(),
    vendorUuid: z.string().uuid('Invalid vendor UUID format').optional(),
    search: z.string().trim().max(200).optional(),
});