import { periodQuerySchema, expensesQuerySchema } from './reports.validation.js';
import {
    getDashboard as getDashboardService,
    getSalesReport as getSalesReportService,
    getRentalsReport as getRentalsReportService,
    getExpensesReport as getExpensesReportService,
    getInventoryReport as getInventoryReportService,
} from './reports.service.js';

/**
 * GET /api/reports/dashboard - KPIs for a period.
 */
export const getDashboard = async (req, res, next) => {
    try {
        const query = periodQuerySchema.parse(req.query);
        const data = await getDashboardService({ from: query.from, to: query.to });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/reports/sales - Sales report for a period.
 */
export const getSalesReport = async (req, res, next) => {
    try {
        const query = periodQuerySchema.parse(req.query);
        const data = await getSalesReportService({ from: query.from, to: query.to });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/reports/rentals - Rentals report for a period.
 */
export const getRentalsReport = async (req, res, next) => {
    try {
        const query = periodQuerySchema.parse(req.query);
        const data = await getRentalsReportService({ from: query.from, to: query.to });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/reports/expenses - Expenses report for a period (optional category).
 */
export const getExpensesReport = async (req, res, next) => {
    try {
        const query = expensesQuerySchema.parse(req.query);
        const data = await getExpensesReportService({
            from: query.from,
            to: query.to,
            category: query.category,
        });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/reports/inventory - Current inventory snapshot.
 */
export const getInventoryReport = async (req, res, next) => {
    try {
        const data = await getInventoryReportService();
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
