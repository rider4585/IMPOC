---
name: stock-turnover
version: 1.0.0
description: |
  Measure how quickly inventory converts to sales — turnover ratio, days of
  supply, and GMROI — to judge whether capital is working. Use when reviewing
  inventory efficiency, when cash is tied up in stock, or when asked "how fast is
  our stock moving".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Stock Turnover

Inventory is cash sitting on a shelf. Turnover measures how hard that cash is
working: how many times the stock is sold and replaced in a period.

> **Before running anything:** load `project-database` and
> `project-inventory-rules` — the **costing method** determines the cost figures
> this depends on.

### The ratio

```
Stock turnover = Cost of goods sold ÷ Average inventory at cost
Days of supply = 365 ÷ turnover
```

Both sides must be at **cost**. Mixing revenue (at retail) with inventory (at
cost) inflates the ratio by the margin — a common and serious error.

```sql
WITH cogs AS (
  SELECT sum(l.quantity * l.cost_price) AS total_cogs
  FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
  WHERE s.shop_id=$1 AND s.sold_at >= now() - interval '365 days'
),
avg_inv AS (
  SELECT avg(daily.value) AS avg_inventory
  FROM (SELECT date_trunc('day', sm.created_at) AS d,
               sum(sm.quantity_after * p.cost_price) AS value
        FROM stock_movement sm JOIN product p ON p.id=sm.product_id
        WHERE p.shop_id=$1 AND sm.created_at >= now() - interval '365 days'
        GROUP BY 1) daily
)
SELECT round(total_cogs/100.0, 2)                        AS cogs_365d,
       round(avg_inventory/100.0, 2)                     AS avg_inventory_at_cost,
       round(total_cogs / nullif(avg_inventory,0), 2)    AS turnover,
       round(365 / nullif(total_cogs / nullif(avg_inventory,0), 0), 0) AS days_of_supply
FROM cogs, avg_inv;
```

**Average inventory matters.** Using only the closing balance distorts the ratio
badly for a business with seasonal stock — a shop measured in January after
clearing Christmas stock will look far more efficient than it is. Where a
movement history exists, average over the period; where it does not, say that
the figure is approximate.

### What good looks like depends entirely on the goods

There is no universal target. Turnover expectations differ by category by an
order of magnitude:

| Goods | Typical character |
|---|---|
| Fresh, perishable | Very high turnover; days of supply measured in days |
| Fast-moving consumables | High |
| General merchandise | Moderate |
| Slow, high-value, or specialist | Low turnover, high margin per unit |

**Compare a category to its own history, not to another category.** Comparing
fresh produce turnover to homeware turnover produces a meaningless conclusion.

### Turnover by product and category

```sql
SELECT p.name,
       sum(l.quantity)                                    AS units_sold_365d,
       coalesce(st.quantity,0)                            AS stock_now,
       round(sum(l.quantity)/365.0, 3)                    AS avg_daily_sales,
       round(coalesce(st.quantity,0) / nullif(sum(l.quantity)/365.0, 0), 0) AS days_of_supply
FROM product p
LEFT JOIN stock st ON st.product_id=p.id
LEFT JOIN sale_line l ON l.product_id=p.id
LEFT JOIN sale s ON s.id=l.sale_id AND s.status='completed'
                AND s.sold_at >= now() - interval '365 days'
WHERE p.shop_id=$1 AND p.is_active
GROUP BY p.name, st.quantity
ORDER BY days_of_supply DESC NULLS FIRST;
```

Reading the extremes:

- **Very high days of supply** — overstocked; capital trapped. See `dead-stock`
- **Very low days of supply** — risk of stockout; check reorder point (see
  `reorder-analysis`)
- **NULL / no sales** — dead stock, or a new product not yet selling

### Turnover alone is not the goal

High turnover achieved by understocking causes lost sales, which do not appear in
any of these figures. Balance turnover against **stockout frequency**:

```sql
SELECT p.name, count(*) AS days_at_zero
FROM stock_movement sm JOIN product p ON p.id=sm.product_id
WHERE p.shop_id=$1 AND sm.quantity_after = 0
  AND sm.created_at >= now() - interval '90 days'
GROUP BY 1 ORDER BY 2 DESC;
```

A product with excellent turnover and frequent zero-stock days is losing sales,
not performing well.

### GMROI ties it to profit

Turnover says how fast; GMROI says whether it was worth it.

```
GMROI = Gross profit ÷ Average inventory at cost
```

A GMROI below 1 means the category earns less gross profit than the capital tied
up in it. High turnover at negligible margin can still be a poor use of cash —
GMROI catches that where turnover alone does not.

### Caveats

- Both sides must be at cost
- Average inventory, not closing balance, where history allows
- Seasonal businesses need a full year, or a season-matched comparison
- Products stocked for part of the period distort the average
- Missing cost data invalidates the ratio — count and disclose
- Turnover means nothing without stockout context

### Checklist

- [ ] COGS and inventory both valued at cost
- [ ] Average inventory used where movement history exists
- [ ] Approximation disclosed where it is not
- [ ] Turnover and days of supply both reported
- [ ] Compared to the category's own history, not across categories
- [ ] Product-level extremes surfaced at both ends
- [ ] Stockout frequency reported alongside turnover
- [ ] GMROI computed to connect speed to profit
- [ ] Missing cost data counted and disclosed
- [ ] Recommendation tied to a purchasing or capital decision

## References

- **National Retail Federation — inventory turnover and GMROI definitions**
  <https://nrf.com/research>
- **APICS / ASCM Dictionary** — inventory turnover and days-of-supply
  terminology
- **IAS 2 — Inventories** — cost basis for COGS and inventory valuation
  <https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/>

**Not sourced — written for this framework:** the SQL patterns, the
average-versus-closing-inventory warning, the compare-within-category rule, and
the turnover-without-stockout-context caveat.
