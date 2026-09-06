---
name: customer-segmentation
version: 1.0.0
description: |
  Group customers by behaviour — RFM, value tiers, and category affinity — to
  target offers and retention effort. Shared by customer-intelligence and
  marketing agents. Use before designing a campaign, when deciding who to target,
  or when asked "who are our best customers".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Customer Segmentation

Grouping customers so that different groups can be treated differently. Without
segmentation, every offer goes to everyone — which is expensive and mostly
discounts people who would have bought anyway.

> **Before running anything:** load `project-database` and confirm that
> transactions can be linked to a customer at all. Many shops record most sales
> anonymously.

### First: how much of the data is identified?

This determines whether segmentation is possible or misleading.

```sql
SELECT count(*)                                             AS all_sales,
       count(*) FILTER (WHERE customer_id IS NOT NULL)      AS identified,
       round(100.0 * count(*) FILTER (WHERE customer_id IS NOT NULL) / count(*), 1) AS pct_identified
FROM sale WHERE status='completed' AND shop_id=$1 AND sold_at >= now() - interval '365 days';
```

**State this percentage in every segmentation output.** If 20% of sales are
identified, the segments describe a fifth of the business — and probably a biased
fifth (loyalty members, credit customers, regulars). Segmenting on that and
calling it "our customers" is wrong.

If identification is very low, say so and recommend improving capture before
investing in targeting.

### RFM — the standard retail segmentation

Recency, Frequency, Monetary value. Simple, explainable, and effective.

```sql
WITH rfm AS (
  SELECT c.id, c.name,
         now()::date - max(s.sold_at)::date AS recency_days,
         count(*)                           AS frequency,
         sum(s.total)                       AS monetary
  FROM customer c
  JOIN sale s ON s.customer_id = c.id AND s.status='completed'
  WHERE c.shop_id = $1 AND s.sold_at >= now() - interval '365 days'
  GROUP BY c.id, c.name
)
SELECT name, recency_days, frequency, round(monetary/100.0,2) AS spend,
       ntile(5) OVER (ORDER BY recency_days DESC) AS r,   -- 5 = most recent
       ntile(5) OVER (ORDER BY frequency)         AS f,
       ntile(5) OVER (ORDER BY monetary)          AS m
FROM rfm ORDER BY monetary DESC;
```

Then map score combinations to segments and, more importantly, to **actions**:

| Segment | Pattern | Action |
|---|---|---|
| **Champions** | Recent, frequent, high spend | Protect. Early access, not discounts |
| **Loyal** | Frequent, good spend | Reward consistency |
| **Potential** | Recent, low frequency | Encourage a second and third visit |
| **New** | Very recent, one purchase | Onboard; the second purchase is the critical one |
| **At risk** | Was frequent, not recent | Reactivate now — this is the highest-value action |
| **Hibernating** | Long gone, was low value | Low-cost reactivation only |
| **Lost** | Long gone | Do not spend on these |

**"At risk" is where segmentation pays.** A good customer who has not returned is
cheaper to bring back than a new customer is to acquire, and the window is short.

### Value tiers

```sql
WITH spend AS (
  SELECT customer_id, sum(total) AS total_spend
  FROM sale WHERE status='completed' AND shop_id=$1 AND customer_id IS NOT NULL
    AND sold_at >= now() - interval '365 days'
  GROUP BY 1
), ranked AS (
  SELECT customer_id, total_spend,
         sum(total_spend) OVER (ORDER BY total_spend DESC) / sum(total_spend) OVER () AS cum_share
  FROM spend
)
SELECT CASE WHEN cum_share <= 0.5 THEN 'top (50% of revenue)'
            WHEN cum_share <= 0.8 THEN 'middle'
            ELSE 'tail' END AS tier,
       count(*) AS customers, round(sum(total_spend)/100.0,2) AS revenue
FROM ranked GROUP BY 1;
```

The usual finding — a small share of customers producing half the revenue — is
worth stating plainly, because it justifies treating them differently.

### Category affinity

More actionable than value alone: what does this group actually buy?

```sql
SELECT cat.name AS category,
       count(DISTINCT s.customer_id)                          AS customers,
       round(sum(l.quantity*l.unit_price - l.discount)/100.0, 2) AS revenue
FROM sale s
JOIN sale_line l ON l.sale_id=s.id
JOIN product p ON p.id=l.product_id
JOIN category cat ON cat.id=p.category_id
WHERE s.shop_id=$1 AND s.status='completed' AND s.customer_id = ANY($2)
GROUP BY 1 ORDER BY revenue DESC;
```

An offer that matches what a segment already buys performs far better than a
generic discount — see `offer-strategy`.

### Keep segments few and actionable

A segmentation is useful only if each segment gets **different treatment**. Two
segments you would treat identically are one segment.

Aim for **three to six**. More than that and nobody can act on them, and the
groups become too small to be reliable.

Every segment needs: a name people understand, a size, a defining behaviour, and
a specific action.

### Privacy and proportionality

Customer data carries obligations. See `security-architecture`.

- Collect only what the business will actually use
- Do not build profiles beyond what serves the customer's own experience
- Honour opt-outs for marketing — segmentation for analysis and for contact are
  different permissions
- Do not export identified customer lists into external tools without a
  deliberate decision
- Retain per the stated policy, not indefinitely

Segmenting to serve customers better is legitimate; segmenting to price
discriminate against them is not, and in some jurisdictions is unlawful.

### Caveats

- Identification rate — stated every time
- Household effects: several people, one account, or one person with several
  accounts
- Business customers behave differently and often dominate value tiers — analyse
  them separately
- Recency windows must suit the category; a monthly staple and an annual purchase
  have different "at risk" thresholds
- Small customer counts make quintiles unstable

### Checklist

- [ ] Identification rate computed and stated
- [ ] Low identification flagged as limiting the conclusion
- [ ] RFM computed with quintile scores
- [ ] Segments mapped to specific actions, not just labels
- [ ] "At risk" segment surfaced for reactivation
- [ ] Value concentration reported
- [ ] Category affinity computed per segment
- [ ] Three to six segments, each with distinct treatment
- [ ] Business customers separated from consumers
- [ ] Recency thresholds tuned to purchase cycle
- [ ] Privacy obligations respected; marketing consent distinguished from analysis

## References

- **RFM analysis** — the standard recency/frequency/monetary segmentation
  method in retail direct marketing (Hughes, _Strategic Database Marketing_)
- **National Retail Federation — customer metrics** <https://nrf.com/research>
- **Peter Fader, _Customer Centricity_** — customer value concentration and
  differential treatment
- **PostgreSQL 16 documentation — `ntile` and window functions**
  <https://www.postgresql.org/docs/16/functions-window.html>

**Not sourced — written for this framework:** the SQL patterns, the mandatory
identification-rate disclosure, the segment-to-action table, the three-to-six
rule, and the privacy and proportionality guidance.
