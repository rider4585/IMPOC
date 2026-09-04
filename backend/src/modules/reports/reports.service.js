import {
    Sale,
    SaleLine,
    SaleReversal,
    RentalAgreement,
    RentalLine,
    RentalReturn,
    RentalReversal,
    Expense,
    Unit,
    Stock,
    Trip,
    Vendor,
    Sequelize,
} from '../../../database/models/index.js';

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
 * ------------------------------------------------------------------ */
export const getDashboard = async ({ from, to }) => {
    const { from: f, to: t } = normalizeRange(from, to);

    const salesWhere = { deletedAt: null, ...dateWhere('soldAt', f, t) };

    const [sales, saleReversals, saleLineCount, expenses, rentals, units] = await Promise.all([
        Sale.findAll({ where: salesWhere, attributes: ['totalPaise', 'status'] }),
        SaleReversal.findAll({
            include: [{ association: 'sale', attributes: ['id', 'soldAt'] }],
            attributes: ['reversalType', 'amountPaise'],
        }).then((rows) =>
            rows.filter((r) => r.sale && dateInRange(r.sale.soldAt, f, t))
        ),
        SaleLine.count({
            include: [{ association: 'sale', where: salesWhere, attributes: [] }],
        }),
        Expense.findAll({
            where: { deletedAt: null, ...dateWhere('expenseDate', f, t) },
            attributes: ['amountPaise', 'status'],
        }),
        RentalReversal.findAll({
            include: [{ association: 'agreement', attributes: ['id', 'startDate'] }],
            attributes: ['reversalType', 'amountPaise'],
        }).then((rows) =>
            rows.filter((r) => r.agreement && dateInRange(r.agreement.startDate, f, t))
        ),
        inventorySnapshot(),
    ]);

    // Sales
    const completedSales = sales.filter((s) => s.status === 'completed');
    const salesTotalPaise = completedSales.reduce((sum, s) => sum + Number(s.totalPaise), 0);
    const salesRefundsPaise = saleReversals
        .filter((r) => r.reversalType === 'REFUND')
        .reduce((sum, r) => sum + Number(r.amountPaise), 0);
    const salesCancellationsPaise = saleReversals
        .filter((r) => r.reversalType === 'CANCEL')
        .reduce((sum, r) => sum + Number(r.amountPaise), 0);
    const netSalesPaise = salesTotalPaise - salesRefundsPaise;

    // Expenses (completed only for P&L; report cancellations separately)
    const completedExpenses = expenses.filter((e) => e.status === 'completed');
    const expensesTotalPaise = completedExpenses.reduce((sum, e) => sum + Number(e.amountPaise), 0);
    const expensesCancelledPaise = expenses
        .filter((e) => e.status === 'cancelled')
        .reduce((sum, e) => sum + Number(e.amountPaise), 0);

    // Rental revenue: earned rent for returned lines + overdue + damage, in period
    const rentalEarnedPaise = await rentalRevenueInPeriod(f, t);

    const netPaise = netSalesPaise + rentalEarnedPaise - expensesTotalPaise;

    return {
        period: { from: f, to: t },
        sales: {
            totalPaise: String(salesTotalPaise),
            refundedPaise: String(salesRefundsPaise),
            cancelledPaise: String(salesCancellationsPaise),
            netPaise: String(netSalesPaise),
            count: sales.length,
            unitsSold: saleLineCount,
        },
        rentals: {
            earnedPaise: String(rentalEarnedPaise),
        },
        expenses: {
            totalPaise: String(expensesTotalPaise),
            cancelledPaise: String(expensesCancelledPaise),
        },
        inventory: units,
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
                .reduce((sum, r) => sum + Number(r.amountPaise), 0)
        ),
    }));

    const totals = {
        count: rows.length,
        grossPaise: String(rows.reduce((sum, r) => sum + Number(r.totalPaise), 0)),
        refundedPaise: String(rows.reduce((sum, r) => sum + Number(r.refundedPaise), 0)),
        netPaise: String(
            rows.reduce((sum, r) => sum + Number(r.totalPaise) - Number(r.refundedPaise), 0)
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
    let earnedPaise = 0;
    let overdueChargePaise = 0;
    let damageChargePaise = 0;

    const rows = agreements.map((agreement) => {
        statusCounts[agreement.status] = (statusCounts[agreement.status] || 0) + 1;

        let agreementEarned = 0;
        let agreementOverdue = 0;
        let agreementDamage = 0;

        for (const line of agreement.lines || []) {
            for (const ret of line.returns || []) {
                const rentedDays = daysBetween(agreement.startDate, ret.actualReturnDate);
                agreementEarned += rentedDays * Number(line.rentPerDayPaise);
                agreementOverdue += Number(ret.overdueChargePaise);
                agreementDamage += Number(ret.damageChargePaise);
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
                    .reduce((sum, r) => sum + Number(r.amountPaise), 0)
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
        byCategory[row.category] = (byCategory[row.category] || 0) + Number(row.amountPaise);
    }
    const categoryTotals = Object.entries(byCategory)
        .map(([name, total]) => ({ category: name, totalPaise: String(total) }))
        .sort((a, b) => Number(b.totalPaise) - Number(a.totalPaise));

    const totals = {
        count: rows.length,
        grossPaise: String(rows.reduce((sum, r) => sum + Number(r.amountPaise), 0)),
        takenPaise: String(rows.filter((r) => r.status === 'completed').reduce((sum, r) => sum + Number(r.amountPaise), 0)),
        categoryTotals,
    };

    return { period: { from: f, to: t }, rows, totals };
};

/* ------------------------------------------------------------------ *
 * Inventory snapshot (no period - current state)
 * ------------------------------------------------------------------ */
export const getInventoryReport = async () => {
    return inventorySnapshot();
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
async function inventorySnapshot() {
    const [total, byChannel, byStatus, retailInStock] = await Promise.all([
        Unit.count({ where: { deletedAt: null } }),
        Unit.findAll({
            where: { deletedAt: null },
            attributes: ['channel', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
            group: ['channel'],
            raw: true,
        }),
        Unit.findAll({
            where: { deletedAt: null },
            attributes: ['status', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
            group: ['status'],
            raw: true,
        }),
        Unit.count({ where: { deletedAt: null, channel: 'RETAIL', status: 'in_stock' } }),
    ]);

    return {
        total,
        retailInStock,
        byChannel: Object.fromEntries(byChannel.map((r) => [r.channel, Number(r.count)])),
        byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)])),
    };
}

function dateInRange(dateStr, from, to) {
    if (!from && !to) return true;
    const ts = toUtc(dateStr);
    if (from && ts < toUtc(from)) return false;
    if (to && ts > toUtc(to)) return false;
    return true;
}

async function rentalRevenueInPeriod(from, to) {
    const returns = await RentalReturn.findAll({
        include: [
            {
                association: 'line',
                attributes: ['rentPerDayPaise'],
                include: [{ association: 'agreement', attributes: ['startDate'] }],
            },
        ],
        attributes: ['actualReturnDate', 'overdueChargePaise', 'damageChargePaise'],
    });

    let earned = 0;
    for (const ret of returns) {
        const startDate = ret.line && ret.line.agreement ? ret.line.agreement.startDate : null;
        if (!startDate || !dateInRange(startDate, from, to)) continue;
        const rentedDays = Math.max(1, daysBetween(startDate, ret.actualReturnDate));
        earned += rentedDays * Number(ret.line.rentPerDayPaise);
        earned += Number(ret.overdueChargePaise);
        earned += Number(ret.damageChargePaise);
    }
    return earned;
}

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
        costByTrip[tripId] = (costByTrip[tripId] || 0) + Number(stock.quantity) * Number(stock.buyingPricePaise);
    }

    const revenueByTrip = {};
    for (const line of saleLines) {
        if (line.sale && line.sale.status !== 'completed') continue;
        const stockId = line.unit ? line.unit.stockId : null;
        const tripId = stockId && Object.keys(stockIdsByTrip).find((t) => stockIdsByTrip[t].includes(stockId));
        if (tripId) {
            revenueByTrip[tripId] = (revenueByTrip[tripId] || 0) + Number(line.sellingPricePaise);
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
        rentalEarnedByTrip[tripId] = (rentalEarnedByTrip[tripId] || 0)
            + rentedDays * Number(ret.line.rentPerDayPaise)
            + Number(ret.overdueChargePaise)
            + Number(ret.damageChargePaise);
    }

    const rows = trips.map((trip) => {
        const costPaise = costByTrip[trip.id] || 0;
        const revenuePaise = revenueByTrip[trip.id] || 0;
        const rentalPaise = rentalEarnedByTrip[trip.id] || 0;
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
            attributes: ['id', 'name'],
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
                { association: 'agreement', attributes: ['status'] },
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
        salesRevenueByVendor[vendorId] = (salesRevenueByVendor[vendorId] || 0) + Number(line.sellingPricePaise);
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
            rentalDaysByVendor[vendorId] = (rentalDaysByVendor[vendorId] || 0)
                + rentedDays * Number(rline.rentPerDayPaise)
                + Number(ret.overdueChargePaise)
                + Number(ret.damageChargePaise);
        }
    }

    const rows = vendors.map((vendor) => ({
        vendorUuid: vendor.uuid,
        vendorName: vendor.name,
        unitsSold: soldByVendor[vendor.id] || 0,
        unitsRented: rentedByVendor[vendor.id] || 0,
        salesRevenuePaise: String(salesRevenueByVendor[vendor.id] || 0),
        rentalEarnedPaise: String(rentalDaysByVendor[vendor.id] || 0),
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
        const buying = Number(unit.buyingPricePaise);
        const selling = Number(unit.sellingPricePaise);
        if (selling <= 0) continue;
        const margin = selling - buying;
        const pct = (margin / selling) * 100;

        if (unit.stock) {
            pushMargin(buckets.trip, unit.stock.tripId, { label: `Trip ${unit.stock.tripId}`, margin, selling });
            pushMargin(buckets.vendor, unit.stock.vendorId, { label: `Vendor ${unit.stock.vendorId}`, margin, selling });
            const ptName = unit.stock.productType ? unit.stock.productType.name : 'Unknown';
            pushMargin(buckets.productType, unit.stock.productTypeId, { label: ptName, margin, selling });
        }
    }

    const finalize = (bucket) =>
        Object.entries(bucket)
            .map(([key, agg]) => ({
                key,
                label: agg.label,
                avgMarginPaise: String(Math.round(agg.marginSum / agg.count)),
                avgMarginPct: Number((agg.marginSum / agg.sellingSum * 100).toFixed(1)),
                units: agg.count,
            }))
            .sort((a, b) => b.avgMarginPct - a.avgMarginPct);

    return {
        trips: finalize(buckets.trip),
        vendors: finalize(buckets.vendor),
        productTypes: finalize(buckets.productType),
    };
};

function pushMargin(bucket, key, { label, margin, selling }) {
    if (key === null || key === undefined) return;
    const agg = (bucket[key] = bucket[key] || { label, marginSum: 0, sellingSum: 0, count: 0 });
    agg.marginSum += margin;
    agg.sellingSum += selling;
    agg.count += 1;
}
