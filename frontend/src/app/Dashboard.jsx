import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../components/ui';
import { useAuth } from '../auth/useAuth.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { formatPaise } from '../platform/money.js';
import { ShopLogo } from '../components/ShopLogo';
import { TagFilterChips } from '../components/TagFilterChips.jsx';
import {
  getDashboard,
  getSalesReport,
  getRentalsReport,
  getExpensesReport,
  getInventoryReport,
  getSalesByTag,
} from '../services/reportsApi.js';

/**
 * Paise arrive from the API as strings (BIGINT). formatPaise needs a finite
 * integer, so normalise once here instead of trusting every report shape.
 */
function paiseOf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function firstOfThisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function firstOfThisYear() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

const PRESETS = [
  { label: 'This Month', from: firstOfThisMonth, to: todayISO },
  { label: 'Last 30 Days', from: thirtyDaysAgo, to: todayISO },
  { label: 'This Year', from: firstOfThisYear, to: todayISO },
];

const TABS = [
  { key: 'sales', label: 'Sales' },
  { key: 'rentals', label: 'Rentals' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'by-tag', label: 'By tag' },
];

function KpiCard({ label, value, color, testid }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <p className="typography-body-sm text-[var(--ink-muted)]">{label}</p>
        <p className={`typography-money-lg mt-1.5 ${color || ''}`} data-testid={testid}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function SalesTable({ data }) {
  if (!data?.rows?.length) {
    return <p className="text-sm text-[var(--ink-muted)]">No sales in this period.</p>;
  }
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Sale #</TableHeaderCell>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Customer</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell className="text-right">Total</TableHeaderCell>
          <TableHeaderCell className="text-right">Units</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.rows.map((r) => (
          <TableRow key={r.uuid}>
            <TableCell className="font-semibold">{r.saleNumber}</TableCell>
            <TableCell>{r.soldAt}</TableCell>
            <TableCell>{r.customerName || '—'}</TableCell>
            <TableCell>
              <Badge variant={r.status === 'completed' ? 'success' : 'neutral'}>{r.status}</Badge>
            </TableCell>
            <TableCell className="text-right">{formatPaise(Number(r.totalPaise))}</TableCell>
            <TableCell className="text-right">{r.units}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RentalsTable({ data }) {
  if (!data?.rows?.length) {
    return <p className="text-sm text-[var(--ink-muted)]">No rentals in this period.</p>;
  }
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Agreement #</TableHeaderCell>
          <TableHeaderCell>Customer</TableHeaderCell>
          <TableHeaderCell>Start</TableHeaderCell>
          <TableHeaderCell>Due</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell className="text-right">Earned</TableHeaderCell>
          <TableHeaderCell className="text-right">Overdue</TableHeaderCell>
          <TableHeaderCell className="text-right">Damage</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.rows.map((r) => (
          <TableRow key={r.uuid}>
            <TableCell className="font-semibold">{r.agreementNumber}</TableCell>
            <TableCell>{r.customerName || '—'}</TableCell>
            <TableCell>{r.startDate}</TableCell>
            <TableCell>{r.dueDate}</TableCell>
            <TableCell>
              <Badge
                variant={
                  r.status === 'completed' ? 'success' : r.status === 'active' ? 'info' : 'neutral'
                }
              >
                {r.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{formatPaise(Number(r.earnedPaise))}</TableCell>
            <TableCell className="text-right">{formatPaise(Number(r.overdueChargePaise))}</TableCell>
            <TableCell className="text-right">{formatPaise(Number(r.damageChargePaise))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ExpensesTable({ data }) {
  if (!data?.rows?.length) {
    return <p className="text-sm text-[var(--ink-muted)]">No expenses in this period.</p>;
  }
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Category</TableHeaderCell>
          <TableHeaderCell>Purpose</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell className="text-right">Amount</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.rows.map((r) => (
          <TableRow key={r.uuid}>
            <TableCell>{r.expenseDate}</TableCell>
            <TableCell className="font-semibold">{r.category}</TableCell>
            <TableCell>{r.purpose || '—'}</TableCell>
            <TableCell>
              <Badge variant={r.status === 'completed' ? 'success' : 'neutral'}>{r.status}</Badge>
            </TableCell>
            <TableCell className="text-right">{formatPaise(Number(r.amountPaise))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function InventoryTable({ data }) {
  if (!data) {
    return <p className="text-sm text-[var(--ink-muted)]">No inventory data.</p>;
  }
  const channels = data.byChannel || {};
  const statuses = data.byStatus || {};
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
          <p className="text-xs text-[var(--ink-muted)]">Total units</p>
          <p className="typography-money-lg mt-1">{data.total}</p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
          <p className="text-xs text-[var(--ink-muted)]">Retail in stock</p>
          <p className="typography-money-lg mt-1">{data.retailInStock}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By channel</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ul className="flex flex-col gap-1">
              {Object.entries(channels).map(([ch, count]) => (
                <li key={ch} className="flex items-center justify-between text-sm">
                  <span>{ch}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
              {Object.keys(channels).length === 0 && (
                <li className="text-sm text-[var(--ink-muted)]">None</li>
              )}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By status</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ul className="flex flex-col gap-1">
              {Object.entries(statuses).map(([st, count]) => (
                <li key={st} className="flex items-center justify-between text-sm">
                  <span>{st}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
              {Object.keys(statuses).length === 0 && (
                <li className="text-sm text-[var(--ink-muted)]">None</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Stable identity so the useMemo deps below do not churn every render. */
const EMPTY_ROWS = [];

/**
 * "By tag" — takings grouped by transaction tag (R-73). The shop runs
 * exhibitions/expos and compares what each event brought in, so the rows have to
 * be honest about what they are.
 *
 * The double-count caveat is the important part: a sale carrying N tags is
 * counted in FULL under each of its N rows, so rows[] deliberately sums to more
 * than totals. We say so out loud rather than quietly showing a bigger number.
 * `totals.salesWithMultipleTags` is how many sales are involved right now.
 *
 * The tag filter narrows the rows in place (the API's own `tagUuids` support is
 * not part of the frozen R-73a contract, which declares only from/to — filtering
 * the returned rows on their tagUuid gives the same answer the moment the server
 * does start honouring the param).
 */
function SalesByTagTable({ data, selectedTags = [], onSelectTags }) {
  const rows = Array.isArray(data?.rows) ? data.rows : EMPTY_ROWS;
  const totals = data?.totals || null;
  const multiTagged = Math.max(0, Number(totals?.salesWithMultipleTags || 0) || 0);

  // Options come from the rows, never from the current selection, so the chips
  // stay put while the table narrows.
  const tagOptions = useMemo(
    () =>
      rows
        .filter((r) => r?.tagUuid)
        .map((r) => ({ uuid: r.tagUuid, name: r.tagName })),
    [rows]
  );
  const available = useMemo(() => new Set(tagOptions.map((t) => t.uuid)), [tagOptions]);
  // A tag can leave the period (date change), so intersect instead of trusting
  // the stored selection blindly.
  const activeTags = selectedTags.filter((uuid) => available.has(uuid));

  const visible = activeTags.length > 0 ? rows.filter((r) => r?.tagUuid && activeTags.includes(r.tagUuid)) : rows;

  return (
    <div className="flex flex-col gap-4" data-testid="dashboard-by-tag">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Gross (all tags, period)"
          value={formatPaise(paiseOf(totals?.grossPaise))}
          testid="by-tag-gross"
        />
        <KpiCard
          label="Refunded (period)"
          value={formatPaise(paiseOf(totals?.refundedPaise))}
          color="text-[var(--money-out)]"
          testid="by-tag-refunded"
        />
        <KpiCard
          label="Net (period)"
          value={formatPaise(paiseOf(totals?.netPaise))}
          color="text-[var(--money-in)]"
          testid="by-tag-net"
        />
      </div>

      <TagFilterChips
        tags={tagOptions}
        selected={activeTags}
        onChange={onSelectTags}
        label="Compare tags"
        testId="by-tag-filter"
      />

      {/* The caveat — a sale with several tags is counted under each of them. */}
      <p
        data-testid="by-tag-caveat"
        className={
          'rounded-md border px-3 py-2 text-xs ' +
          (multiTagged > 0
            ? 'border-[var(--waking)]/40 bg-[var(--waking)]/10 text-[var(--ink)]'
            : 'border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--ink-muted)]')
        }
      >
        {multiTagged > 0
          ? `${multiTagged} sale${multiTagged === 1 ? ' carries' : 's carry'} more than one tag in this period, so each of those sales is counted in full under every tag it carries. The rows below therefore add up to MORE than the period totals above.`
          : 'A sale carrying more than one tag is counted in full under each of its tags, so the rows below can add up to more than the period totals above.'}
      </p>

      {visible.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">
          {rows.length === 0
            ? 'No sales in this period.'
            : 'No tags match the filter.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Tag</TableHeaderCell>
                <TableHeaderCell className="text-right">Sales</TableHeaderCell>
                <TableHeaderCell className="text-right">Units sold</TableHeaderCell>
                <TableHeaderCell className="text-right">Gross</TableHeaderCell>
                <TableHeaderCell className="text-right">Refunded</TableHeaderCell>
                <TableHeaderCell className="text-right">Net</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.tagUuid || 'untagged'} data-testid="by-tag-row">
                  <TableCell className="font-semibold">{r.tagName || 'Untagged'}</TableCell>
                  <TableCell className="text-right">{r.count ?? 0}</TableCell>
                  <TableCell className="text-right">{r.unitsSold ?? 0}</TableCell>
                  <TableCell className="text-right">{formatPaise(paiseOf(r.grossPaise))}</TableCell>
                  <TableCell className="text-right">{formatPaise(paiseOf(r.refundedPaise))}</TableCell>
                  <TableCell className="text-right font-semibold">{formatPaise(paiseOf(r.netPaise))}</TableCell>
                </TableRow>
              ))}
              {totals && (
                <TableRow data-testid="by-tag-totals">
                  <TableCell className="font-semibold">Period total</TableCell>
                  <TableCell className="text-right font-semibold">{totals.count ?? 0}</TableCell>
                  <TableCell className="text-right font-semibold">{totals.unitsSold ?? 0}</TableCell>
                  <TableCell className="text-right font-semibold">{formatPaise(paiseOf(totals.grossPaise))}</TableCell>
                  <TableCell className="text-right font-semibold">{formatPaise(paiseOf(totals.refundedPaise))}</TableCell>
                  <TableCell className="text-right font-semibold">{formatPaise(paiseOf(totals.netPaise))}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { permissions } = useAuth();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const [from, setFrom] = useState(firstOfThisMonth);
  const [to, setTo] = useState(todayISO);
  const [activePreset, setActivePreset] = useState('This Month');

  const [dashboard, setDashboard] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [rentalsData, setRentalsData] = useState(null);
  const [expensesData, setExpensesData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [byTagData, setByTagData] = useState(null);
  const [byTagFilter, setByTagFilter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('sales');
  const [tabLoading, setTabLoading] = useState(false);

  const periodParams = useMemo(() => ({ from, to }), [from, to]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, inv] = await Promise.all([
        getDashboard(periodParams),
        getInventoryReport(),
      ]);
      setDashboard(dash);
      setInventoryData(inv);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [periodParams]);

  const loadTab = useCallback(
    async (tab) => {
      setTabLoading(true);
      try {
        if (tab === 'sales') {
          setSalesData(await getSalesReport(periodParams));
        } else if (tab === 'rentals') {
          setRentalsData(await getRentalsReport(periodParams));
        } else if (tab === 'expenses') {
          setExpensesData(await getExpensesReport(periodParams));
        } else if (tab === 'by-tag') {
          // Whole period in one shot; the tag chips filter the rows client-side
          // (see SalesByTagTable).
          setByTagData(await getSalesByTag(periodParams));
        }
      } catch (err) {
        setError(err.message || 'Failed to load report');
      } finally {
        setTabLoading(false);
      }
    },
    [periodParams]
  );

  useEffect(() => {
    if (can(PERMISSIONS.REPORTS.VIEW)) loadDashboard();
  }, [can, loadDashboard]);

  useEffect(() => {
    if (can(PERMISSIONS.REPORTS.VIEW) && !loading) loadTab(activeTab);
  }, [can, activeTab, loading, loadTab]);

  const applyPreset = (preset) => {
    setActivePreset(preset.label);
    setFrom(preset.from());
    setTo(preset.to());
  };

  const handleFromChange = (e) => {
    setFrom(e.target.value);
    setActivePreset('');
  };

  const handleToChange = (e) => {
    setTo(e.target.value);
    setActivePreset('');
  };

  if (!can(PERMISSIONS.REPORTS.VIEW)) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to view the dashboard.</p>
      </div>
    );
  }

  const dash = dashboard;
  const netPaise = dash ? Number(dash.netPaise) : 0;
  const salesNetPaise = dash ? Number(dash.sales.netPaise) : 0;
  const rentalsEarned = dash ? Number(dash.rentals.earnedPaise) : 0;
  const expensesTotal = dash ? Number(dash.expenses.totalPaise) : 0;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div>
        <ShopLogo size={{ logo: 40, text: 'text-2xl' }} className="mb-2" />
        <h1 className="typography-heading mb-1">Dashboard</h1>
        <p className="typography-body-sm text-[var(--ink-muted)]">
          Business overview and reports. Period: {from} to {to}
        </p>
      </div>

      {/* Period filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="typography-body-sm text-[var(--ink-muted)] mr-1">Period:</span>
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant={activePreset === p.label ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </Button>
            ))}
            <span className="mx-1 text-[var(--ink-muted)]">|</span>
            <Input
              type="date"
              value={from}
              onChange={handleFromChange}
              className="w-[150px]"
              aria-label="From date"
            />
            <span className="text-[var(--ink-muted)]">&rarr;</span>
            <Input
              type="date"
              value={to}
              onChange={handleToChange}
              className="w-[150px]"
              aria-label="To date"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </div>
      )}

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-md bg-[var(--surface-sunken)]" />
          ))}
        </div>
      ) : dash ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Net P&L" value={formatPaise(netPaise)} testid="kpi-net" />
          <KpiCard label="Sales (net)" value={formatPaise(salesNetPaise)} color="text-[var(--money-in)]" testid="kpi-sales" />
          <KpiCard label="Rentals earned" value={formatPaise(rentalsEarned)} color="text-[var(--money-held)]" testid="kpi-rentals" />
          <KpiCard label="Expenses" value={formatPaise(expensesTotal)} color="text-[var(--money-out)]" testid="kpi-expenses" />
        </div>
      ) : null}

      {/* Inventory summary row */}
      {inventoryData && (
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
          <span className="font-semibold">Inventory:</span>
          <span>{inventoryData.total} total</span>
          <span className="text-[var(--ink-muted)]">&middot;</span>
          <span>{inventoryData.retailInStock} retail in stock</span>
          {Object.entries(inventoryData.byChannel || {}).map(([ch, n]) => (
            <span key={ch} className="text-[var(--ink-muted)]">
              &middot; {ch}: {n}
            </span>
          ))}
        </div>
      )}

      {/* Sub-report tabs */}
      <Card>
        <CardContent className="p-0">
          {/* Sub-report tabs */}
          <div className="border-b border-[var(--border)] px-4 pt-3 pb-0">
            <Tabs aria-label="Report sections">
              {TABS.map((t) => (
                <Tab
                  key={t.key}
                  id={`dashboard-tab-${t.key}`}
                  active={activeTab === t.key}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </Tab>
              ))}
            </Tabs>
          </div>
          <div className="p-4">
            {tabLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-md bg-[var(--surface-sunken)]" />
                ))}
              </div>
            ) : (
              <>
                {activeTab === 'sales' && <SalesTable data={salesData} />}
                {activeTab === 'rentals' && <RentalsTable data={rentalsData} />}
                {activeTab === 'expenses' && <ExpensesTable data={expensesData} />}
                {activeTab === 'inventory' && <InventoryTable data={inventoryData} />}
                {activeTab === 'by-tag' && (
                  <SalesByTagTable
                    data={byTagData}
                    selectedTags={byTagFilter}
                    onSelectTags={setByTagFilter}
                  />
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;
