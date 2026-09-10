import {
    Sale,
    SaleLine,
    RentalAgreement,
    RentalLine,
    RentalReturn,
    Expense,
    Unit,
    Stock,
    Trip,
    Vendor,
    Sequelize,
    sequelize,
} from '../../../database/models/index.js';

/*
 * R-32 Phase B: dashboard KPIs and the inventory snapshot read from the
 * reporting materialized views (mv_dashboard_sales / _expenses / _rentals and
 * mv_inventory_snapshot, defined in migration 20260910000003) instead of
 * recomputing aggregate scans on every request.
 *
 * Freshness strategy:
 *  - Matviews are REFRESHed from the money ledger at most once per
 *    REFRESH_COOLDOWN_MS (60s), on demand, the first time a report is read.
 *  - REFRESH_CONCURRENTLY is used for the date-grouped matviews (their UNIQUE
 *    index on metric_date keeps the view readable while it refreshes); the
 *    single-row inventory snapshot uses a plain REFRESH.
 *  - REFRESH CONCURRENTLY fails if another refresh is already running (e.g. a
 *    concurrent request hit the cooldown boundary); we swallow that and serve
 *    the existing data rather than failing the report read.
 *  - If any matview is empty (fresh DB, or a force-sync recreated the objects
 *    but not the data) the cooldown is ignored and a refresh is triggered so
 *    report reads always reflect committed rows.
 *  - REFRESH cannot run inside a transaction, so the raw queries here never
 *    use one.
 */
const REFRESH_COOLDOWN_MS = 60_000;
const DASHBOARD_GROUPED_MATVIEWS = ['mv_dashboard_sales', 'mv_dashboard_expenses', 'mv_dashboard_rentals'];
const INVENTORY_MATVIEW = 'mv_inventory_snapshot';
let lastMatviewRefreshAtMs = 0;

async function anyReportingMatviewEmpty() {
    const rows = await sequelize.query(
        `SELECT
           (SELECT COUNT(*) FROM ${DASHBOARD_GROUPED_MATVIEWS[0]}) +
           (SELECT COUNT(*) FROM ${DASHBOARD_GROUPED_MATVIEWS[1]}) +
           (SELECT COUNT(*) FROM ${DASHBOARD_GROUPED_MATVIEWS[2]}) +
           (SELECT COUNT(*) FROM ${INVENTORY_MATVIEW}) AS total`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return Number(rows[0].total) === 0;
}

const refreshReportingMatviewsIfStale = async () => {
    const now = Date.now();
    const insideCooldown = now - lastMatviewRefreshAtMs < REFRESH_COOLDOWN_MS;
    let empty = false;
    try {
        empty = await anyReportingMatviewEmpty();
    } catch (error) {
        // Objects missing (migrations not applied): surface the real error.
        throw error;
    }
    if (insideCooldown && !empty) {
        return;
    }

    lastMatviewRefreshAtMs = now;

    for (const name of DASHBOARD_GROUPED_MATVIEWS) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await sequelize.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${name}`);
        } catch (error) {
            // Concurrent refresh already in progress in another request/process:
            // the matview stays readable, so serve the existing snapshot.
            const detail = (error && (error.parent && error.parent.message)) || (error && error.message) || '';
            if (/already in progress|concurrently/i.test(detail)) {
                continue;
            }
            throw error;
        }
    }

    await sequelize.query(`REFRESH MATERIALIZED VIEW ${INVENTORY_MATVIEW}`);
};

function rowToInventorySnapshot(row) {
    if (!row) {
        return { total: 0, retailInStock: 0, byChannel: {}, byStatus: {} };
    }

    const byChannel = {};
    if (Number(row.channel_retail) > 0) byChannel.RETAIL = Number(row.channel_retail);
    if (Number(row.channel_rental) > 0) byChannel.RENTAL = Number(row.channel_rental);

    const byStatus = {};
    const statuses = ['in_stock', 'sold', 'rented', 'in_maintenance', 'retired', 'lost', 'damaged'];
    for (const status of statuses) {
        const value = Number(row[`status_${status}`]);
        if (value > 0) byStatus[status] = value;
    }

    return {
        total: Number(row.total_units),
        retailInStock: Number(row.retail_in_stock),
        byChannel,
        byStatus,
    };
}

const DAY_MS = 86400000;

function pad(n) {
    return n < 10 ? `0${n}` : String(n);
}

function toUtc(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
}

function daysBetween(fromStr, toStr) {
    return Math.round((toUtc(toStr) - toUtc(fromStr)) / DAY_MS);
}

function defaultRange() {
    const now = new Date();
    const from = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-01`;
    const to = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
    return { from, to };
}

function normalizeRange(from, to) {
    if (from && to) return { from, to };
    if (from) return { from, to: null };
    if (to) return { from: null, to };
    return defaultRange();
}

function dateWhere(column, from, to) {
    const where = {};
    if (from) where[column] = { [Sequelize.Op.gte]: from };
    if (to) where[column] = { ...(where[column] || {}), [Sequelize.Op.lte]: to };
    return where;
}

/* ------------------------------------------------------------------ *
 * Dashboard KPIs for a period (default: this calendar month)
 *
 * Reads the reporting matviews (refreshed on demand, see the header note).
 * Sales total = completed sales; cancellations come from CANCEL reversals;
 * count = every sale in the period (incl. later-cancelled), matching the
 * historical semantics exactly.
 * ------------------------------------------------------------------ */
export const getDashboard = async ({ from, to }) => {
    const { from: f, to: t } = normalizeRange(from, to);

    await refreshReportingMatviewsIfStale();

    const [salesRow, rentalsRow, expensesRow, invRow] = await Promise.all([
        sequelize.query(
            `SELECT
               COALESCE(SUM(sales_total_paise), 0)::bigint AS sales_total_paise,
               COALESCE(SUM(refunded_paise), 0)::bigint AS refunded_paise,
               COALESCE(SUM(cancelled_paise), 0)::bigint AS cancelled_paise,
               COALESCE(SUM(sale_count), 0)::bigint AS sale_count,
               COALESCE(SUM(units_sold), 0)::bigint AS units_sold
             FROM mv_dashboard_sales
             WHERE metric_date BETWEEN :from AND :to`,
            { replacements: { from: f, to: t }, type: sequelize.QueryTypes.SELECT }
        ),
        sequelize.query(
            `SELECT
               COALESCE(SUM(earned_paise), 0)::bigint AS earned_paise,
               COALESCE(SUM(overdue_paise), 0)::bigint AS overdue_paise,
               COALESCE(SUM(damage_paise), 0)::bigint AS damage_paise
             FROM mv_dashboard_rentals
             WHERE metric_date BETWEEN :from AND :to`,
            { replacements: { from: f, to: t }, type: sequelize.QueryTypes.SELECT }
        ),
        sequelize.query(
            `SELECT
               COALESCE(SUM(total_paise), 0)::bigint AS total_paise,
               COALESCE(SUM(cancelled_paise), 0)::bigint AS cancelled_paise
             FROM mv_dashboard_expenses
             WHERE metric_date BETWEEN :from AND :to`,
            { replacements: { from: f, to: t }, type: sequelize.QueryTypes.SELECT }
        ),
        sequelize.query(
            `SELECT *
             FROM mv_inventory_snapshot
             LIMIT 1`,
            { type: sequelize.QueryTypes.SELECT }
        ),
    ]);

    const sales = salesRow[0];
    const salesTotalPaise = BigInt(sales.sales_total_paise);
    const salesRefundsPaise = BigInt(sales.refunded_paise);
    const salesCancellationsPaise = BigInt(sales.cancelled_paise);
    const netSalesPaise = salesTotalPaise - salesRefundsPaise;

    const rentalEarnedPaise =
        BigInt(rentalsRow[0].earned_paise) +
        BigInt(rentalsRow[0].overdue_paise) +
        BigInt(rentalsRow[0].damage_paise);

    const expenses = expensesRow[0];
    const expensesTotalPaise = BigInt(expenses.total_paise);
    const expensesCancelledPaise = BigInt(expenses.cancelled_paise);

    const netPaise = netSalesPaise + rentalEarnedPaise - expensesTotalPaise;

    return {
        period: { from: f, to: t },
        sales: {
            totalPaise: String(salesTotalPaise),
            refundedPaise: String(salesRefundsPaise),
            cancelledPaise: String(salesCancellationsPaise),
            netPaise: String(netSalesPaise),
            count: Number(sales.sale_count),
            unitsSold: Number(sales.units_sold),
        },
        rentals: {
            earnedPaise: String(rentalEarnedPaise),
        },
        expenses: {
            totalPaise: String(expensesTotalPaise),
            cancelledPaise: String(expensesCancelledPaise),
        },
        inventory: rowToInventorySnapshot(invRow[0]),
        netPaise: String(netPaise),
    };
};

/* ------------------------------------------------------------------ *
 * Sales report
 * ------------------------------------------------------------------ */
export const getSalesReport = async ({ from, to }) => {
    const { from: f, to: t } = normalizeRange(from, to);
    const sales = await Sale.findAll({
        where: { deletedAt: null, ...dateWhere('soldAt', f, t) },
        order: [['soldAt', 'DESC']],
        include: [
            { association: 'lines', attributes: ['sellingPricePaise'] },
            { association: 'reversals', attributes: ['reversalType', 'amountPaise'] },
        ],
    });

    const rows = sales.map((sale) => ({
        uuid: sale.uuid,
        saleNumber: sale.saleNumber,
        soldAt: sale.soldAt,
        customerName: sale.customerName,
        status: sale.status,
        totalPaise: String(sale.totalPaise),
        units: (sale.lines || []).length,
        refundedPaise: String(
            (sale.reversals || [])
                .filter((r) => r.reversalType === 'REFUND')
                .reduce((sum, r) => sum + BigInt(r.amountPaise), 0n)
        ),
    }));

    const totals = {
        count: rows.length,
        grossPaise: String(rows.reduce((sum, r) => sum + BigInt(r.totalPaise), 0n)),
        refundedPaise: String(rows.reduce((sum, r) => sum + BigInt(r.refundedPaise), 0n)),
        netPaise: String(
            rows.reduce((sum, r) => sum + BigInt(r.totalPaise) - BigInt(r.refundedPaise), 0n)
        ),
        unitsSold: rows.reduce((sum, r) => sum + r.units, 0),
    };

    return { period: { from: f, to: t }, rows, totals };
};

/* ------------------------------------------------------------------ *
 * Rentals report
 * ------------------------------------------------------------------ */
export const getRentalsReport = async ({ from, to }) => {
    const { from: f, to: t } = normalizeRange(from, to);
    const agreements = await RentalAgreement.findAll({
        where: { deletedAt: null, ...dateWhere('startDate', f, t) },
        order: [['startDate', 'DESC']],
        include: [
            { association: 'lines', include: [{ association: 'returns' }] },
            { association: 'reversals', attributes: ['reversalType', 'amountPaise'] },
        ],
    });

    const statusCounts = { active: 0, completed: 0, cancelled: 0 };
    let earnedPaise = 0n;
    let overdueChargePaise = 0n;
    let damageChargePaise = 0n;

    const rows = agreements.map((agreement) => {
        statusCounts[agreement.status] = (statusCounts[agreement.status] || 0) + 1;

        let agreementEarned = 0n;
        let agreementOverdue = 0n;
        let agreementDamage = 0n;

        for (const line of agreement.lines || []) {
            for (const ret of line.returns || []) {
                const rentedDays = daysBetween(agreement.startDate, ret.actualReturnDate);
                agreementEarned += BigInt(rentedDays) * BigInt(line.rentPerDayPaise);
                agreementOverdue += BigInt(ret.overdueChargePaise);
                agreementDamage += BigInt(ret.damageChargePaise);
            }
        }
        earnedPaise += agreementEarned;
        overdueChargePaise += agreementOverdue;
        damageChargePaise += agreementDamage;

        return {
            uuid: agreement.uuid,
            agreementNumber: agreement.agreementNumber,
            customerName: agreement.customerName,
            startDate: agreement.startDate,
            dueDate: agreement.dueDate,
            status: agreement.status,
            units: (agreement.lines || []).length,
            earnedPaise: String(agreementEarned),
            overdueChargePaise: String(agreementOverdue),
            damageChargePaise: String(agreementDamage),
            cancelledPaise: String(
                (agreement.reversals || [])
                    .filter((r) => r.reversalType === 'CANCEL')
                    .reduce((sum, r) => sum + BigInt(r.amountPaise), 0n)
            ),
        };
    });

    return {
        period: { from: f, to: t },
        rows,
        counts: statusCounts,
        totals: {
            earnedPaise: String(earnedPaise),
            overdueChargePaise: String(overdueChargePaise),
            damageChargePaise: String(damageChargePaise),
        },
    };
};

/* ------------------------------------------------------------------ *
 * Expenses report
 * ------------------------------------------------------------------ */
export const getExpensesReport = async ({ from, to, category }) => {
    const { from: f, to: t } = normalizeRange(from, to);
    const where = { deletedAt: null, ...dateWhere('expenseDate', f, t) };
    if (category) where.category = category;

    const expenses = await Expense.findAll({
        where,
        order: [['expenseDate', 'DESC']],
    });

    const rows = expenses.map((expense) => ({
        uuid: expense.uuid,
        expenseDate: expense.expenseDate,
        category: expense.category,
        purpose: expense.purpose,
        status: expense.status,
        amountPaise: String(expense.amountPaise),
    }));

    const byCategory = {};
    for (const row of rows) {
        if (row.status !== 'completed') continue;
        byCategory[row.category] = (byCategory[row.category] || 0n) + BigInt(row.amountPaise);
    }
    const categoryTotals = Object.entries(byCategory)
        .map(([name, total]) => ({ category: name, totalPaise: String(total) }))
        .sort((a, b) => (BigInt(b.totalPaise) > BigInt(a.totalPaise) ? 1 : BigInt(b.totalPaise) < BigInt(a.totalPaise) ? -1 : 0));

    const totals = {
        count: rows.length,
        grossPaise: String(rows.reduce((sum, r) => sum + BigInt(r.amountPaise), 0n)),
        takenPaise: String(rows.filter((r) => r.status === 'completed').reduce((sum, r) => sum + BigInt(r.amountPaise), 0n)),
        categoryTotals,
    };

    return { period: { from: f, to: t }, rows, totals };
};

/* ------------------------------------------------------------------ *
 * Inventory snapshot (no period - current state)
 * ------------------------------------------------------------------ */
export const getInventoryReport = async () => {
    await refreshReportingMatviewsIfStale();

    const rows = await sequelize.query(
        `SELECT *
         FROM mv_inventory_snapshot
         LIMIT 1`,
        { type: sequelize.QueryTypes.SELECT }
    );

    return rowToInventorySnapshot(rows[0]);
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Analytics: Trip P&L, per-vendor sell-through, stock levels,
 * and margins. These read current data and aggregate in JS (same
 * approach as the rest of this module).
 * ------------------------------------------------------------------ */

/**
 * Trip P&L: cost = buying price * quantity per stock; revenue = completed
 * sale lines on units inside the trip + earned rental charges on returned
 * rental lines inside the trip.
 */
export const getTripPnlReport = async () => {
    const [trips, stocks, saleLines, rentalReturns] = await Promise.all([
        Trip.findAll({
            where: { deletedAt: null },
            attributes: ['id', 'name', 'purchasedOn', 'status'],
        }),
        Stock.findAll({
            where: { deletedAt: null },
            attributes: ['id', 'tripId', 'quantity', 'buyingPricePaise'],
        }),
        SaleLine.findAll({
            attributes: ['sellingPricePaise'],
            include: [
                { association: 'sale', attributes: ['status'] },
                { association: 'unit', attributes: ['stockId'] },
            ],
        }),
        RentalReturn.findAll({
            attributes: ['actualReturnDate', 'overdueChargePaise', 'damageChargePaise'],
            include: [
                {
                    association: 'line',
                    attributes: ['rentPerDayPaise'],
                    include: [
                        { association: 'unit', attributes: ['stockId'] },
                        { association: 'agreement', attributes: ['startDate'] },
                    ],
                },
            ],
        }),
    ]);

    const stockIdsByTrip = {};
    const costByTrip = {};
    for (const stock of stocks) {
        const tripId = stock.tripId;
        (stockIdsByTrip[tripId] = stockIdsByTrip[tripId] || []).push(stock.id);
        costByTrip[tripId] = (costByTrip[tripId] || 0n) + BigInt(stock.quantity) * BigInt(stock.buyingPricePaise);
    }

    const revenueByTrip = {};
    for (const line of saleLines) {
        if (line.sale && line.sale.status !== 'completed') continue;
        const stockId = line.unit ? line.unit.stockId : null;
        const tripId = stockId && Object.keys(stockIdsByTrip).find((t) => stockIdsByTrip[t].includes(stockId));
        if (tripId) {
            revenueByTrip[tripId] = (revenueByTrip[tripId] || 0n) + BigInt(line.sellingPricePaise);
        }
    }

    const rentalEarnedByTrip = {};
    for (const ret of rentalReturns) {
        const stockId = ret.line && ret.line.unit ? ret.line.unit.stockId : null;
        const startDate = ret.line && ret.line.agreement ? ret.line.agreement.startDate : null;
        if (!stockId || !startDate) continue;
        const tripId = Object.keys(stockIdsByTrip).find((t) => stockIdsByTrip[t].includes(stockId));
        if (!tripId) continue;
        const rentedDays = Math.max(1, daysBetween(startDate, ret.actualReturnDate));
        rentalEarnedByTrip[tripId] = (rentalEarnedByTrip[tripId] || 0n)
            + BigInt(rentedDays) * BigInt(ret.line.rentPerDayPaise)
            + BigInt(ret.overdueChargePaise)
            + BigInt(ret.damageChargePaise);
    }

    const rows = trips.map((trip) => {
        const costPaise = costByTrip[trip.id] || 0n;
        const revenuePaise = revenueByTrip[trip.id] || 0n;
        const rentalPaise = rentalEarnedByTrip[trip.id] || 0n;
        return {
            tripUuid: trip.uuid,
            tripName: trip.name,
            purchasedOn: trip.purchasedOn,
            status: trip.status,
            costPaise: String(costPaise),
            salesRevenuePaise: String(revenuePaise),
            rentalEarnedPaise: String(rentalPaise),
            totalRevenuePaise: String(revenuePaise + rentalPaise),
            profitPaise: String(revenuePaise + rentalPaise - costPaise),
        };
    });

    return { rows };
};

/**
 * Per-vendor sell-through: units sold/rented per vendor + revenue.
 */
export const getVendorSellThroughReport = async () => {
    const [vendors, stocks, saleLines, rentalLines] = await Promise.all([
        Vendor.findAll({
            where: { deletedAt: null },
            attributes: ['id', 'uuid', 'name'],
        }),
        Stock.findAll({
            where: { deletedAt: null },
            attributes: ['id', 'vendorId'],
        }),
        SaleLine.findAll({
            attributes: ['sellingPricePaise'],
            include: [
                { association: 'sale', attributes: ['status'] },
                { association: 'unit', attributes: ['stockId'] },
            ],
        }),
        RentalLine.findAll({
            attributes: ['rentPerDayPaise'],
            include: [
                { association: 'unit', attributes: ['stockId'] },
                { association: 'agreement', attributes: ['status', 'startDate'] },
                { association: 'returns' },
            ],
        }),
    ]);

    const stockVendor = Object.fromEntries(stocks.map((s) => [s.id, s.vendorId]));

    const soldByVendor = {};
    const salesRevenueByVendor = {};
    for (const line of saleLines) {
        if (line.sale && line.sale.status !== 'completed') continue;
        const vendorId = line.unit ? stockVendor[line.unit.stockId] : null;
        if (!vendorId) continue;
        soldByVendor[vendorId] = (soldByVendor[vendorId] || 0) + 1;
        salesRevenueByVendor[vendorId] = (salesRevenueByVendor[vendorId] || 0n) + BigInt(line.sellingPricePaise);
    }

    const rentedByVendor = {};
    const rentalDaysByVendor = {};
    for (const rline of rentalLines) {
        const vendorId = rline.unit ? stockVendor[rline.unit.stockId] : null;
        if (!vendorId) continue;
        rentedByVendor[vendorId] = (rentedByVendor[vendorId] || 0) + 1;
        const returns = rline.returns || [];
        for (const ret of returns) {
            const startDate = rline.agreement ? rline.agreement.startDate : null;
            if (!startDate) continue;
            const rentedDays = Math.max(1, daysBetween(startDate, ret.actualReturnDate));
            rentalDaysByVendor[vendorId] = (rentalDaysByVendor[vendorId] || 0n)
                + BigInt(rentedDays) * BigInt(rline.rentPerDayPaise)
                + BigInt(ret.overdueChargePaise)
                + BigInt(ret.damageChargePaise);
        }
    }

    const rows = vendors.map((vendor) => ({
        vendorUuid: vendor.uuid,
        vendorName: vendor.name,
        unitsSold: soldByVendor[vendor.id] || 0,
        unitsRented: rentedByVendor[vendor.id] || 0,
        salesRevenuePaise: String(salesRevenueByVendor[vendor.id] || 0n),
        rentalEarnedPaise: String(rentalDaysByVendor[vendor.id] || 0n),
    }));

    return { rows };
};

/**
 * Stock-level counts + low-stock alert.
 * remaining = number of units still in_stock for that stock.
 */
export const getStockLevelsReport = async ({ lowStockThreshold = 5 } = {}) => {
    const threshold = Number(lowStockThreshold) >= 0 ? Number(lowStockThreshold) : 5;

    const stocks = await Stock.findAll({
        where: { deletedAt: null },
        attributes: ['id', 'uuid', 'channel', 'quantity'],
        include: [{ association: 'productType', attributes: ['name'] }],
    });

    const units = await Unit.findAll({
        where: { deletedAt: null },
        attributes: ['stockId', 'status'],
    });

    const counts = {};
    for (const unit of units) {
        const c = (counts[unit.stockId] = counts[unit.stockId] || {
            total: 0,
            inStock: 0,
            sold: 0,
            rented: 0,
            inMaintenance: 0,
            retired: 0,
        });
        c.total += 1;
        if (unit.status === 'in_stock') c.inStock += 1;
        else if (unit.status === 'sold') c.sold += 1;
        else if (unit.status === 'rented') c.rented += 1;
        else if (unit.status === 'in_maintenance') c.inMaintenance += 1;
        else if (unit.status === 'retired') c.retired += 1;
    }

    const rows = stocks.map((stock) => {
        const c = counts[stock.id] || { total: 0, inStock: 0, sold: 0, rented: 0, inMaintenance: 0, retired: 0 };
        return {
            stockUuid: stock.uuid,
            productTypeName: stock.productType ? stock.productType.name : null,
            channel: stock.channel,
            purchasedQuantity: stock.quantity,
            totalUnits: c.total,
            inStock: c.inStock,
            sold: c.sold,
            rented: c.rented,
            inMaintenance: c.inMaintenance,
            retired: c.retired,
            remaining: c.inStock,
            lowStock: c.inStock <= threshold,
        };
    });

    return { lowStockThreshold: threshold, rows };
};

/**
 * Margins (avg margin per trip / vendor / product type).
 * Margin per unit = sellingPaise - buyingPaise. Percentage = margin / selling.
 */
export const getMarginsReport = async () => {
    const units = await Unit.findAll({
        where: { deletedAt: null },
        attributes: ['id', 'buyingPricePaise', 'sellingPricePaise'],
        include: [
            {
                association: 'stock',
                attributes: ['tripId', 'vendorId', 'productTypeId'],
                include: [{ association: 'productType', attributes: ['id', 'name'] }],
            },
        ],
    });

    const buckets = { trip: {}, vendor: {}, productType: {} };

    for (const unit of units) {
        const buying = BigInt(unit.buyingPricePaise);
        const selling = BigInt(unit.sellingPricePaise);
        if (selling <= 0n) continue;
        const margin = selling - buying;

        if (unit.stock) {
            pushMargin(buckets.trip, unit.stock.tripId, { label: `Trip ${unit.stock.tripId}`, margin, selling });
            pushMargin(buckets.vendor, unit.stock.vendorId, { label: `Vendor ${unit.stock.vendorId}`, margin, selling });
            const ptName = unit.stock.productType ? unit.stock.productType.name : 'Unknown';
            pushMargin(buckets.productType, unit.stock.productTypeId, { label: ptName, margin, selling });
        }
    }

    const finalize = (bucket) =>
        Object.entries(bucket)
            .map(([key, agg]) => {
                const avgMarginPaise = agg.count > 0
                    ? String(agg.marginSum / BigInt(agg.count) + ((agg.marginSum % BigInt(agg.count)) * 2n >= BigInt(agg.count) ? 1n : 0n))
                    : '0';
                const avgMarginPct = agg.sellingSum > 0n
                    ? Number((agg.marginSum * 10000n / agg.sellingSum + 5n) / 10n) / 10
                    : 0;
                return {
                    key,
                    label: agg.label,
                    avgMarginPaise,
                    avgMarginPct,
                    units: agg.count,
                };
            })
            .sort((a, b) => b.avgMarginPct - a.avgMarginPct);

    return {
        trips: finalize(buckets.trip),
        vendors: finalize(buckets.vendor),
        productTypes: finalize(buckets.productType),
    };
};

function pushMargin(bucket, key, { label, margin, selling }) {
    if (key === null || key === undefined) return;
    const agg = (bucket[key] = bucket[key] || { label, marginSum: 0n, sellingSum: 0n, count: 0 });
    agg.marginSum += margin;
    agg.sellingSum += selling;
    agg.count += 1;
}
