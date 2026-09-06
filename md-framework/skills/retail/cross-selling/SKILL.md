---
name: cross-selling
version: 1.0.0
description: |
  Increase basket size by selling complementary products — finding real
  associations, placement, bundling, and till prompts. Use when basket size is
  flat, when planning layout or bundles, or when asked "what else can we sell
  them".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Cross-Selling

Selling something **additional** — a complement to what is already being bought.
It is the cheapest growth available: the customer is already here, already
buying, and the cost of the extra sale is close to zero.

> **Before running anything:** load `project-database`. Basket analysis needs only
> the sale grouping, so it works on anonymous transactions.

### Find real associations, not popular products

```sql
WITH pairs AS (
  SELECT la.product_id a, lb.product_id b, count(DISTINCT s.id) together
  FROM sale_line la
  JOIN sale_line lb ON lb.sale_id=la.sale_id AND lb.product_id > la.product_id
  JOIN sale s ON s.id=la.sale_id AND s.status='completed'
  WHERE s.shop_id=$1 AND s.sold_at >= now()-interval '180 days'
  GROUP BY 1,2 HAVING count(DISTINCT s.id) >= 20
),
freq AS (SELECT l.product_id, count(DISTINCT s.id) baskets
         FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
         WHERE s.shop_id=$1 AND s.sold_at >= now()-interval '180 days' GROUP BY 1),
tot AS (SELECT count(*) n FROM sale WHERE status='completed' AND shop_id=$1
        AND sold_at >= now()-interval '180 days')
SELECT pa.name, pb.name, p.together,
       round((p.together::numeric/t.n) / ((fa.baskets::numeric/t.n)*(fb.baskets::numeric/t.n)), 2) AS lift
FROM pairs p
JOIN freq fa ON fa.product_id=p.a JOIN freq fb ON fb.product_id=p.b
JOIN product pa ON pa.id=p.a JOIN product pb ON pb.id=p.b CROSS JOIN tot t
ORDER BY lift DESC;
```

**Use lift, not raw co-occurrence.** Bread appears with everything because bread
sells constantly — that is not an association. Lift above ~1.5 with adequate
support indicates a genuine pairing. See `recommendation-generation`.

### Then ask whether it is actionable

A high-lift pair is only useful if you can act on it. Check:

- **Are they already adjacent?** If so, the association may be the shelf, not the
  products — and there is nothing to gain
- **Was there a promotion pairing them?** Then it is an artifact
- **Is it just "a big shop"?** Staples co-occur because baskets are large
- **Is one of them a natural complement** the customer would want reminding of?

The valuable pairs are complements that are **currently far apart** or not
obviously connected.

### Placement is the cheapest intervention

Moving stock costs nothing and needs no discount.

| Technique | Example |
|---|---|
| Adjacency | Complement beside the primary item |
| Cross-merchandising | A secondary display of the complement in the primary's aisle |
| Till area | Small, high-margin impulse items |
| Signage | "Goes well with…" at the shelf |

Test it properly: measure the pair's co-purchase rate before and after the move,
and give it a few weeks. If nothing changes, move it back — shelf space is finite
and every placement displaces something.

```sql
SELECT date_trunc('week', s.sold_at)::date AS week,
       count(DISTINCT s.id) FILTER (WHERE has_a AND has_b) AS both,
       count(DISTINCT s.id) FILTER (WHERE has_a)           AS with_a,
       round(100.0 * count(DISTINCT s.id) FILTER (WHERE has_a AND has_b)
             / nullif(count(DISTINCT s.id) FILTER (WHERE has_a),0), 1) AS attach_rate_pct
FROM (SELECT s.id, s.sold_at,
             bool_or(l.product_id=$2) has_a, bool_or(l.product_id=$3) has_b
      FROM sale s JOIN sale_line l ON l.sale_id=s.id
      WHERE s.status='completed' AND s.shop_id=$1 AND s.sold_at >= now()-interval '20 weeks'
      GROUP BY s.id, s.sold_at) x
JOIN sale s ON s.id=x.id GROUP BY 1 ORDER BY 1;
```

**Attach rate** — how often B is bought given A — is the metric for cross-selling,
and it is directly comparable before and after a change.

### Bundles

Bundle on **combined margin**, not on what already sells together — see
`offer-strategy`. Pairing a slow mover with a fast one shifts stock that needed
shifting; bundling two things people already buy together mostly discounts a
basket that would have happened anyway.

### Till prompts: one, at most

A cashier mid-queue will not read a list. One suggestion, in stock, relevant to
the current basket — see `ui-design` and `recommendation-generation`.

Measure the attach rate. If it is negligible, remove the prompt; the screen space
and the cashier's attention have a real cost.

### Staff suggestion beats software

In a small shop, a cashier saying "do you need batteries with that?" outperforms
any prompt. Make it easy:

- A short list of two or three genuinely useful pairings, not a table
- Grounded in real data so it does not feel like a script
- Framed as helpfulness, not selling — "you'll need X for that" is service
- Never pushy; a shop that badgers loses regulars

### Protect the low-margin traffic builders

The most important defensive finding this skill produces.

```sql
-- Baskets containing this product: what else do they buy, and what are they worth?
SELECT round(avg(s.total)/100.0, 2) AS avg_basket_with,
       (SELECT round(avg(total)/100.0,2) FROM sale
        WHERE status='completed' AND shop_id=$1 AND sold_at >= now()-interval '180 days'
          AND id NOT IN (SELECT sale_id FROM sale_line WHERE product_id=$2)) AS avg_basket_without
FROM sale s WHERE s.status='completed' AND s.shop_id=$1
  AND s.id IN (SELECT sale_id FROM sale_line WHERE product_id=$2)
  AND s.sold_at >= now()-interval '180 days';
```

**Before delisting any low-margin product, run this.** If baskets containing it
are substantially larger, it is anchoring the trip — removing it removes the
basket, not just the line. See `product-performance`.

### Caveats

- Association is not causation; shelf position and promotions create false pairs
- Low support makes lift unstable — enforce a minimum
- Seasonal pairs do not hold year-round
- Cross-selling a product that is out of stock damages the interaction
- Attach rate changes may be seasonal; compare over several weeks

### Checklist

- [ ] Lift used with a minimum support threshold
- [ ] Existing adjacency and promotions ruled out as causes
- [ ] Actionable pairs distinguished from artifacts
- [ ] Placement tested with before/after attach rate
- [ ] Ineffective placements reverted
- [ ] Bundles built on combined margin
- [ ] One till prompt maximum, stock-checked
- [ ] Prompt attach rate measured; removed if negligible
- [ ] Staff given a short, real list rather than a script
- [ ] Basket value with and without checked before delisting low-margin lines
- [ ] Seasonal associations time-bounded

## References

- **Agrawal, Imieliński & Swami — association rule mining** — support,
  confidence, and lift
- **National Retail Federation — market basket analysis and attach rate**
  <https://nrf.com/research>
- **Standard retail merchandising practice** — adjacency and
  cross-merchandising
- **PostgreSQL 16 documentation — `bool_or`, `FILTER`**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the SQL patterns, the
is-it-actionable checks, the attach-rate before/after test, the one-prompt rule,
and the basket-value test before delisting traffic builders.
