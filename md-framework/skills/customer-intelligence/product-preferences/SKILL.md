---
name: product-preferences
version: 1.0.0
description: |
  Identify what customers actually prefer — basket composition, substitution,
  brand and size choice, and revealed versus stated preference. Use when planning
  the range, choosing between suppliers or variants, or when asked "what do our
  customers like".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Product Preferences

What customers **buy** is preference; what they **say** they want is a hypothesis.
This skill works from purchase behaviour first and uses stated preference to
explain it.

> **Before running anything:** load `project-database`. Much of this works on
> anonymous transactions — basket composition does not need customer identity,
> only the sale grouping.

### Revealed preference within a choice set

The useful question is not "what sells most" but "when customers had a choice,
what did they pick".

```sql
-- Share within a category — the choice set matters more than absolute volume
SELECT c.name AS category, p.name AS product,
       sum(l.quantity)                                                        AS units,
       round(100.0 * sum(l.quantity) / sum(sum(l.quantity)) OVER (PARTITION BY c.id), 1) AS share_of_category
FROM sale_line l
JOIN sale s     ON s.id=l.sale_id AND s.status='completed'
JOIN product p  ON p.id=l.product_id
JOIN category c ON c.id=p.category_id
WHERE s.shop_id=$1 AND s.sold_at >= now() - interval '180 days'
GROUP BY c.id, c.name, p.name
ORDER BY c.name, share_of_category DESC;
```

**Share within a category is only meaningful if the alternatives were
available.** A product with 90% share because the alternative was out of stock
for two months has not won a preference contest. Always check availability
alongside share.

### Size, pack, and price-point preference

```sql
SELECT p.pack_size, count(*) AS lines, sum(l.quantity) AS units,
       round(100.0*sum(l.quantity)/sum(sum(l.quantity)) OVER (), 1) AS share
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id
WHERE p.category_id=$2 AND s.shop_id=$1 AND s.sold_at >= now()-interval '180 days'
GROUP BY 1 ORDER BY units DESC;
```

Pack-size and price-point preference are among the most actionable outputs — they
tell you what to stock more of within a range you already carry, which is a
cheaper decision than adding new lines.

### Substitution — what happens during a stockout

A natural experiment the shop runs for you constantly.

```sql
-- Category sales on days when a given product was out of stock
WITH out_days AS (
  SELECT DISTINCT date_trunc('day', sm.created_at)::date AS d
  FROM stock_movement sm
  WHERE sm.product_id = $2 AND sm.quantity_after = 0
    AND sm.created_at >= now() - interval '180 days'
)
SELECT p.name,
       sum(l.quantity) FILTER (WHERE date_trunc('day', s.sold_at)::date IN (SELECT d FROM out_days)) AS units_when_out,
       sum(l.quantity) FILTER (WHERE date_trunc('day', s.sold_at)::date NOT IN (SELECT d FROM out_days)) AS units_normally
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id
WHERE p.category_id = (SELECT category_id FROM product WHERE id=$2)
  AND s.shop_id=$1 AND s.sold_at >= now()-interval '180 days'
GROUP BY 1;
```

Two very different outcomes:

- **Another product's sales rise** → customers substitute. The stockout costs
  margin difference, not the sale
- **Category sales simply fall** → no substitution. The stockout costs the whole
  sale, and possibly the visit

**Non-substitutable products deserve much higher safety stock** — see
`reorder-analysis`. This is one of the most practically valuable findings
available from transaction data.

### Basket composition

What is bought together reveals preference structure without needing customer
identity.

```sql
SELECT a.name AS product_a, b.name AS product_b, count(*) AS baskets_together
FROM sale_line la
JOIN sale_line lb ON lb.sale_id = la.sale_id AND lb.product_id > la.product_id
JOIN sale s   ON s.id = la.sale_id AND s.status='completed'
JOIN product a ON a.id = la.product_id
JOIN product b ON b.id = lb.product_id
WHERE s.shop_id=$1 AND s.sold_at >= now() - interval '180 days'
GROUP BY 1,2 HAVING count(*) >= 20
ORDER BY 3 DESC LIMIT 50;
```

See `cross-selling` for turning this into placement and bundle decisions.

### Stated preference — use it for what it is good at

Customers cannot reliably predict their own behaviour, but they are good at
naming things that **do not exist yet**:

- "Do you have X?" — a request for something you do not stock. This is the
  highest-value stated signal. See `recurring-requests`
- "I wish you had smaller packs" — a gap in an existing range
- "I buy this elsewhere because…" — a competitive gap

Treat these as candidates to test, not as demand. A product requested by five
customers may sell to exactly five customers.

### Preference changes

```sql
SELECT p.name,
       round(100.0*sum(l.quantity) FILTER (WHERE s.sold_at >= now()-interval '90 days')
             / nullif(sum(sum(l.quantity) FILTER (WHERE s.sold_at >= now()-interval '90 days'))
                      OVER (PARTITION BY p.category_id),0), 1) AS share_recent,
       round(100.0*sum(l.quantity) FILTER (WHERE s.sold_at >= now()-interval '365 days'
                                             AND s.sold_at < now()-interval '90 days')
             / nullif(sum(sum(l.quantity) FILTER (WHERE s.sold_at >= now()-interval '365 days'
                                                    AND s.sold_at < now()-interval '90 days'))
                      OVER (PARTITION BY p.category_id),0), 1) AS share_prior
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id
WHERE s.shop_id=$1 GROUP BY p.id, p.name, p.category_id
ORDER BY (share_recent - share_prior) DESC NULLS LAST;
```

Shifting share within a stable category is a preference change; shifting share
because a competitor product was unavailable is not. Check both.

### Caveats

- Availability must be checked before reading share as preference
- Price changes shift share without preference changing
- Promotions distort share for their duration and shortly after
- What is on the shelf constrains what can be preferred — you only observe
  choices among what you stock
- Anonymous transactions cannot reveal individual preference, only aggregate

### Checklist

- [ ] Share computed within a choice set, not absolute volume
- [ ] Availability verified before reading share as preference
- [ ] Pack size and price point analysed
- [ ] Substitution behaviour tested using stockout periods
- [ ] Non-substitutable products flagged for higher safety stock
- [ ] Basket composition analysed
- [ ] Stated requests treated as candidates, not demand
- [ ] Preference shifts distinguished from availability and price effects
- [ ] Promotions excluded or annotated
- [ ] Limitation acknowledged: only choices among stocked items are observable

## References

- **Revealed preference theory (Samuelson)** — behaviour as the primary
  indicator of preference over stated intent
- **Nielsen Norman Group — limits of self-reported data**
  <https://www.nngroup.com/articles/first-rule-of-usability-dont-listen-to-users/>
- **National Retail Federation — assortment and range planning metrics**
  <https://nrf.com/research>
- **PostgreSQL 16 documentation — window functions with `PARTITION BY`**
  <https://www.postgresql.org/docs/16/tutorial-window.html>

**Not sourced — written for this framework:** the SQL patterns, the stockout-as
-natural-experiment substitution test, the non-substitutable safety stock
implication, and the availability-before-preference rule.
