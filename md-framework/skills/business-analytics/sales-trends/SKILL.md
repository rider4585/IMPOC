---
name: sales-trends
version: 1.0.0
description: |
  Identify direction and change in sales over time — moving averages,
  period-on-period comparison, and distinguishing real movement from noise. Use
  when asked "how are we trending", when a number moves and the cause is unclear,
  or for periodic review.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Sales Trends

A trend is direction sustained over time. The main job of this skill is to stop
people reacting to noise — in a small shop, day-to-day variation is large and
mostly meaningless.

> **Before running anything:** load `project-database`. Confirm which statuses
> count and how refunds are handled — see `sales-analysis`.

### Smooth before concluding

Daily figures in a small shop are dominated by day-of-week effects and chance. A
moving average makes the underlying direction visible.

```sql
SELECT day,
       revenue,
       round(avg(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2)  AS ma_7,
       round(avg(revenue) OVER (ORDER BY day ROWS BETWEEN 27 PRECEDING AND CURRENT ROW), 2) AS ma_28
FROM (
  SELECT date_trunc('day', sold_at)::date AS day,
         round(sum(total)/100.0, 2)       AS revenue
  FROM sale WHERE status='completed' AND shop_id=$1
    AND sold_at >= now() - interval '180 days'
  GROUP BY 1
) d ORDER BY day;
```

Use a **7-day** window to remove day-of-week effects, and **28 days** for the
underlying direction. Never present an unsmoothed daily series as a trend.

### Compare like with like

| Comparison | Use for | Watch |
|---|---|---|
| **Year on year** | The primary retail comparison | Controls for season; needs a year of data |
| **Same period, prior year** | Growth in a defined window | Ensure equal length and completeness |
| Rolling 12 months | Direction free of seasonality | Slow to react |
| Month on month | Short-term operational changes | **Misleading without seasonal adjustment** |
| Week on week | Immediate operational effects | Very noisy |

```sql
SELECT date_trunc('month', sold_at)::date AS month,
       round(sum(total)/100.0, 2) AS revenue,
       round(lag(sum(total), 12) OVER (ORDER BY date_trunc('month', sold_at))/100.0, 2) AS same_month_last_year,
       round(100.0 * (sum(total) - lag(sum(total), 12) OVER (ORDER BY date_trunc('month', sold_at)))
             / nullif(lag(sum(total), 12) OVER (ORDER BY date_trunc('month', sold_at)), 0), 1) AS yoy_pct
FROM sale WHERE status='completed' AND shop_id=$1
GROUP BY 1 ORDER BY 1;
```

### Is the change real?

Before reporting a movement as a trend, check it against normal variation.

```sql
WITH daily AS (
  SELECT date_trunc('day', sold_at)::date AS d, sum(total) AS rev
  FROM sale WHERE status='completed' AND shop_id=$1
    AND sold_at >= now() - interval '365 days' GROUP BY 1
)
SELECT round(avg(rev)/100.0, 2)          AS mean_daily,
       round(stddev_samp(rev)/100.0, 2)  AS stddev,
       round(stddev_samp(rev)/nullif(avg(rev),0), 2) AS coefficient_of_variation
FROM daily;
```

A move within roughly one standard deviation of normal daily variation is
**noise**. Say so plainly rather than explaining it — most "why were sales down
Tuesday" questions have no answer worth finding.

Report a trend only when it holds across several periods, or the movement is
clearly outside normal variation.

### Decompose the movement

A change in total revenue always has a structure underneath it:

```
Revenue = Transactions × Average basket
```

Then find where it concentrated:

```sql
SELECT c.name AS category,
       round(sum(l.quantity*l.unit_price - l.discount)
             FILTER (WHERE s.sold_at >= now() - interval '30 days')/100.0, 2) AS current_30d,
       round(sum(l.quantity*l.unit_price - l.discount)
             FILTER (WHERE s.sold_at >= now() - interval '60 days'
                       AND s.sold_at <  now() - interval '30 days')/100.0, 2) AS prior_30d
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id JOIN category c ON c.id=p.category_id
WHERE s.shop_id=$1 GROUP BY 1 ORDER BY (current_30d - prior_30d);
```

A total that moved 5% usually contains one category that moved 30% — that is the
finding, not the total.

### Watch for structural breaks

A trend line through a step change is misleading. Look for the point where
behaviour changed rather than fitting a line across it:

- A price change
- A new competitor
- A promotion starting or ending
- A supply problem causing stockouts
- A change in opening hours or staffing
- A till offline, losing recorded sales

Annotate known events on any trend chart. An unexplained step change is worth
investigating before it is worth extrapolating.

### Caveats

- Small shops have high day-to-day variation — most single-day moves are noise
- Year-on-year needs a full prior year; say when data is insufficient
- Partial periods must never be compared to complete ones
- Promotions, closures, and stockouts distort periods — annotate them
- Trends in low-volume categories are usually not trends

### Presenting it

Lead with direction and confidence, then the driver:

> "Sales are up about 8% year on year on a 28-day average, and the direction has
> held for three months. Most of it is the beverages category, which is up 22%
> after the fridge was moved to the front. Everything else is roughly flat."

Avoid statistical vocabulary for a non-technical audience — say "normal
variation", not "within one sigma".

### Checklist

- [ ] Daily data smoothed before any conclusion
- [ ] Year-on-year used as the primary comparison
- [ ] Equal-length, complete periods compared
- [ ] Movement checked against normal variation before being called a trend
- [ ] Change decomposed into transactions × basket, then by category
- [ ] Structural breaks identified and annotated
- [ ] Known events (promotions, closures, stockouts) noted
- [ ] Low-volume series not over-interpreted
- [ ] Presented with direction, confidence, and driver, in plain language

## References

- **National Retail Federation — like-for-like and comparable sales
  definitions** <https://nrf.com/research>
- **PostgreSQL 16 documentation — window functions (`lag`, moving frames)**
  <https://www.postgresql.org/docs/16/tutorial-window.html>
- **Rob Hyndman & George Athanasopoulos, _Forecasting: Principles and
  Practice_** — moving averages, decomposition, and the distinction between
  signal and noise <https://otexts.com/fpp3/>

**Not sourced — written for this framework:** the SQL patterns, the
comparison-selection table, the noise threshold guidance for small shops, the
structural-break checklist, and the presentation format.
