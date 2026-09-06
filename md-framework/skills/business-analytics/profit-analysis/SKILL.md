---
name: profit-analysis
version: 1.0.0
description: |
  Analyse margin and profitability — gross margin, margin by product and
  category, and the effect of discounting on profit. Use when asked "are we
  actually making money", when revenue grows but profit does not, or for margin
  reporting.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Profit Analysis

Revenue is vanity; margin is the business. A shop can grow revenue while making
less money, and only margin analysis shows it.

> **Before running anything:** load `project-database`, `project-pricing-rules`
> (tax and discount treatment), and `project-inventory-rules` (**costing
> method**). The costing method determines what "cost" means and therefore every
> figure here.

### Cost must be the historical cost

The single most important correctness rule in this skill.

**Use the cost recorded on the sale line, not the product's current cost.** A
sale from March must be valued at March's cost. Using today's cost restates
history every time a supplier changes price, and makes margin trends meaningless.

If `sale_line` does not snapshot `cost_price`, that is a **finding** — report it,
because margin history cannot be computed correctly without it. See
`normalization`.

### Gross margin

```sql
SELECT date_trunc('month', s.sold_at)::date AS month,
       round(sum(l.quantity * l.unit_price - l.discount) / 100.0, 2) AS net_revenue,
       round(sum(l.quantity * l.cost_price)              / 100.0, 2) AS cogs,
       round((sum(l.quantity * l.unit_price - l.discount)
              - sum(l.quantity * l.cost_price)) / 100.0, 2)          AS gross_profit,
       round(100.0 * (sum(l.quantity * l.unit_price - l.discount)
                      - sum(l.quantity * l.cost_price))
             / nullif(sum(l.quantity * l.unit_price - l.discount), 0), 1) AS margin_pct
FROM sale_line l
JOIN sale s ON s.id = l.sale_id AND s.status = 'completed'
WHERE s.shop_id = $1 AND s.sold_at >= $2
GROUP BY 1 ORDER BY 1;
```

Two ratios, often confused:

| Ratio | Formula | Use |
|---|---|---|
| **Margin %** | (price − cost) / **price** | Share of revenue kept — use this for reporting |
| **Markup %** | (price − cost) / **cost** | Used when setting prices from cost |

A 50% markup is a 33% margin. Confusing them overstates profitability by a wide
factor — always label which you are reporting.

### Margin by product

Where the money actually comes from is rarely where the revenue comes from.

```sql
SELECT p.name,
       sum(l.quantity)                                            AS units,
       round(sum(l.quantity * l.unit_price - l.discount)/100.0,2) AS revenue,
       round(sum(l.quantity * (l.unit_price - l.cost_price) - l.discount)/100.0,2) AS profit,
       round(100.0 * sum(l.quantity * (l.unit_price - l.cost_price) - l.discount)
             / nullif(sum(l.quantity * l.unit_price - l.discount),0), 1) AS margin_pct
FROM sale_line l
JOIN sale s    ON s.id = l.sale_id AND s.status = 'completed'
JOIN product p ON p.id = l.product_id
WHERE s.shop_id = $1 AND s.sold_at >= $2
GROUP BY 1 ORDER BY profit DESC;
```

Sort by **profit**, not revenue. The most useful output is the contrast:

- **High revenue, low margin** — busy but not profitable; consider repricing
- **Low revenue, high margin** — worth promoting
- **Negative margin** — selling at a loss. Investigate immediately: it is usually
  a cost update, a mispriced item, or an over-generous discount

```sql
-- Lines sold below cost — always worth surfacing
SELECT p.name, s.id AS sale_id, s.sold_at,
       l.unit_price, l.discount, l.cost_price
FROM sale_line l
JOIN sale s ON s.id = l.sale_id AND s.status='completed'
JOIN product p ON p.id = l.product_id
WHERE (l.unit_price - l.discount / nullif(l.quantity,0)) < l.cost_price
  AND s.shop_id = $1 AND s.sold_at >= $2;
```

### Discount is margin, spent

Every rupee of discount comes directly out of profit — it is not a cost of goods,
it is forgone margin.

```sql
SELECT date_trunc('month', s.sold_at)::date AS month,
       round(100.0 * sum(l.discount) / nullif(sum(l.quantity * l.unit_price),0), 1) AS discount_rate_pct,
       round(100.0 * (sum(l.quantity*(l.unit_price - l.cost_price)) - sum(l.discount))
             / nullif(sum(l.quantity*l.unit_price - l.discount),0), 1) AS margin_after_discount
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE s.shop_id=$1 GROUP BY 1 ORDER BY 1;
```

**A rising discount rate with flat revenue means the business is buying its own
sales.** That is the most valuable finding this skill produces — see
`discount-strategy`.

### What this does not measure

Gross margin is not profit. It excludes rent, wages, utilities, shrinkage, and
payment processing fees. Say so explicitly — a shop owner reading "35% margin"
may hear "35% profit", which is not what it means.

Where operating costs are known, note the gap. Where they are not, state the
limitation rather than implying the number is net profit.

### Caveats to state

- Costing method (weighted average, FIFO) and whether cost is historical
- Whether `cost_price` is snapshotted on the line — if not, figures are
  approximate and trends unreliable
- Tax excluded from both revenue and cost
- Refunds netted
- Shrinkage, wastage, and operating costs **not** included
- Products with missing cost data, and how many

Missing cost data is common and silently distorts margin. Count and report it:

```sql
SELECT count(*) FILTER (WHERE l.cost_price IS NULL OR l.cost_price = 0) AS lines_without_cost,
       count(*) AS total_lines
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE s.shop_id=$1 AND s.sold_at >= $2;
```

### Checklist

- [ ] `project-inventory-rules` loaded; costing method confirmed
- [ ] Historical cost used, not current cost
- [ ] Missing snapshot cost reported as a finding if absent
- [ ] Margin and markup clearly distinguished and labelled
- [ ] Products ranked by profit, not revenue
- [ ] Below-cost sales surfaced
- [ ] Discount rate reported alongside margin
- [ ] Lines with missing cost counted and disclosed
- [ ] Stated clearly that gross margin is not net profit
- [ ] Tax excluded from both sides

## References

- **IAS 2 — Inventories** — cost formulas (FIFO, weighted average) determining
  COGS <https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/>
- **National Retail Federation — gross margin and markup definitions**
  <https://nrf.com/research>
- **PostgreSQL 16 documentation — aggregate functions and `nullif`**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the SQL patterns, the
historical-cost rule and its finding condition, the margin-vs-markup warning,
the discount-as-forgone-margin framing, and the missing-cost disclosure.
