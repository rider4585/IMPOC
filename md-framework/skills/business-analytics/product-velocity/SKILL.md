---
name: product-velocity
version: 1.0.0
description: |
  Classify products by how fast they sell — fast-moving, steady, and slow-moving —
  and act on each band. Use when planning purchasing, allocating shelf space,
  reviewing the range, or when asked "what's selling fast" or "what's barely
  moving".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Product Velocity

Velocity is the rate a product sells. Fast and slow are the same measurement read
from opposite ends, so they belong in one analysis — the bands sit on a single
scale.

> **Before running anything:** load `project-database` and
> `project-inventory-rules`. Velocity conclusions are invalid without checking
> stock availability first — see the caveat below.

### Measure rate, not total

Total units favours products that have been listed longer. Use **units per day
while available**.

```sql
WITH velocity AS (
  SELECT p.id, p.name, p.sku,
         sum(l.quantity)                                     AS units_90d,
         round(sum(l.quantity) / 90.0, 3)                    AS units_per_day,
         count(DISTINCT date_trunc('day', s.sold_at))        AS days_with_a_sale,
         max(s.sold_at)                                      AS last_sold,
         coalesce(st.quantity, 0)                            AS stock_now
  FROM product p
  LEFT JOIN stock st ON st.product_id = p.id
  LEFT JOIN sale_line l ON l.product_id = p.id
  LEFT JOIN sale s ON s.id = l.sale_id AND s.status = 'completed'
                  AND s.sold_at >= now() - interval '90 days'
  WHERE p.shop_id = $1 AND p.is_active
  GROUP BY p.id, p.name, p.sku, st.quantity
)
SELECT *,
       round(stock_now / nullif(units_per_day, 0), 0) AS days_of_supply,
       ntile(5) OVER (ORDER BY units_per_day DESC NULLS LAST) AS velocity_quintile
FROM velocity
ORDER BY units_per_day DESC NULLS LAST;
```

`days_with_a_sale` matters as much as the rate: a product selling 90 units across
3 days is a bulk purchase, not a fast mover. **Regularity and rate together**
describe velocity properly.

### The bands and what to do

| Band | Characteristic | Action |
|---|---|---|
| **Fast** (top quintile) | Sells most days, high rate | Never out of stock. Prime shelf position. Review reorder point upward |
| **Steady** | Regular, moderate | Normal management |
| **Slow** | Infrequent, low rate | Reduce order quantity, not necessarily delist |
| **Stagnant** | No sale in 90 days, stock held | Candidate for clearance — see `dead-stock` |

**Slow is not the same as bad.** A slow high-margin item that customers expect
you to carry may be worth its shelf. Cross velocity with margin before deciding —
see `product-performance`.

### Fast movers: the risk is stockouts

```sql
-- Top velocity products currently at risk
SELECT p.name, coalesce(st.quantity,0) AS stock_now,
       round(sum(l.quantity)/90.0, 2)  AS units_per_day,
       round(coalesce(st.quantity,0) / nullif(sum(l.quantity)/90.0,0), 1) AS days_left
FROM product p
JOIN sale_line l ON l.product_id=p.id
JOIN sale s ON s.id=l.sale_id AND s.status='completed' AND s.sold_at >= now() - interval '90 days'
LEFT JOIN stock st ON st.product_id=p.id
WHERE p.shop_id=$1 AND p.is_active
GROUP BY p.name, st.quantity
HAVING coalesce(st.quantity,0) / nullif(sum(l.quantity)/90.0,0) < 7
ORDER BY units_per_day DESC;
```

A stockout on a fast mover costs more than any slow-moving item on the shelf —
the sale is lost, and sometimes the customer with it. This query is the single
most actionable output of the skill.

### Slow movers: check the cause before acting

Low velocity has several causes with different responses:

| Cause | Evidence | Response |
|---|---|---|
| **Was out of stock** | Zero-stock days in the period | Not slow — restock and re-measure |
| **Poorly placed** | Sells elsewhere, not here | Move it before delisting |
| **Priced wrong** | Competitor comparison | Reprice |
| **Seasonal** | Sold well in a prior season | Judge in season only |
| **New** | Listed recently | Give it a full trial period |
| **Genuinely unwanted** | Available, visible, priced, still not selling | Clear it |

**Never call a product slow-moving without checking availability.** A product
that was out of stock for six of the last twelve weeks did not fail to sell; it
was not there to sell.

```sql
SELECT p.name, count(*) FILTER (WHERE sm.quantity_after = 0) AS zero_stock_events
FROM product p JOIN stock_movement sm ON sm.product_id = p.id
WHERE p.shop_id=$1 AND sm.created_at >= now() - interval '90 days'
GROUP BY 1 ORDER BY 2 DESC;
```

### Velocity changes are the signal

A product's own trend is more informative than its rank.

```sql
SELECT p.name,
       round(sum(l.quantity) FILTER (WHERE s.sold_at >= now() - interval '30 days')/30.0, 3)  AS rate_recent,
       round(sum(l.quantity) FILTER (WHERE s.sold_at >= now() - interval '120 days'
                                       AND s.sold_at <  now() - interval '30 days')/90.0, 3)  AS rate_prior
FROM product p
JOIN sale_line l ON l.product_id=p.id
JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE p.shop_id=$1 GROUP BY 1
ORDER BY (coalesce(rate_recent,0) - coalesce(rate_prior,0)) DESC;
```

Accelerating products need stock ahead of demand; decelerating ones need
investigation before the stock becomes dead.

### Caveats

- Availability checked before any slow-moving conclusion
- Seasonal products judged in season
- New products given a stated trial period
- Bulk one-off purchases distort rate — check `days_with_a_sale`
- Promotions inflate the period they ran in
- Very low-volume shops produce noisy quintiles; use absolute thresholds instead

### Checklist

- [ ] Rate measured per day, not total units
- [ ] Regularity (`days_with_a_sale`) reported alongside rate
- [ ] Bands assigned and actions stated per band
- [ ] Fast movers at risk of stockout surfaced
- [ ] Zero-stock history checked before calling anything slow
- [ ] Cause diagnosed for slow movers before recommending action
- [ ] Velocity trend computed, not just the current rank
- [ ] Seasonality and new listings accounted for
- [ ] Cross-referenced with margin before delisting recommendations

## References

- **APICS / ASCM Dictionary** — velocity, days of supply, and ABC/movement
  classification terminology
- **National Retail Federation — inventory performance metrics**
  <https://nrf.com/research>
- **PostgreSQL 16 documentation — `ntile` and `FILTER`**
  <https://www.postgresql.org/docs/16/functions-window.html>

**Not sourced — written for this framework:** the SQL patterns, the band-to-action
table, the cause-diagnosis table for slow movers, and the rule that availability
must be checked before any slow-moving conclusion.
