---
name: offer-strategy
version: 1.0.0
description: |
  Choose the right offer mechanic for an objective — bundles, thresholds,
  multibuys, and value-adds — and cost each one against margin. Use when
  designing a promotion, when discounts are eroding profit, or when asked "what
  offer should we run".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Offer Strategy

The mechanic matters more than the size. A well-chosen offer achieves the
objective while protecting margin; a blanket percentage discount usually just
gives money to people who were going to buy anyway.

> **Before designing:** load `project-pricing-rules` — how discounts stack,
> whether a floor prevents selling below cost, and how rounding works. An offer
> that interacts badly with existing promotion rules can produce prices nobody
> intended.

### Match the mechanic to the objective

| Objective | Mechanic | Why it fits |
|---|---|---|
| Clear specific stock | Deep discount on that line, or bundle it with a fast mover | Targeted; does not touch other prices |
| Raise basket value | **Threshold** — "spend ₹500, get X" | Only pays out on incremental spend |
| Increase units per purchase | **Multibuy** — 2-for, 3-for | Pays only when they buy more |
| Drive trial | Small discount or sample on the new line | Cheap; the aim is the second purchase |
| Reward loyalty | Points, or member-only price | No cost until earned |
| Reactivate lapsed | Personal, time-limited offer | Narrow audience, high relevance |
| Compete on a known line | Match on that line only | Protects the rest of the range |

**Thresholds and multibuys are structurally better than percentage-off**, because
they only cost margin when the customer does the thing you wanted.

### Cost every offer before running it

```
Margin now                32%
Offer                     20% off
Margin after              12%
Break-even volume uplift  = current margin ÷ new margin = 32/12 ≈ 2.7×
```

**A 20% discount on a 32% margin needs nearly triple the volume just to stand
still.** Computing this before committing prevents most bad promotions.

```sql
-- Current margin on candidate products
SELECT p.name,
       round(100.0 * sum(l.quantity*(l.unit_price - l.cost_price) - l.discount)
             / nullif(sum(l.quantity*l.unit_price - l.discount),0), 1) AS margin_pct,
       sum(l.quantity) AS units_90d,
       coalesce(st.quantity,0) AS stock_now
FROM product p
JOIN sale_line l ON l.product_id=p.id
JOIN sale s ON s.id=l.sale_id AND s.status='completed' AND s.sold_at >= now()-interval '90 days'
LEFT JOIN stock st ON st.product_id=p.id
WHERE p.id = ANY($1) GROUP BY p.name, st.quantity;
```

**Never design an offer on a product whose margin you have not checked.** Low
-margin lines cannot absorb a discount, and an offer on one can sell at a loss.

### Bundles: use margin, not price, to build them

Pair a high-margin item with a slower one, so the bundle margin stays acceptable
while the customer sees a saving.

```sql
-- Candidates: products already bought together, with combined margin
SELECT a.name, b.name,
       count(*) AS baskets_together,
       round(100.0*( (a.unit_price-a.cost_price) + (b.unit_price-b.cost_price) )
             / nullif(a.unit_price + b.unit_price,0), 1) AS combined_margin_pct
FROM sale_line la
JOIN sale_line lb ON lb.sale_id=la.sale_id AND lb.product_id > la.product_id
JOIN sale s ON s.id=la.sale_id AND s.status='completed' AND s.sold_at >= now()-interval '180 days'
JOIN product a ON a.id=la.product_id JOIN product b ON b.id=lb.product_id
WHERE s.shop_id=$1 GROUP BY a.name,b.name,a.unit_price,a.cost_price,b.unit_price,b.cost_price
HAVING count(*) >= 20 ORDER BY combined_margin_pct DESC;
```

Bundling things already bought together is efficient but may not be incremental —
you may be discounting a basket that would have happened. Bundling a slow mover
with a fast one is more likely to shift stock that needed shifting.

### Set the threshold above the current basket

A threshold offer only works if it asks for more than customers already spend.

```sql
SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY total)/100.0, 2) AS median_basket,
       round(percentile_cont(0.75) WITHIN GROUP (ORDER BY total)/100.0, 2) AS p75_basket
FROM sale WHERE status='completed' AND shop_id=$1 AND sold_at >= now()-interval '90 days';
```

Set the threshold somewhere around the 70th–80th percentile: reachable enough to
motivate, high enough that most customers must add something. A threshold below
the median simply discounts existing behaviour.

### Protect margin structurally

- **A cost floor** — no offer may take a line below cost. Enforce it in the
  system, not by policy (see `constraints`)
- **Non-stacking by default** — decide explicitly whether offers combine; stacked
  offers are how a 20% promotion becomes 60% off
- **Time-bounded** — every offer has an end date, enforced
- **Exclusions stated up front** — clearer for customers and staff
- **Cap the exposure** where the mechanic is open-ended

### Do not train customers to wait

The most expensive long-term risk. A shop that discounts the same category every
month teaches its customers never to pay full price for it.

- Vary the mechanic and the timing
- Avoid a predictable monthly cycle
- Prefer targeted, personal offers over shop-wide ones
- Use value-adds instead of price cuts where possible

### Value-add alternatives to discounting

Often more effective per rupee, and they do not erode the reference price:

- Free delivery above a threshold
- A free small item with a purchase
- Extended returns or a guarantee
- Early access for regulars
- Bundled service — installation, gift wrap, assembly

These cost less than their perceived value, which is exactly what a good offer
should do.

### Approval

Any offer changing price, discount, or margin is a **financial decision**
requiring human approval — see `campaign-planning`. Configure it in the system
with an end date and a reason, so it is auditable and expires on its own.

### Checklist

- [ ] `project-pricing-rules` loaded; stacking and floors understood
- [ ] Mechanic matched to the objective
- [ ] Current margin checked on every product in the offer
- [ ] Break-even volume uplift computed and judged realistic
- [ ] Threshold set above the median basket
- [ ] Bundles built on combined margin, not price
- [ ] Cost floor enforced in the system
- [ ] Stacking behaviour decided explicitly
- [ ] End date set and enforced
- [ ] Value-add alternatives considered before a price cut
- [ ] Habituation risk assessed
- [ ] Human approval obtained

## References

- **National Retail Federation — promotional mechanics and margin impact**
  <https://nrf.com/research>
- **Byron Sharp, _How Brands Grow_** — the limited long-term effect of price
  promotion on loyalty
- **Standard retail pricing practice** — reference price effects and discount
  habituation
- **PostgreSQL 16 documentation — `percentile_cont`**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the mechanic-to-objective table,
the break-even uplift calculation, the threshold-above-median rule, the
structural margin protections, and the value-add list.
