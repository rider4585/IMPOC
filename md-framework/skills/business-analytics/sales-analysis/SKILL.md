---
name: sales-analysis
version: 1.0.0
description: |
  Analyse sales volume and transaction patterns — units sold, transaction counts,
  basket size, and sales by time, staff, and channel. Use when asked "how are
  sales doing", "what's selling", or for periodic sales reporting. For money and
  margin see revenue-analysis and profit-analysis.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Sales Analysis

Sales analysis is about **activity**: how many transactions, how many units, how
big a basket, at what times. Revenue and margin are separate questions —
see `revenue-analysis` and `profit-analysis`.

> **Before running anything:** load `project-database` and confirm the real table
> and column names. The SQL below assumes a conventional schema
> (`sale`, `sale_line`, `product`) and must be adapted. Also confirm from
> `project-pos-rules` which sale statuses count — voided and held sales must be
> excluded or every figure is wrong.

### Establish the basis first

State these before presenting any number, or the analysis is not interpretable:

- **Which statuses count** — completed only; voids and holds excluded
- **How refunds are treated** — netted off, or reported separately
- **Whether the period is complete** — a partial day against a full one is not a
  comparison
- **Which shops** are included
- **Timezone** — a "day" boundary must match how the shop counts a day

### The core metrics

```sql
-- Daily sales activity
SELECT date_trunc('day', s.sold_at)::date AS day,
       count(*)                                  AS transactions,
       sum(l.quantity)                           AS units,
       round(avg(s.total) / 100.0, 2)            AS avg_basket_value,
       round(avg(line_counts.lines), 2)          AS avg_basket_lines
FROM sale s
JOIN sale_line l ON l.sale_id = s.id
JOIN LATERAL (SELECT count(*) AS lines FROM sale_line WHERE sale_id = s.id) line_counts ON true
WHERE s.status = 'completed'
  AND s.shop_id = $1
  AND s.sold_at >= $2 AND s.sold_at < $3
GROUP BY 1 ORDER BY 1;
```

| Metric | Meaning | What moves it |
|---|---|---|
| Transactions | Customers served | Footfall, opening hours, staffing |
| Units | Items sold | Basket size, promotions |
| Average basket value | Money per transaction | Mix, upselling, pricing |
| Average basket lines | Items per transaction | Cross-selling, layout |
| Units per line | Multi-buy behaviour | Pack sizes, offers |

**Transactions and basket value move independently.** A rise in revenue with flat
transactions means bigger baskets; with flat basket value it means more
customers. The distinction changes what you would do about it.

### By time of day and day of week

The most actionable sales analysis in a shop, because it drives staffing.

```sql
SELECT extract(dow  FROM s.sold_at) AS day_of_week,
       extract(hour FROM s.sold_at) AS hour,
       count(*)                     AS transactions,
       round(sum(s.total) / 100.0, 2) AS revenue
FROM sale s
WHERE s.status = 'completed' AND s.shop_id = $1
  AND s.sold_at >= now() - interval '90 days'
GROUP BY 1, 2 ORDER BY 1, 2;
```

Present this as a heatmap — the pattern is immediately visible, and it answers
"when do we need more staff" and "is the quiet hour worth being open".

### By staff member

Useful, and easy to misuse.

```sql
SELECT u.name,
       count(*)                        AS transactions,
       round(avg(s.total) / 100.0, 2)  AS avg_basket,
       count(*) FILTER (WHERE s.status = 'void') AS voids
FROM sale s JOIN "user" u ON u.id = s.cashier_id
WHERE s.shop_id = $1 AND s.sold_at >= $2
GROUP BY 1 ORDER BY 2 DESC;
```

**Caveat this honestly.** Staff figures reflect shift allocation more than
performance — whoever works Saturday morning will out-sell whoever works Tuesday
afternoon. Normalise by hours worked before drawing any conclusion, and never
present a raw ranking as a performance measure.

A high void rate is worth investigating, but it is a question (scanner problems?
training? till confusion?) before it is an accusation — see `ux-research`.

### Comparisons that mean something

A number alone is not information. Always compare against:

- **The same period last year** — the primary retail comparison, because it
  controls for seasonality
- **The previous equivalent period** — last week, same days
- **Like-for-like shops** where multiple locations exist

Never compare this month to last month without acknowledging seasonality — see
`seasonal-analysis`.

### Data quality caveats to state

Every sales report should carry the caveats that apply:

- Voided and held sales excluded (state the count — a high void rate distorts)
- Refunds netted or separate (say which)
- Period completeness
- Any till offline during the period, with sales queued or lost
- Any promotion running that makes the period atypical

### Presenting it

Lead with the answer, not the table. "Sales are up 12% year on year, driven by
larger baskets rather than more customers" — then the supporting figures.

For a shop owner (`audience: non-technical` in the harness config), avoid
statistical language. "Tuesday afternoons are consistently the quietest hour" is
useful; "the coefficient of variation is 0.34" is not.

### Checklist

- [ ] `project-database` loaded; table and column names verified
- [ ] Sale statuses confirmed against `project-pos-rules`
- [ ] Voids and holds excluded; void count reported
- [ ] Refund treatment stated
- [ ] Period completeness checked
- [ ] Timezone matches how the shop counts a day
- [ ] Transactions, units, and basket value reported separately
- [ ] Time-of-day and day-of-week pattern produced
- [ ] Staff figures normalised by hours before any comparison
- [ ] Year-on-year comparison included
- [ ] Data quality caveats stated
- [ ] Answer led with, in plain language

## References

- **National Retail Federation — retail metric definitions** (transactions,
  average transaction value, units per transaction)
  <https://nrf.com/research>
- **PostgreSQL 16 documentation — date/time functions and `date_trunc`**
  <https://www.postgresql.org/docs/16/functions-datetime.html>
- **Munder Difflin `config.json`** — `audience: non-technical`, which sets the
  reporting register

**Not sourced — written for this framework:** all SQL patterns, the
basis-before-numbers rule, the staff-figures caveat, and the data-quality
checklist.
