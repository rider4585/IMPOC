---
name: recommendation-generation
version: 1.0.0
description: |
  Generate product recommendations from purchase data — co-purchase association,
  repeat-purchase timing, and simple personalisation. Use when suggesting
  products at the till or in a campaign, or when asked "what should we recommend
  to this customer".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Recommendation Generation

Suggesting what a customer might want next. For a shop of this size, **simple
association beats machine learning** — it is explainable, needs no training
infrastructure, and performs well on the small number of products involved.

> **Before running anything:** load `project-database`. Basket association needs
> only sale grouping; personalised recommendations additionally need customer
> identity — see `customer-segmentation` for the identification rate.

### Co-purchase association

The workhorse. What is bought together, expressed as a lift over chance.

```sql
WITH pair AS (
  SELECT la.product_id AS a, lb.product_id AS b, count(DISTINCT s.id) AS together
  FROM sale_line la
  JOIN sale_line lb ON lb.sale_id = la.sale_id AND lb.product_id > la.product_id
  JOIN sale s ON s.id = la.sale_id AND s.status='completed'
  WHERE s.shop_id=$1 AND s.sold_at >= now() - interval '180 days'
  GROUP BY 1,2 HAVING count(DISTINCT s.id) >= 20
),
freq AS (
  SELECT l.product_id, count(DISTINCT s.id) AS baskets
  FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
  WHERE s.shop_id=$1 AND s.sold_at >= now() - interval '180 days'
  GROUP BY 1
),
total AS (SELECT count(*) AS n FROM sale WHERE status='completed' AND shop_id=$1
          AND sold_at >= now() - interval '180 days')
SELECT pa.name AS product_a, pb.name AS product_b, p.together,
       round(p.together::numeric / fa.baskets, 3)                        AS confidence_a_to_b,
       round((p.together::numeric / t.n) /
             ((fa.baskets::numeric / t.n) * (fb.baskets::numeric / t.n)), 2) AS lift
FROM pair p
JOIN freq fa ON fa.product_id=p.a JOIN freq fb ON fb.product_id=p.b
JOIN product pa ON pa.id=p.a JOIN product pb ON pb.id=p.b
CROSS JOIN total t
WHERE (p.together::numeric / t.n) /
      ((fa.baskets::numeric / t.n) * (fb.baskets::numeric / t.n)) > 1.5
ORDER BY lift DESC;
```

Three measures, and only one of them is worth acting on:

| Measure | Meaning | Trap |
|---|---|---|
| **Support** | How often the pair occurs | Low support = coincidence |
| **Confidence** | P(B given A) | Inflated when B is simply popular |
| **Lift** | Confidence ÷ base rate of B | **The one to use** — lift > 1 means genuine association |

Recommending bread with everything because bread sells often is the classic
confidence trap. **Require lift above ~1.5 and adequate support.**

### Association is not causation

A high-lift pair may reflect shelf adjacency, a bundle promotion, or the shape of
a typical shopping trip rather than a real affinity. Before acting:

- Was there a promotion pairing them?
- Are they adjacent on the shelf already?
- Is it simply "things people buy on a big weekly shop"?

Test a recommendation rather than assuming it. See `cross-selling`.

### Repeat-purchase timing

For consumables, the most useful recommendation is not *what* but *when*.

```sql
WITH intervals AS (
  SELECT s.customer_id, l.product_id,
         s.sold_at - lag(s.sold_at) OVER (PARTITION BY s.customer_id, l.product_id ORDER BY s.sold_at) AS gap
  FROM sale s JOIN sale_line l ON l.sale_id = s.id
  WHERE s.status='completed' AND s.shop_id=$1 AND s.customer_id IS NOT NULL
)
SELECT p.name,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(day FROM gap))::numeric, 0) AS median_repurchase_days,
       count(*) AS observations
FROM intervals i JOIN product p ON p.id=i.product_id
WHERE gap IS NOT NULL GROUP BY 1 HAVING count(*) >= 30
ORDER BY observations DESC;
```

A customer who buys a product every ~30 days and is at day 35 is due. That is a
better recommendation than any similarity model, and it is trivially
explainable — see `customer-retention`.

### Personalised recommendation

Combine what the customer buys with what associates with it:

```sql
-- Products associated with this customer's history that they have not bought
SELECT pb.name, sum(p.together) AS strength
FROM pair p
JOIN product pb ON pb.id = p.b
WHERE p.a IN (SELECT DISTINCT l.product_id FROM sale s JOIN sale_line l ON l.sale_id=s.id
              WHERE s.customer_id = $2 AND s.status='completed')
  AND p.b NOT IN (SELECT DISTINCT l.product_id FROM sale s JOIN sale_line l ON l.sale_id=s.id
                  WHERE s.customer_id = $2 AND s.status='completed')
GROUP BY 1 ORDER BY strength DESC LIMIT 10;
```

### Filter before recommending

A recommendation engine without these filters produces embarrassing suggestions:

- **In stock now** — never recommend what you cannot sell
- **Not already in the basket**
- **Not the same product in a different pack** unless that is the point
- **Margin-aware** — prefer profitable suggestions among equally relevant ones
- **Not expiring imminently**, unless the recommendation *is* the markdown
- **Appropriate** — do not recommend across categories where it would be odd or
  insensitive

### Where to use them

| Context | Recommendation type |
|---|---|
| At the till, during a sale | Co-purchase with the current basket, in stock, one suggestion |
| Reactivation message | Their usual products, due by timing |
| Campaign targeting | Segment affinity — see `customer-segmentation` |
| Shelf and layout planning | Aggregate association — see `merchandising` |

**At the till, one suggestion at most.** A cashier will not read a list mid-queue,
and a slow prompt costs more than the suggestion earns — see `ui-design`.

### Measure whether they work

An unmeasured recommendation is decoration.

- Attach rate: how often a suggestion was accepted
- Incremental value: did basket size actually rise, or was it bought anyway?
- Compare against no recommendation for a period

If attach rate is negligible, remove the feature rather than tuning it — the
screen space and the cashier's attention have a cost.

### Privacy

Personalised recommendations use purchase history. Keep them within what serves
the customer, respect marketing consent separately from analysis, and never
surface a customer's purchase history where others can see it at the counter.

### Caveats

- Requires adequate basket volume; small shops produce noisy associations
- Promotions and shelf placement create spurious associations
- Lift is unstable at low support — enforce a minimum
- Anonymous transactions permit only aggregate, not personalised, recommendations
- Seasonal pairs do not hold year-round

### Checklist

- [ ] Lift used, not confidence alone; minimum support enforced
- [ ] Promotions and shelf adjacency ruled out as causes
- [ ] Repeat-purchase timing used for consumables
- [ ] Recommendations filtered for stock, basket, margin, and expiry
- [ ] One suggestion at the till, not a list
- [ ] Personalisation only where identification supports it
- [ ] Attach rate and incremental value measured
- [ ] Ineffective recommendations removed, not tuned indefinitely
- [ ] Purchase history handled per privacy policy and consent
- [ ] Seasonal associations time-bounded

## References

- **Agrawal, Imieliński & Swami — association rule mining** — support,
  confidence, and lift as the standard measures
- **Peter Fader, _Customer Centricity_** — the case for simple, explainable
  models over complex ones at small scale
- **National Retail Federation — market basket analysis practice**
  <https://nrf.com/research>
- **PostgreSQL 16 documentation — window functions, `percentile_cont`**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the SQL patterns, the
confidence-trap warning, the pre-recommendation filter list, the one-suggestion
-at-the-till rule, and the remove-if-ineffective guidance.
