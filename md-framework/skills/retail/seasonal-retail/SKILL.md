---
name: seasonal-retail
version: 1.0.0
description: |
  Run the shop through a seasonal cycle — range changes, cash planning, staffing,
  space, and the exit from a season. Use when preparing for a peak or a quiet
  period, planning the annual cycle, or when asked "how should we handle the
  season".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Seasonal Retail

The operational side of seasonality. `seasonal-analysis` measures the pattern and
`seasonal-campaigns` promotes into it; this covers **running the shop** through
the cycle — range, cash, space, and people.

> **Before planning:** load `seasonal-analysis` for this shop's own pattern and
> `project-roadmap` for the local calendar. Dates move year to year; confirm them.

### Cash is the binding constraint

Seasonal stock is bought weeks before it sells. For a small shop this is usually
the real limit — not shelf space, not demand.

```
6 weeks out   Order placed        — cash committed
4 weeks out   Stock arrives       — cash fully tied up
2 weeks out   Demand ramps
Peak          Stock converts to cash
2 weeks after Leftovers marked down
```

Plan the cash trough, not just the peak. A shop can have an excellent season and
still be unable to pay a supplier in week three because everything is on the
shelf.

```sql
-- What did the same period cost last year in stock terms?
SELECT round(sum(l.quantity * l.cost_price)/100.0, 2) AS cogs_same_period_last_year
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE s.shop_id=$1
  AND s.sold_at BETWEEN $2::date - interval '1 year' AND $3::date - interval '1 year';
```

Use it as the baseline for how much cash the season will absorb, adjusted for
growth.

### Range: what comes in and what goes out

A season is not only additions. Space is finite, so something must move.

- **Bring in** seasonal lines ahead of the ramp
- **Reduce facings** on lines that go quiet in this season, rather than delisting
- **Do not delist a staple** to make room — regulars will notice and go elsewhere
  for it, and may not come back
- **Return or store** the displaced stock deliberately

```sql
-- Which lines go quiet in this season? Reduce their space, do not remove them
SELECT p.name,
       sum(l.quantity) FILTER (WHERE extract(month FROM s.sold_at) = ANY($2)) AS units_in_season,
       sum(l.quantity) AS units_year
FROM product p JOIN sale_line l ON l.product_id=p.id
JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE p.shop_id=$1 AND s.sold_at >= now()-interval '2 years'
GROUP BY 1 ORDER BY (sum(l.quantity) FILTER (WHERE extract(month FROM s.sold_at)=ANY($2)))::numeric
                    / nullif(sum(l.quantity),0);
```

### Stock levels must move with the season

Reorder points calculated on off-season demand will stock out in week one.

- **Raise reorder points and safety stock before the ramp**, not during it
- **Lower them after the peak**, or the season ends with excess
- Shorten the review cycle during a peak — check daily rather than weekly
- Use last year's same-period demand as the baseline — see `reorder-analysis`

### Staffing and hours

```sql
SELECT extract(dow FROM sold_at) AS dow, extract(hour FROM sold_at) AS hour,
       count(*) AS transactions
FROM sale WHERE status='completed' AND shop_id=$1
  AND sold_at BETWEEN $2::date - interval '1 year' AND $3::date - interval '1 year'
GROUP BY 1,2 ORDER BY 3 DESC;
```

Staff to last year's peak-period hourly pattern, not to an average week. Consider
extended hours only where the data supports it — an extra hour that takes a
handful of transactions costs more in wages than it earns.

Schedule deliveries and stock work **outside** peak trading hours. A delivery
blocking the aisle at the busiest hour of the year is an avoidable loss.

### Plan the exit before the season starts

The decision that separates a good season from a costly one.

| Decide in advance | Why |
|---|---|
| Markdown start date | Waiting too long leaves unsellable stock |
| Markdown ladder | Ad hoc discounting gives away more than needed |
| Return terms with the supplier | **Check before ordering**, not after |
| Storage until next year | Only if it keeps and storage is free |
| Write-off threshold | So the decision is not made emotionally |

**Order quantities should reflect the exit.** If leftovers are unreturnable and do
not keep, order conservatively — a small stockout costs less than a large
write-off. See `dead-stock` and `stock-aging`.

### The quiet period is not wasted

Off-season is when the work that cannot be done in a peak gets done:

- Stock take and reconciliation — see `data-integrity`
- Range review and delisting — see `product-performance`
- Clearing dead stock while there is time to do it well
- Staff training
- Maintenance, layout changes, and system work
- Planning the next peak

A shop that only reacts during peaks never improves between them.

### Record what happened

The single highest-return habit in seasonal retail. After each season:

- Units sold versus ordered, by line
- What ran out, and when
- What was left, and what it cost to clear
- What staffing was actually needed
- What you would change

That record is what makes next year's plan good. Without it, every season starts
from memory — see `campaign-analysis`.

### Caveats

- Two years of history minimum to plan confidently
- Moving festival dates shift the peak between months
- Weather-driven seasons are less predictable than calendar ones
- Growth means last year's volumes are a floor, not a target
- A new competitor changes the baseline entirely

### Checklist

- [ ] Shop's own seasonal pattern used; dates confirmed for this year
- [ ] Cash trough planned, not just the sales peak
- [ ] Range additions and reductions planned; staples protected
- [ ] Reorder points raised before the ramp and lowered after
- [ ] Review cycle shortened during the peak
- [ ] Staffing matched to last year's hourly pattern
- [ ] Deliveries scheduled outside peak hours
- [ ] Exit planned before ordering — markdown, returns, storage, write-off
- [ ] Order quantity reflects the cost of leftovers
- [ ] Off-season work planned
- [ ] Season outcome recorded for next year

## References

- **National Retail Federation — seasonal planning and inventory management**
  <https://nrf.com/research>
- **APICS / ASCM Dictionary** — seasonal demand planning, safety stock
  adjustment
- **IAS 2 — Inventories** — valuation of leftover seasonal stock
  <https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/>

**Not sourced — written for this framework:** the cash-trough timeline, the
protect-the-staples rule, the exit-planning table, the off-season work list, and
the season-record habit.
