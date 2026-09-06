---
name: product-performance
version: 1.0.0
description: |
  Rank and assess individual products across volume, revenue, margin, and
  velocity to decide what to stock, promote, reprice, or drop. Use when asked
  "which products are doing well", when reviewing the range, or before a
  purchasing decision.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Product Performance

No single metric identifies a good product. A high-revenue item can be
unprofitable; a high-margin item can be dead stock. **Assess on several axes and
look at the combination.**

> **Before running anything:** load `project-database` and `project-inventory-rules`.
> Margin figures require historical cost on the sale line — see
> `profit-analysis`.

### The multi-axis view

```sql
WITH perf AS (
  SELECT p.id, p.name, p.sku,
         sum(l.quantity)                                              AS units,
         count(DISTINCT s.id)                                         AS transactions,
         sum(l.quantity * l.unit_price - l.discount)                  AS revenue,
         sum(l.quantity * (l.unit_price - l.cost_price) - l.discount) AS profit,
         max(s.sold_at)                                               AS last_sold
  FROM product p
  LEFT JOIN sale_line l ON l.product_id = p.id
  LEFT JOIN sale s ON s.id = l.sale_id AND s.status = 'completed'
                  AND s.sold_at >= now() - interval '90 days'
  WHERE p.shop_id = $1 AND p.is_active
  GROUP BY p.id, p.name, p.sku
)
SELECT name, sku, units, transactions,
       round(revenue/100.0, 2) AS revenue,
       round(profit /100.0, 2) AS profit,
       round(100.0 * profit / nullif(revenue,0), 1) AS margin_pct,
       coalesce(st.quantity, 0) AS stock_on_hand,
       last_sold::date,
       round(100.0 * revenue / nullif(sum(revenue) OVER (),0), 2) AS pct_of_revenue
FROM perf LEFT JOIN stock st ON st.product_id = perf.id
ORDER BY profit DESC NULLS LAST;
```

Read the columns **together**. The interesting products are the ones where the
rankings disagree.

### ABC classification

The standard way to focus attention: rank by contribution, then take cumulative
share.

```sql
WITH ranked AS (
  SELECT p.name,
         sum(l.quantity * (l.unit_price - l.cost_price) - l.discount) AS profit
  FROM sale_line l
  JOIN sale s ON s.id=l.sale_id AND s.status='completed' AND s.sold_at >= now() - interval '365 days'
  JOIN product p ON p.id=l.product_id
  WHERE s.shop_id=$1 GROUP BY 1
), cum AS (
  SELECT name, profit,
         sum(profit) OVER (ORDER BY profit DESC) / sum(profit) OVER () AS cum_share
  FROM ranked
)
SELECT name, round(profit/100.0,2) AS profit, round(100*cum_share,1) AS cumulative_pct,
       CASE WHEN cum_share <= 0.80 THEN 'A'
            WHEN cum_share <= 0.95 THEN 'B' ELSE 'C' END AS class
FROM cum ORDER BY profit DESC;
```

- **A** (~top 80% of profit) — never out of stock; protect these
- **B** (next 15%) — normal management
- **C** (last 5%) — candidates for delisting; they consume shelf space, capital,
  and attention

Classify by **profit**, not revenue. Classifying by revenue promotes busy,
low-margin lines.

### The four quadrants

Cross velocity with margin — this is the most decision-useful framing:

| | High margin | Low margin |
|---|---|---|
| **Fast-moving** | **Stars** — protect availability, feature prominently | **Traffic builders** — fine if they bring customers; check they do |
| **Slow-moving** | **Specialists** — keep if capital allows; promote | **Dogs** — delist unless there is a specific reason |

Before delisting a "dog", check whether it is bought **with** other things — see
`cross-selling`. A low-margin item that anchors a basket is not a dog.

### New products

Judge separately, and not too early.

```sql
SELECT p.name, p.created_at::date AS listed,
       sum(l.quantity) AS units_since_listing,
       (now()::date - p.created_at::date) AS days_listed
FROM product p
LEFT JOIN sale_line l ON l.product_id=p.id
LEFT JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE p.shop_id=$1 AND p.created_at >= now() - interval '90 days'
GROUP BY 1,2 ORDER BY 2 DESC;
```

A product listed three weeks ago cannot be compared to one stocked for two years.
Give a new line a stated trial period — one full purchasing cycle, or a season —
before judging it.

### Products that need attention

```sql
-- Sold well historically, nothing recently
SELECT p.name, max(s.sold_at)::date AS last_sold,
       sum(l.quantity) FILTER (WHERE s.sold_at >= now() - interval '365 days'
                                 AND s.sold_at <  now() - interval '90 days') AS units_prior,
       sum(l.quantity) FILTER (WHERE s.sold_at >= now() - interval '90 days')  AS units_recent
FROM product p
JOIN sale_line l ON l.product_id=p.id
JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE p.shop_id=$1 AND p.is_active
GROUP BY 1 HAVING sum(l.quantity) FILTER (WHERE s.sold_at >= now() - interval '90 days') = 0
ORDER BY units_prior DESC NULLS LAST;
```

A product that sold steadily and then stopped is a signal: out of stock,
delisted by mistake, price change, competitor, or genuine demand shift. Check
stock history before concluding demand fell.

### Caveats

- **Out-of-stock periods depress sales** — a product cannot sell what was not
  there. Check stock history before calling something slow-moving
- Seasonal products look poor out of season — see `seasonal-analysis`
- Products with missing cost data distort every margin ranking
- Short listing periods are not comparable to long ones
- Promotions inflate the period they ran in

### Checklist

- [ ] Multiple axes reported together, not a single ranking
- [ ] ABC classification by profit, not revenue
- [ ] Velocity × margin quadrants produced
- [ ] Basket associations checked before recommending a delisting
- [ ] New products judged separately with a stated trial period
- [ ] Stopped-selling products surfaced and investigated
- [ ] Stock availability checked before calling anything slow-moving
- [ ] Seasonality accounted for
- [ ] Missing cost data disclosed
- [ ] Recommendations tied to a decision, not just a ranking

## References

- **ABC analysis / Pareto principle in inventory management** — APICS/ASCM
  Dictionary definitions of A, B, and C classification
- **National Retail Federation — product performance metrics**
  <https://nrf.com/research>
- **PostgreSQL 16 documentation — window functions for cumulative share**
  <https://www.postgresql.org/docs/16/tutorial-window.html>

**Not sourced — written for this framework:** the SQL patterns, the
velocity × margin quadrant table, the classify-by-profit rule, the new-product
trial-period rule, and the out-of-stock caveat.
