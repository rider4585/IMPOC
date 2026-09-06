---
name: seasonal-campaigns
version: 1.0.0
description: |
  Plan campaigns around seasons, festivals, and local events — timing, stock
  readiness, and the exit. Use when preparing for a known peak, building an
  annual promotional calendar, or when asked "what should we do for the
  festival".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Seasonal Campaigns

Seasonal trade is the easiest money a shop makes and the easiest to get wrong.
The demand already exists — the campaign's job is to capture it, which mostly
means **being ready before it arrives**.

> **Before planning:** load `seasonal-analysis` for the shop's actual patterns
> and `project-roadmap` for the local calendar. Generic seasonal advice is worth
> little; this shop's own history is worth a great deal.

### Timing is the whole discipline

The commonest seasonal failure is not a bad offer — it is stock arriving as the
season ends.

```
Lead time (order → shelf)        14 days
Ramp-up before peak               7 days
Preparation (pricing, signage)    3 days
─────────────────────────────────────────
Start planning at least          24 days before the peak
```

Work backwards from the peak, not forwards from today. Build the annual calendar
once, with each event's decision date, and the ordering deadline stops being a
surprise.

```sql
-- When does this category actually peak?
SELECT extract(month FROM s.sold_at) AS month,
       round(sum(l.quantity*l.unit_price - l.discount)/100.0, 2) AS revenue,
       round(sum(l.quantity*l.unit_price - l.discount)
             / avg(sum(l.quantity*l.unit_price - l.discount)) OVER (), 2) AS seasonal_index
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id
WHERE p.category_id=$2 AND s.shop_id=$1 AND s.sold_at >= now() - interval '3 years'
GROUP BY 1 ORDER BY 1;
```

Note the **ramp**, not just the peak month. Demand usually rises for a week or two
beforehand, and that is when stock must already be on the shelf.

### The local calendar matters more than the generic one

Festivals, harvest, school terms, paydays, and weather drive small-shop trade far
more than any generic retail calendar. Several move date year to year, which
shifts the peak between months.

Collect these from the owner, record them, and check dates annually rather than
assuming last year's timing. Salary cycles in particular produce a strong monthly
rhythm worth planning around.

### Stock is the campaign

For a seasonal peak, availability outperforms any offer. A discount on an empty
shelf is worthless.

```sql
-- Last year's peak-period demand, as this year's planning baseline
SELECT p.name,
       sum(l.quantity) AS units_same_period_last_year,
       coalesce(st.quantity, 0) AS stock_now
FROM product p
LEFT JOIN sale_line l ON l.product_id=p.id
LEFT JOIN sale s ON s.id=l.sale_id AND s.status='completed'
                AND s.sold_at BETWEEN $2::date - interval '1 year' AND $3::date - interval '1 year'
LEFT JOIN stock st ON st.product_id=p.id
WHERE p.shop_id=$1 AND p.category_id = ANY($4)
GROUP BY p.name, st.quantity ORDER BY units_same_period_last_year DESC NULLS LAST;
```

Raise reorder points **before** the ramp and lower them after — see
`reorder-analysis`. A reorder point calculated on off-season demand will stock out
in week one of the season.

### Do not discount into a peak

Demand is already high. Discounting during a peak gives away margin on sales that
would have happened anyway — the clearest case of subsidising base sales.

| Phase | Right move |
|---|---|
| **Before the peak** | Build awareness; secure stock; take pre-orders |
| **During the peak** | Full price, maximum availability, fast service |
| **After the peak** | Clear leftover seasonal stock — this is when to discount |

The campaign before a peak should be about **presence and readiness**, not price.
Save the discount for the exit.

### Plan the exit before the season starts

Seasonal stock that does not sell in season is dead stock with a long wait until
it is relevant again — and some of it never is.

Decide in advance:

- What happens to unsold stock, and on what date the markdown begins
- Whether it can be returned to the supplier — check terms **before** ordering
- Whether it stores acceptably until next year, and at what cost
- The markdown ladder and its timing — see `stock-aging`

**Order quantities should reflect the exit.** If leftover stock is unreturnable
and does not keep, order conservatively — the cost of a small stockout is usually
less than the cost of a large write-off.

### Staffing and operations are part of it

A peak that sells out but takes forever at the till loses customers. Plan:

- Staffing to the hourly pattern of the peak — see `seasonal-analysis`
- Extended hours, if the data supports it
- Deliveries scheduled outside peak trading hours
- Till capacity and queue management

### Measure it against last year, not against a normal month

```sql
SELECT round(sum(total) FILTER (WHERE sold_at BETWEEN $2 AND $3)/100.0, 2) AS this_year,
       round(sum(total) FILTER (WHERE sold_at BETWEEN $2::date - interval '1 year'
                                              AND $3::date - interval '1 year')/100.0, 2) AS last_year
FROM sale WHERE status='completed' AND shop_id=$1;
```

Every seasonal campaign looks successful against an average month. The only
meaningful comparison is the same event last year, adjusted for any date shift.

Record what happened: units sold, stockouts, leftover stock, and what you would
change. That record is what makes next year's plan good — see
`campaign-analysis`.

### Checklist

- [ ] Shop's own seasonal pattern used, not generic advice
- [ ] Local calendar collected and dates confirmed for this year
- [ ] Planning started from lead time plus ramp, working backwards
- [ ] Stock ordered ahead, sized from last year's same-period demand
- [ ] Reorder points raised before the ramp, lowered after
- [ ] No discounting into the peak
- [ ] Pre-peak activity focused on awareness and availability
- [ ] Exit planned before ordering — markdown date, returns, storage
- [ ] Order quantity reflects the cost of leftover stock
- [ ] Staffing and operations planned for peak hours
- [ ] Measured against the same event last year
- [ ] Outcome recorded for next year's plan

## References

- **National Retail Federation — seasonal planning and comparable-period
  reporting** <https://nrf.com/research>
- **APICS / ASCM Dictionary** — seasonal demand planning and lead-time
  terminology
- **Rob Hyndman & George Athanasopoulos, _Forecasting: Principles and
  Practice_** — seasonal indices and ramp identification
  <https://otexts.com/fpp3/>

**Not sourced — written for this framework:** the backwards-timing calculation,
the phase table with no-discounting-into-a-peak, the plan-the-exit-before-ordering
rule, and the same-event-last-year measurement requirement.
