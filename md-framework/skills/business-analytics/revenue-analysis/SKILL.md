---
name: revenue-analysis
version: 1.0.0
description: |
  Analyse revenue — gross versus net, growth, mix, and the drivers behind a
  change. Use when asked "how much did we make", for period revenue reporting, or
  when revenue moves and the cause is unclear. For volume see sales-analysis; for
  margin see profit-analysis.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Revenue Analysis

Revenue is money in. The analysis that matters is rarely the total — it is
**what changed and why**.

> **Before running anything:** load `project-database` for real table names and
> `project-pricing-rules` for how tax, discounts, and rounding are handled. The
> tax treatment in particular changes what "revenue" means, and getting it wrong
> makes every figure below incorrect.

### Define revenue precisely

State which definition you are using. These are different numbers:

| Term | Meaning |
|---|---|
| **Gross revenue** | Total charged, before discounts |
| **Net revenue** | After discounts and returns — usually the meaningful figure |
| **Revenue excluding tax** | What the business actually keeps of the sale |
| **Revenue including tax** | What the customer paid |

**Tax is not revenue.** Collected tax is owed to the tax authority; including it
overstates the business by the tax rate. Confirm from `project-pricing-rules`
whether stored prices are tax-inclusive or exclusive, and label every figure
accordingly.

```sql
SELECT date_trunc('month', s.sold_at)::date       AS month,
       round(sum(s.subtotal)      / 100.0, 2)     AS gross_ex_tax,
       round(sum(s.discount_total)/ 100.0, 2)     AS discounts,
       round(sum(s.tax_total)     / 100.0, 2)     AS tax_collected,
       round(sum(s.total)         / 100.0, 2)     AS total_charged,
       round((sum(s.subtotal) - sum(s.discount_total)) / 100.0, 2) AS net_revenue_ex_tax
FROM sale s
WHERE s.status = 'completed' AND s.shop_id = $1
  AND s.sold_at >= $2 AND s.sold_at < $3
GROUP BY 1 ORDER BY 1;
```

Net revenue excluding tax, after refunds, is the figure to lead with.

### Refunds must be netted

```sql
-- Revenue net of refunds, by month
WITH sales AS (
  SELECT date_trunc('month', sold_at) AS m, sum(total) AS amt
  FROM sale WHERE status = 'completed' AND shop_id = $1 GROUP BY 1),
refunds AS (
  SELECT date_trunc('month', created_at) AS m, sum(amount) AS amt
  FROM refund WHERE shop_id = $1 GROUP BY 1)
SELECT coalesce(s.m, r.m)::date AS month,
       round(coalesce(s.amt,0)/100.0, 2)                        AS gross,
       round(coalesce(r.amt,0)/100.0, 2)                        AS refunded,
       round((coalesce(s.amt,0) - coalesce(r.amt,0))/100.0, 2)  AS net
FROM sales s FULL OUTER JOIN refunds r ON r.m = s.m
ORDER BY 1;
```

**Refunds belong to the period they occur in, not the period of the original
sale** — unless the business explicitly restates. Say which convention you used.

### Decompose growth

"Revenue is up 12%" is a headline, not an analysis. Break it into drivers:

```
Revenue = Transactions × Average basket value
```

```sql
SELECT date_trunc('month', sold_at)::date AS month,
       count(*)                            AS transactions,
       round(avg(total)/100.0, 2)          AS avg_basket,
       round(sum(total)/100.0, 2)          AS revenue
FROM sale WHERE status='completed' AND shop_id=$1
GROUP BY 1 ORDER BY 1;
```

| Transactions | Basket value | Interpretation |
|---|---|---|
| ↑ | → | More customers — footfall or marketing working |
| → | ↑ | Bigger baskets — mix, pricing, or upselling |
| ↑ | ↓ | More customers buying less — check whether discounting drove traffic |
| ↓ | ↑ | Fewer, larger purchases — possible loss of casual trade |
| ↓ | ↓ | Genuine decline — investigate urgently |

The last two rows are the ones that matter and the ones a headline total hides.

### Revenue mix

Where revenue comes from is more actionable than the total.

```sql
SELECT c.name AS category,
       round(sum(l.quantity * l.unit_price - l.discount)/100.0, 2) AS revenue,
       round(100.0 * sum(l.quantity * l.unit_price - l.discount)
             / sum(sum(l.quantity * l.unit_price - l.discount)) OVER (), 1) AS pct_of_total
FROM sale_line l
JOIN sale s    ON s.id = l.sale_id AND s.status = 'completed'
JOIN product p ON p.id = l.product_id
JOIN category c ON c.id = p.category_id
WHERE s.shop_id = $1 AND s.sold_at >= $2
GROUP BY 1 ORDER BY 2 DESC;
```

Watch for **concentration risk**: if one category or one product is a large share
of revenue, the business is exposed to a supplier change or a shift in demand.
Say so when it is true.

### Comparisons

- **Year on year** is the primary retail comparison — it controls for season
- **Month on month** without seasonal adjustment is usually misleading
- **Like-for-like** across shops, normalised by size or hours

Always state whether the periods are of equal length and completeness. A 30-day
month against a 31-day month differs by ~3% before anything real happens.

### Caveats to state every time

- Tax treatment (inclusive or exclusive) and whether tax is included
- Refund convention
- Voided sales excluded, with the count
- Period completeness and equal length
- Any promotion or one-off event distorting the period
- Any till offline with lost or queued sales

### Presenting it

Lead with net revenue excluding tax, the change, and **the driver**:

> "Net revenue in August was ₹4.82 lakh, up 12% on last August. The growth came
> from larger baskets (₹412 → ₹461), not more customers — transaction count was
> flat. Discounts rose from 3.1% to 5.4% of gross, so some of the basket growth
> was bought."

That last sentence is the analysis. A number without a driver is a report, not an
insight.

### Checklist

- [ ] `project-database` and `project-pricing-rules` loaded
- [ ] Revenue definition stated; tax treatment explicit
- [ ] Tax excluded from revenue figures
- [ ] Refunds netted, with the convention stated
- [ ] Voids excluded, count reported
- [ ] Growth decomposed into transactions × basket value
- [ ] Mix analysed; concentration risk flagged if present
- [ ] Year-on-year comparison used, with equal-length periods
- [ ] Discount rate reported alongside revenue growth
- [ ] Caveats listed
- [ ] Presented with the driver, not just the total

## References

- **National Retail Federation — retail metrics** (net sales, average
  transaction value, like-for-like) <https://nrf.com/research>
- **IAS 18 / IFRS 15 — Revenue recognition** — why collected tax is not revenue
  <https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/>
- **PostgreSQL 16 documentation — window functions**
  <https://www.postgresql.org/docs/16/tutorial-window.html>

**Not sourced — written for this framework:** the SQL patterns, the
growth-decomposition interpretation table, the refund-period convention rule, and
the presentation format.
