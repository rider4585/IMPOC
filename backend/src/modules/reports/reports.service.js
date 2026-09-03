import {
    Sale,
    SaleLine,
    SaleReversal,
    RentalAgreement,
    RentalReturn,
    RentalReversal,
    Expense,
    Unit,
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
