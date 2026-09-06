---
name: store-growth
version: 1.0.0
description: |
  Identify and sequence realistic growth options for a shop — the growth levers,
  what each costs, and which to try first. Use when planning growth, when sales
  have plateaued, or when asked "how do we grow the business".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Store Growth

Retail revenue decomposes into a small number of levers. Growth work is choosing
which to pull, in what order, given limited cash and attention.

```
Revenue = Customers × Visit frequency × Basket size
```

Every growth idea affects one of these three. Naming which one it affects makes
competing proposals comparable.

> **Before advising:** load `project-database` and establish where the business
> actually stands — see `retail-metrics`, `customer-retention`, and
> `inventory-profitability`.

### Diagnose before prescribing

```sql
SELECT date_trunc('month', sold_at)::date AS month,
       count(*)                                     AS transactions,
       round(avg(total)/100.0, 2)                   AS avg_basket,
       round(sum(total)/100.0, 2)                   AS revenue,
       count(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL) AS identified_customers
FROM sale WHERE status='completed' AND shop_id=$1
  AND sold_at >= now() - interval '24 months'
GROUP BY 1 ORDER BY 1;
```

Which component is flat tells you which lever to pull:

| Flat / falling | Likely constraint | Start with |
|---|---|---|
| Transactions | Fewer customers, or less often | Retention, then local visibility |
| Average basket | Range, placement, or pricing | Cross-selling, upselling, merchandising |
| Both | Something structural — competitor, location, offer | Diagnose before spending |
| Neither, but profit falling | Margin, not sales | Pricing, discounting, cost |

**A profit problem dressed as a growth problem is common.** Check margin before
recommending anything that costs money — see `profit-analysis`.

### The levers, cheapest first

Order matters. Cheap, fast, reversible interventions before expensive
commitments.

| # | Lever | Cost | Speed |
|---|---|---|---|
| 1 | **Fix stockouts on top sellers** | Working capital only | Immediate |
| 2 | **Reprice mispriced lines** | None | Immediate |
| 3 | **Control discounting** | None — it returns margin | Weeks |
| 4 | **Merchandising and placement** | Effort | 3–4 weeks |
| 5 | **Cross-sell and upsell** | Effort | Weeks |
| 6 | **Reactivate lapsed customers** | Low | Weeks |
| 7 | **Range changes** — add what is asked for, cut dead stock | Moderate | A cycle |
| 8 | **Local visibility** — Google profile, signage | Low | Months |
| 9 | **Extended hours** | Wages | Immediate, measurable |
| 10 | **New location or channel** | High, hard to reverse | Months |

**Numbers 1–3 cost nothing and often return more than anything below them.** A
shop losing sales to stockouts on its top ten lines has a growth problem it can
fix this week.

```sql
-- The most valuable growth query in this skill
SELECT p.name,
       round(sum(l.quantity)/90.0, 2) AS daily_rate,
       count(*) FILTER (WHERE sm.quantity_after = 0) AS zero_stock_events,
       round(sum(l.quantity)/90.0 * count(*) FILTER (WHERE sm.quantity_after=0)
             * (p.unit_price - p.cost_price)/100.0, 2) AS estimated_lost_profit
FROM product p
JOIN sale_line l ON l.product_id=p.id
JOIN sale s ON s.id=l.sale_id AND s.status='completed' AND s.sold_at >= now()-interval '90 days'
LEFT JOIN stock_movement sm ON sm.product_id=p.id AND sm.created_at >= now()-interval '90 days'
WHERE p.shop_id=$1
GROUP BY p.name, p.unit_price, p.cost_price
HAVING count(*) FILTER (WHERE sm.quantity_after=0) > 0
ORDER BY estimated_lost_profit DESC;
```

Lost sales appear in no report. This estimate makes the invisible visible, and it
is usually the largest single opportunity in a small shop.

### Growth is limited by cash, not ideas

```sql
SELECT round(sum(st.quantity * p.cost_price)/100.0, 2) AS capital_in_stock,
       round(sum(st.quantity * p.cost_price) FILTER (
         WHERE NOT EXISTS (SELECT 1 FROM sale_line l JOIN sale s ON s.id=l.sale_id
                           WHERE l.product_id=p.id AND s.status='completed'
                             AND s.sold_at >= now()-interval '180 days'))/100.0, 2) AS capital_in_dead_stock
FROM product p JOIN stock st ON st.product_id=p.id AND st.quantity>0
WHERE p.shop_id=$1;
```

**Cash trapped in dead stock is the growth budget.** Clearing it funds more of
what sells — see `dead-stock` and `inventory-profitability`. That is usually a
better first move than borrowing.

### Judge the expensive options honestly

For extended hours, a new location, or a new channel, work out the break-even
before committing:

```
Extra hour per day, 6 days     = 26 hours/month
Wage cost                       = ₹X
Required gross profit           = ₹X
At 28% margin, required revenue = ₹X ÷ 0.28
Observed revenue in that hour   = from last year's hourly data
```

If the hour historically takes less than the break-even, it does not pay — and
saying so is more useful than encouraging it. A shop owner is entitled to a
straight answer about a bad idea.

### Sequence, do not scatter

- **One or two initiatives at a time.** A small shop cannot execute five, and
  overlapping changes make measurement impossible
- **Measure each** before starting the next — see `campaign-analysis`
- **Cheap and reversible first**
- **Keep the till running.** Growth work that degrades daily execution costs more
  than it earns

### What to say when growth is not the answer

Sometimes the honest advice is not a growth plan:

- Margin is the problem, not volume
- The shop is capacity-constrained at peak and needs throughput, not demand
- Cash is the constraint and must be released before anything else
- The location or the competitive position has changed structurally
- The owner is at capacity, and more revenue would not be servable

Say it plainly. A realistic assessment is worth more than an optimistic plan that
cannot be executed.

### Checklist

- [ ] Revenue decomposed into customers × frequency × basket
- [ ] The constrained component identified from data
- [ ] Margin checked before recommending spend
- [ ] Lost sales from stockouts estimated
- [ ] Cheap, reversible levers exhausted first
- [ ] Cash trapped in dead stock quantified as the growth budget
- [ ] Expensive options break-even tested against real hourly data
- [ ] One or two initiatives at a time, each measured
- [ ] Daily execution protected
- [ ] Honest assessment given where growth is not the right goal

## References

- **National Retail Federation — retail growth and productivity metrics**
  <https://nrf.com/research>
- **Byron Sharp, _How Brands Grow_** — penetration over loyalty as the primary
  growth route
- **Standard retail practice** — the customers × frequency × basket
  decomposition
- **PostgreSQL 16 documentation — `FILTER`, `EXISTS`**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the ordered lever table, the
lost-sales estimation query, the dead-stock-as-growth-budget framing, the
break-even test for extended hours, and the when-growth-is-not-the-answer list.
