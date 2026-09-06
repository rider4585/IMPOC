---
name: stock-aging
version: 1.0.0
description: |
  Analyse how long stock has been held and how close it is to expiry — aging
  buckets, batch tracking, FEFO, and markdown timing. Use when managing
  perishables, planning clearance, before a stock take, or when asked "what's
  about to expire" or "how old is our stock".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Stock Aging

Two related questions: **how long has this been here**, and **how long can it
stay**. For perishables the second dominates; for general merchandise the first
is a proxy for the risk of becoming dead stock.

> **Before running anything:** load `project-database` and
> `project-inventory-rules` — specifically whether batch and expiry tracking
> exists, and which batch selection strategy is used. Without batch data, aging
> can only be estimated.

### Expiry first, where it applies

```sql
SELECT p.name, b.batch_code,
       b.quantity, b.expires_at::date,
       (b.expires_at::date - now()::date)              AS days_remaining,
       round(b.quantity * p.cost_price / 100.0, 2)     AS value_at_risk,
       CASE WHEN b.expires_at < now()                     THEN 'EXPIRED'
            WHEN b.expires_at < now() + interval '7 days' THEN 'CRITICAL'
            WHEN b.expires_at < now() + interval '30 days' THEN 'WARNING'
            ELSE 'ok' END                              AS status
FROM stock_batch b
JOIN product p ON p.id = b.product_id
WHERE p.shop_id = $1 AND b.quantity > 0
ORDER BY b.expires_at;
```

**Expired stock on the shelf is a compliance and safety issue, not a commercial
one.** Surface it immediately and separately from the aging report — it needs
removal today, not a markdown decision.

### FEFO — first expired, first out

Where expiry exists, batch selection at sale must be **first expired, first out**,
not first in. Confirm from `project-inventory-rules` which the system implements.

If the system sells the newest batch first, the oldest will always expire — a
structural defect, and worth reporting as one.

```sql
-- Products where an older batch is still held while a newer one exists
SELECT p.name, count(*) AS batches,
       min(b.expires_at)::date AS oldest, max(b.expires_at)::date AS newest
FROM stock_batch b JOIN product p ON p.id = b.product_id
WHERE p.shop_id=$1 AND b.quantity > 0
GROUP BY 1 HAVING count(*) > 1
ORDER BY oldest;
```

### Aging buckets for non-perishables

Where there is no expiry, age from receipt.

```sql
WITH receipts AS (
  SELECT sm.product_id, sm.created_at, sm.quantity
  FROM stock_movement sm
  WHERE sm.type = 'receipt' AND sm.quantity > 0
)
SELECT p.name,
       sum(r.quantity) FILTER (WHERE r.created_at >= now() - interval '30 days')  AS age_0_30,
       sum(r.quantity) FILTER (WHERE r.created_at <  now() - interval '30 days'
                                 AND r.created_at >= now() - interval '90 days')  AS age_31_90,
       sum(r.quantity) FILTER (WHERE r.created_at <  now() - interval '90 days'
                                 AND r.created_at >= now() - interval '180 days') AS age_91_180,
       sum(r.quantity) FILTER (WHERE r.created_at <  now() - interval '180 days') AS age_180_plus,
       round(sum(r.quantity) FILTER (WHERE r.created_at < now() - interval '180 days')
             * p.cost_price / 100.0, 2)                                           AS old_stock_value
FROM product p JOIN receipts r ON r.product_id = p.id
WHERE p.shop_id = $1
GROUP BY p.name, p.cost_price
HAVING sum(r.quantity) FILTER (WHERE r.created_at < now() - interval '180 days') > 0
ORDER BY old_stock_value DESC;
```

Without batch tracking this is an **approximation** — it assumes stock sells in
the order received, which FIFO systems approximate and others do not. Say so.

The aggregate aging profile is the useful summary:

```
0–30 days    ₹2.1L   62%
31–90 days   ₹0.8L   24%
91–180 days  ₹0.3L    9%
180+ days    ₹0.2L    5%   ← the number to watch
```

A rising 180+ share means purchasing is outrunning sales.

### Markdown timing

For anything with a shelf life, the decision is **when to discount**, not
whether. Discount too early and margin is given away needlessly; too late and the
stock is worthless.

| Time remaining | Typical action |
|---|---|
| > 50% of shelf life | Sell normally |
| 25–50% | Promote; improve placement |
| 10–25% | Markdown; bundle |
| < 10% | Deep markdown to clear |
| Expired | Remove and write off — not a markdown decision |

Percentages should be tuned per category and agreed with the owner. Record the
outcome: whether the markdown actually cleared the stock is the feedback that
improves the next decision.

Track whether markdowns recover cost:

```sql
SELECT p.name, sum(l.quantity) AS units_cleared,
       round(sum(l.quantity * (l.unit_price - l.discount/nullif(l.quantity,0) - l.cost_price))/100.0, 2) AS margin_on_clearance
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id
WHERE s.shop_id=$1 AND l.discount > 0 AND s.sold_at >= now() - interval '90 days'
GROUP BY 1 HAVING sum(l.quantity * (l.unit_price - l.discount/nullif(l.quantity,0) - l.cost_price)) < 0
ORDER BY margin_on_clearance;
```

Clearance below cost is sometimes correct — recovering something beats nothing —
but it should be a visible, deliberate decision, not a surprise.

### Feed it back to purchasing

Repeated aging in a category is a buying problem:

- Over-ordering relative to sell-through
- Supplier minimums forcing excess
- Seasonal stock arriving late
- Shelf life too short for the order quantity

Report the pattern, not just the instances — see `reorder-analysis`.

### Caveats

- Aging without batch tracking is an approximation; state it
- FEFO must be verified, not assumed
- Received-date aging assumes orderly consumption
- Stock adjustments and transfers can distort receipt-based aging
- Expiry data is only as good as its entry — spot-check against physical stock

### Checklist

- [ ] Batch and expiry tracking availability confirmed
- [ ] Expired stock surfaced separately and urgently
- [ ] FEFO selection verified; violations reported as a defect
- [ ] Aging buckets produced, with approximation disclosed if unbatched
- [ ] Aggregate aging profile reported, with the oldest bucket highlighted
- [ ] Value at risk quantified, not just unit counts
- [ ] Markdown timing tied to remaining shelf life
- [ ] Clearance outcomes tracked, including below-cost sales
- [ ] Recurring aging fed back to purchasing
- [ ] Expiry data quality spot-checked

## References

- **IAS 2 — Inventories** — net realisable value and writing down aged stock
  <https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/>
- **GS1 General Specifications** — batch/lot identification and expiry data
  <https://www.gs1.org/standards/barcodes-epcrfid-id-keys/gs1-general-specifications>
- **APICS / ASCM Dictionary** — FEFO, FIFO, and inventory aging terminology
- **PostgreSQL 16 documentation — `FILTER` and interval arithmetic**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the SQL patterns, the aging bucket
scheme, the markdown timing table, the FEFO-violation finding, and the
purchasing feedback loop.
