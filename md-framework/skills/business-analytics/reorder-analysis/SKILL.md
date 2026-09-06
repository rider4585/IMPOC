---
name: reorder-analysis
version: 1.0.0
description: |
  Decide what to reorder, when, and how much — reorder points, safety stock,
  order quantity, and lead time. Use when planning purchasing, when stockouts or
  overstock recur, or when asked "what should I order".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Reorder Analysis

Two errors, both expensive: ordering too late (lost sales, disappointed
customers) and ordering too much (trapped cash, eventual dead stock). Reorder
analysis is the balance between them.

> **Before running anything:** load `project-database` and
> `project-inventory-rules`. Lead times and supplier minimums usually live
> outside the system — confirm them with the owner and record them.

### The reorder point

```
Reorder point = (Average daily sales × Lead time in days) + Safety stock
```

Order when stock falls to this level — not when it hits zero, and not on a fixed
calendar.

```sql
WITH demand AS (
  SELECT p.id, p.name,
         sum(l.quantity)                     AS units_90d,
         sum(l.quantity) / 90.0              AS avg_daily,
         stddev_samp(daily.qty)              AS daily_stddev
  FROM product p
  JOIN sale_line l ON l.product_id = p.id
  JOIN sale s ON s.id = l.sale_id AND s.status='completed'
             AND s.sold_at >= now() - interval '90 days'
  LEFT JOIN LATERAL (
    SELECT date_trunc('day', s2.sold_at) AS d, sum(l2.quantity) AS qty
    FROM sale_line l2 JOIN sale s2 ON s2.id=l2.sale_id AND s2.status='completed'
    WHERE l2.product_id = p.id AND s2.sold_at >= now() - interval '90 days'
    GROUP BY 1) daily ON true
  WHERE p.shop_id = $1
  GROUP BY p.id, p.name
)
SELECT d.name,
       round(d.avg_daily, 2)                                        AS avg_daily_sales,
       coalesce(st.quantity, 0)                                     AS stock_now,
       p.lead_time_days,
       ceil(d.avg_daily * p.lead_time_days)                         AS lead_time_demand,
       ceil(1.65 * coalesce(d.daily_stddev,0) * sqrt(p.lead_time_days)) AS safety_stock,
       ceil(d.avg_daily * p.lead_time_days
            + 1.65 * coalesce(d.daily_stddev,0) * sqrt(p.lead_time_days)) AS reorder_point,
       CASE WHEN coalesce(st.quantity,0) <=
                 d.avg_daily * p.lead_time_days
                 + 1.65 * coalesce(d.daily_stddev,0) * sqrt(p.lead_time_days)
            THEN 'ORDER NOW' ELSE 'ok' END AS status
FROM demand d
JOIN product p ON p.id = d.id
LEFT JOIN stock st ON st.product_id = d.id
ORDER BY status DESC, d.avg_daily DESC;
```

### Safety stock buys service level

Safety stock covers variability — demand that spikes, or a delivery that slips.
The multiplier sets the service level:

| Multiplier | Approximate service level | Use for |
|---|---|---|
| 1.28 | 90% | Ordinary lines |
| 1.65 | 95% | Most products — a sensible default |
| 2.33 | 99% | Fast movers, staples, anything customers expect |

Higher service costs capital. **Set it by product importance, not uniformly** —
99% on every line ties up cash in items nobody misses.

Where demand history is too thin for a standard deviation, use a simple rule
(e.g. half of lead-time demand) and say that it is a heuristic.

### Lead time is the input people get wrong

Lead time is not the supplier's promise — it is the **observed** time from order
to shelf, including delays, and it should include the time to actually place the
order.

Track it rather than assuming:

```sql
SELECT s.name AS supplier,
       round(avg(po.received_at::date - po.ordered_at::date), 1) AS avg_lead_days,
       max(po.received_at::date - po.ordered_at::date)           AS worst_lead_days,
       count(*)                                                  AS orders
FROM purchase_order po JOIN supplier s ON s.id = po.supplier_id
WHERE po.received_at IS NOT NULL AND po.ordered_at >= now() - interval '365 days'
GROUP BY 1 ORDER BY avg_lead_days DESC;
```

**Use the worst realistic lead time, not the average**, for anything you cannot
afford to run out of. An average lead time produces a stockout roughly half the
time.

### How much to order

The theoretical answer is the economic order quantity — the point where ordering
cost and holding cost balance:

```
EOQ = √( (2 × Annual demand × Cost per order) ÷ Annual holding cost per unit )
```

In a small shop this is usually not the binding constraint. Practical reality
dominates:

- **Supplier minimum order quantity** — often decides it outright
- **Pack and case sizes** — you cannot order 7 of a 12-pack
- **Shelf and storage space**
- **Cash available now** — the real constraint most weeks
- **Expiry or seasonality** — never order more than can sell in the window

Compute EOQ if the inputs exist, then reconcile it with these. Where they
conflict, the practical constraint wins and should be stated.

### Consolidate orders by supplier

Ordering one line at a time wastes delivery charges and effort.

```sql
SELECT sup.name AS supplier, count(*) AS lines_due,
       round(sum(ceil(d.avg_daily * p.lead_time_days) * p.cost_price)/100.0, 2) AS est_order_value
FROM product p JOIN supplier sup ON sup.id = p.supplier_id
JOIN (…demand CTE…) d ON d.id = p.id
LEFT JOIN stock st ON st.product_id = p.id
WHERE p.shop_id=$1 AND coalesce(st.quantity,0) <= d.avg_daily * p.lead_time_days
GROUP BY 1 ORDER BY lines_due DESC;
```

Where a supplier has a free-delivery threshold, adding a near-due line to reach it
is usually worth it — and this is exactly the kind of practical recommendation a
shop owner acts on.

### Adjust for what the average hides

- **Seasonality** — reorder points must rise ahead of a season, not during it.
  See `seasonal-analysis`
- **Trend** — an accelerating product will stock out at a point calculated from
  its past rate
- **Promotions** — a planned promotion needs stock ordered ahead of it
- **New products** — no history; order conservatively and re-measure

### Caveats

- Demand history distorted by past stockouts understates true demand
- Very low-volume products produce meaningless statistics — use judgement
- Lead times must be observed, not assumed
- Cash constraints may override the mathematically correct order
- Supplier minimums frequently dominate the calculation

### Checklist

- [ ] Reorder point computed per product, not a blanket rule
- [ ] Safety stock set by product importance, service level stated
- [ ] Lead times measured from history, worst case used for critical lines
- [ ] Order quantity reconciled with minimums, pack sizes, space, and cash
- [ ] Orders consolidated by supplier
- [ ] Seasonality and trend adjustments applied
- [ ] Promotions accounted for ahead of time
- [ ] Past stockouts flagged as understating demand
- [ ] Low-volume products handled by judgement, not formula
- [ ] Output is an actionable order list, not a table of statistics

## References

- **APICS / ASCM Dictionary** — reorder point, safety stock, economic order
  quantity, and lead time definitions
- **Standard inventory management formulations** — the EOQ (Wilson) formula and
  service-level safety-stock multipliers from the normal distribution
- **National Retail Federation — inventory management metrics**
  <https://nrf.com/research>
- **PostgreSQL 16 documentation — `stddev_samp`, `LATERAL`**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the SQL patterns, the
practical-constraints-override-EOQ guidance, the worst-case lead time rule, the
supplier consolidation recommendation, and the past-stockout caveat.
