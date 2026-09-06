---
name: customer-retention
version: 1.0.0
description: |
  Measure and improve repeat purchase — retention and churn rates, cohort
  analysis, at-risk identification, and reactivation. Shared by
  customer-intelligence and retail agents. Use when growth stalls, when planning
  loyalty work, or when asked "are customers coming back".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Customer Retention

Keeping a customer costs far less than acquiring one, and a shop's growth is
usually limited by repeat purchase rather than by new footfall. Retention is
where the leverage is.

> **Before running anything:** load `project-database` and establish the
> identification rate — see `customer-segmentation`. Retention cannot be measured
> on anonymous transactions.

### Define the purchase cycle first

"Churned" means nothing without a normal repeat interval. A customer who buys
weekly and has not appeared in a month is at risk; one who buys annually is not.

```sql
WITH gaps AS (
  SELECT customer_id, sold_at,
         sold_at - lag(sold_at) OVER (PARTITION BY customer_id ORDER BY sold_at) AS gap
  FROM sale WHERE status='completed' AND shop_id=$1 AND customer_id IS NOT NULL
)
SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(day FROM gap))::numeric, 0) AS median_days,
       round(percentile_cont(0.8) WITHIN GROUP (ORDER BY extract(day FROM gap))::numeric, 0) AS p80_days
FROM gaps WHERE gap IS NOT NULL;
```

A reasonable definition: **at risk** past the 80th percentile gap, **churned** at
roughly twice the median. Derive it from the data rather than assuming 30 days.

### Repeat rate and the second purchase

```sql
SELECT count(*) FILTER (WHERE purchases = 1)  AS one_time,
       count(*) FILTER (WHERE purchases > 1)  AS repeat_customers,
       round(100.0 * count(*) FILTER (WHERE purchases > 1) / count(*), 1) AS repeat_rate_pct
FROM (
  SELECT customer_id, count(*) AS purchases
  FROM sale WHERE status='completed' AND shop_id=$1 AND customer_id IS NOT NULL
    AND sold_at >= now() - interval '365 days'
  GROUP BY 1
) c;
```

**The first-to-second purchase is the steepest drop in retail**, and the highest
-leverage place to intervene. A customer who buys twice is far more likely to buy
a third time. Measure that step specifically:

```sql
SELECT count(*) FILTER (WHERE purchases >= 2) * 100.0 / count(*) AS pct_reaching_second,
       count(*) FILTER (WHERE purchases >= 3) * 100.0
         / nullif(count(*) FILTER (WHERE purchases >= 2), 0)     AS pct_second_to_third
FROM (SELECT customer_id, count(*) AS purchases FROM sale
      WHERE status='completed' AND shop_id=$1 AND customer_id IS NOT NULL
      GROUP BY 1) c;
```

### Cohort analysis

Group customers by when they first bought, then track how many return. This
separates "are we getting worse" from "we had an unusual month".

```sql
WITH first_purchase AS (
  SELECT customer_id, date_trunc('month', min(sold_at)) AS cohort
  FROM sale WHERE status='completed' AND shop_id=$1 AND customer_id IS NOT NULL
  GROUP BY 1
),
activity AS (
  SELECT f.cohort, f.customer_id,
         (extract(year FROM age(date_trunc('month', s.sold_at), f.cohort)) * 12
          + extract(month FROM age(date_trunc('month', s.sold_at), f.cohort)))::int AS month_offset
  FROM first_purchase f
  JOIN sale s ON s.customer_id=f.customer_id AND s.status='completed'
  GROUP BY 1,2,3
)
SELECT cohort::date, month_offset,
       count(DISTINCT customer_id) AS active,
       round(100.0 * count(DISTINCT customer_id)
             / max(count(DISTINCT customer_id)) OVER (PARTITION BY cohort), 1) AS retention_pct
FROM activity WHERE month_offset <= 12
GROUP BY 1,2 ORDER BY 1,2;
```

Read it as a triangle: each row is a cohort, each column a month since first
purchase. **Compare cohorts at the same offset** — if recent cohorts retain worse
at month 3 than older ones did, something changed.

### Find the at-risk customers now

The most actionable output of the skill.

```sql
SELECT c.name, c.phone,
       max(s.sold_at)::date                       AS last_purchase,
       now()::date - max(s.sold_at)::date         AS days_since,
       count(*)                                   AS lifetime_purchases,
       round(sum(s.total)/100.0, 2)               AS lifetime_spend
FROM customer c JOIN sale s ON s.customer_id=c.id AND s.status='completed'
WHERE c.shop_id=$1
GROUP BY c.id, c.name, c.phone
HAVING max(s.sold_at) < now() - ($2 || ' days')::interval      -- the at-risk threshold
   AND count(*) >= 3                                            -- was a regular
ORDER BY sum(s.total) DESC;
```

Filtering to customers who were **previously regular** matters — reactivating a
one-time buyer is close to acquisition, while a lapsed regular has already shown
they value the shop.

### Why customers leave

Retention analysis says who; it does not say why. Combine with:

- **Complaints and feedback** before they lapsed — see `complaint-analysis`
- **Stockouts** of what they used to buy — a common, fixable cause
- **Price changes** in their usual categories
- Whether their category is seasonal rather than lost

```sql
-- Did the products a lapsed customer bought go out of stock?
SELECT p.name, count(*) FILTER (WHERE sm.quantity_after = 0) AS zero_stock_days
FROM sale_line l JOIN sale s ON s.id=l.sale_id
JOIN product p ON p.id=l.product_id
JOIN stock_movement sm ON sm.product_id=p.id AND sm.created_at >= $2
WHERE s.customer_id = $1 GROUP BY 1 ORDER BY 2 DESC;
```

**Stockouts are the most common fixable cause of quiet churn** in a shop — the
customer went elsewhere for one item and stayed.

### Reactivation

- Contact quickly — the longer the gap, the lower the response
- Reference what they actually bought, not a generic offer
- A reason to return beats a discount; a discount to a customer who would have
  returned anyway is pure margin lost
- Respect contact consent and frequency limits — see `whatsapp-campaigns`
- Measure the outcome, or it is not a campaign — see `campaign-roi`

### Caveats

- Identification rate limits everything; state it
- A customer who moved away is not a retention failure
- Seasonal purchasers look churned out of season
- Household accounts distort counts
- Small cohorts are volatile — do not over-read a single month

### Checklist

- [ ] Identification rate stated
- [ ] Purchase cycle derived from data, not assumed
- [ ] At-risk and churn thresholds defined from the cycle
- [ ] Repeat rate reported, with the first-to-second step isolated
- [ ] Cohort analysis run and compared at equal offsets
- [ ] At-risk list produced, filtered to previously regular customers
- [ ] Causes investigated — stockouts, complaints, price
- [ ] Reactivation prioritised by lifetime value and recency
- [ ] Contact consent respected
- [ ] Reactivation outcomes measured

## References

- **Frederick Reichheld, _The Loyalty Effect_** — retention economics and the
  cost asymmetry against acquisition
- **Peter Fader, _Customer Centricity_** — cohort-based retention measurement
- **RFM / direct marketing practice** — recency as the strongest predictor of
  response
- **PostgreSQL 16 documentation — `percentile_cont`, `age`, window functions**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the SQL patterns, deriving churn
thresholds from the observed purchase cycle, the first-to-second purchase focus,
the stockout-as-churn-cause analysis, and the previously-regular filter for
reactivation.
