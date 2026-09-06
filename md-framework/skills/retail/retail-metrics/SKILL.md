---
name: retail-metrics
version: 1.0.0
description: |
  Define, calculate, and interpret the core retail metrics — sales, margin,
  inventory, and customer measures — consistently. Use when building a dashboard,
  when metrics are defined inconsistently across reports, or when asked "what
  should we be tracking".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Retail Metrics

A small set of metrics, defined once and calculated the same way everywhere. The
most common problem is not missing metrics but **the same metric computed
differently in two reports**, which destroys trust in all of them.

> **Before running anything:** load `project-database` and
> `project-pricing-rules`. Every definition below depends on tax treatment,
> refund handling, and which sale statuses count.

### The definitions that must be fixed

Write these down once, in `project-business-rules`, and reference them:

| Metric | Definition | Common error |
|---|---|---|
| **Net sales** | Completed sales − refunds, **excluding tax** | Including tax; forgetting refunds |
| **Transactions** | Count of completed sales | Counting voids or holds |
| **Average transaction value** | Net sales ÷ transactions | Mixing tax-inclusive and exclusive |
| **Units per transaction** | Units sold ÷ transactions | Counting lines instead of units |
| **Gross margin %** | (Net sales − COGS) ÷ net sales | Confusing with markup |
| **COGS** | Historical cost of goods sold | Using current cost |
| **Stock turnover** | COGS ÷ average inventory at cost | Mixing retail and cost values |
| **GMROI** | Gross profit ÷ average inventory at cost | Using closing not average |
| **Sell-through %** | Units sold ÷ units received | Ignoring opening stock |
| **Shrinkage %** | (Expected − counted) ÷ expected, at cost | Not measured at all |
| **Repeat rate** | Customers with > 1 purchase ÷ identified customers | Denominator = all sales |

**Margin versus markup** is the single most common error, and it overstates
profitability substantially. A 50% markup is a 33% margin — always label which.

### The core dashboard

Five to nine metrics, no more — see `ui-design`.

```sql
WITH period AS (SELECT $2::timestamptz AS from_ts, $3::timestamptz AS to_ts)
SELECT
  count(*)                                                    AS transactions,
  round(sum(s.subtotal - s.discount_total)/100.0, 2)          AS net_sales_ex_tax,
  round(avg(s.subtotal - s.discount_total)/100.0, 2)          AS avg_transaction_value,
  round(sum(li.units)::numeric / count(*), 2)                 AS units_per_transaction,
  round(sum(li.cogs)/100.0, 2)                                AS cogs,
  round(100.0 * (sum(s.subtotal - s.discount_total) - sum(li.cogs))
        / nullif(sum(s.subtotal - s.discount_total),0), 1)    AS gross_margin_pct,
  round(100.0 * sum(s.discount_total)
        / nullif(sum(s.subtotal),0), 1)                       AS discount_rate_pct
FROM sale s
JOIN LATERAL (SELECT sum(l.quantity) AS units,
                     sum(l.quantity * l.cost_price) AS cogs
              FROM sale_line l WHERE l.sale_id = s.id) li ON true
CROSS JOIN period p
WHERE s.status='completed' AND s.shop_id=$1
  AND s.sold_at >= p.from_ts AND s.sold_at < p.to_ts;
```

**Include the discount rate.** It is the metric most likely to explain a margin
decline and the one most often omitted.

### Every metric needs a comparison

A number alone is not information.

```sql
SELECT round(sum(total) FILTER (WHERE sold_at >= $2 AND sold_at < $3)/100.0, 2)  AS current,
       round(sum(total) FILTER (WHERE sold_at >= $2::date - interval '1 year'
                                  AND sold_at <  $3::date - interval '1 year')/100.0, 2) AS last_year
FROM sale WHERE status='completed' AND shop_id=$1;
```

Year-on-year is the primary retail comparison — it controls for seasonality.
Month-on-month without seasonal adjustment is usually misleading — see
`seasonal-analysis`.

### Metrics that are usually missing

Most shops track sales and stop. These are more diagnostic:

- **Discount rate** — rising discount with flat revenue means buying your own
  sales
- **Shrinkage** — the difference between book and counted stock; unmeasured, it
  is invisible loss
- **Void and refund rate** — a rising rate is either a process problem or
  something worse
- **Stockout frequency** on top sellers — lost sales appear in no report
- **Days of supply** — where cash is trapped

```sql
-- Void and refund rate, worth watching
SELECT date_trunc('month', sold_at)::date AS month,
       round(100.0 * count(*) FILTER (WHERE status='void') / count(*), 2) AS void_rate_pct
FROM sale WHERE shop_id=$1 GROUP BY 1 ORDER BY 1;
```

### Calculate once, in one place

The way to prevent inconsistent metrics is structural: a single view or module
that every report uses.

Two reports computing "net sales" with different refund handling will disagree,
and then nobody trusts either. Where a stored aggregate exists, provide a
reconciliation query — see `data-integrity`.

### Report in plain language

For a non-technical audience:

- Money before percentages
- One comparison, clearly labelled
- The driver, not just the number
- No statistical vocabulary

> "Sales last month were ₹4.8 lakh, 12% up on the same month last year. Margin
> slipped from 31% to 28% because discounting rose from 3% to 5%."

That reads as an explanation. A table of eleven metrics does not.

### Caveats to state

- Tax treatment and refund handling
- Which statuses are counted
- Period completeness and equal length
- Whether cost data is historical and complete
- Identification rate for any customer metric

### Checklist

- [ ] Definitions written down once and referenced
- [ ] Margin and markup clearly distinguished
- [ ] Tax excluded from sales and margin figures
- [ ] Refunds handled consistently, convention stated
- [ ] Dashboard limited to 5–9 metrics
- [ ] Discount rate included
- [ ] Every metric carries a year-on-year comparison
- [ ] Shrinkage, void rate, and stockout frequency tracked
- [ ] Metrics computed in one shared place
- [ ] Stored aggregates reconcilable
- [ ] Reported in plain language with the driver

## References

- **National Retail Federation — standard retail metric definitions** (net
  sales, ATV, UPT, GMROI, sell-through, shrinkage)
  <https://nrf.com/research>
- **IAS 2 — Inventories** — COGS and inventory valuation basis
  <https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/>
- **IFRS 15 — Revenue** — why collected tax is not revenue
  <https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/>
- **PostgreSQL 16 documentation — `LATERAL`, `FILTER`**
  <https://www.postgresql.org/docs/16/queries-table-expressions.html>

**Not sourced — written for this framework:** the common-error column, the SQL
patterns, the usually-missing metrics list, the calculate-once rule, and the
plain-language reporting format.
