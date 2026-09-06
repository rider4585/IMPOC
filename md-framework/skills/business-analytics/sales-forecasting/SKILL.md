---
name: sales-forecasting
version: 1.0.0
description: |
  Project future sales for purchasing and cash planning — simple baselines,
  seasonal adjustment, accuracy measurement, and knowing when not to forecast.
  Use when planning stock ahead, projecting cash, or when asked "how much will we
  sell".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Sales Forecasting

A forecast is an input to a decision, not a prediction. The decision it usually
serves is *how much to order*, and the cost of being wrong is asymmetric — a
stockout on a fast mover costs more than a small excess.

> **Before running anything:** load `project-database` and `seasonal-analysis`.
> Forecasting without seasonal adjustment produces confidently wrong numbers.

### Start simple, and often stop there

For a small shop, simple methods perform close to sophisticated ones — and they
are explainable, which matters more.

| Method | Use when | Note |
|---|---|---|
| **Naive** — same as last period | Very short horizon, stable demand | The baseline everything must beat |
| **Seasonal naive** — same period last year | Any seasonal product | Surprisingly hard to beat in retail |
| **Moving average** | Stable, non-seasonal | Smooths noise, lags turns |
| **Trend + seasonal index** | Most retail cases | The workhorse — see below |
| Exponential smoothing | Longer series, some trend | Only if the simpler ones underperform |
| ML models | Not warranted at this scale | Unexplainable and unnecessary |

**Always compute the naive baseline.** If a complicated method cannot beat "the
same as last year, adjusted", use the simple one.

### The workhorse: trend plus seasonal index

```sql
WITH monthly AS (
  SELECT date_trunc('month', sold_at) AS m,
         extract(month FROM sold_at)  AS mth,
         sum(total)                   AS revenue
  FROM sale WHERE status='completed' AND shop_id=$1
    AND sold_at >= now() - interval '3 years'
  GROUP BY 1,2
),
idx AS (
  SELECT mth, avg(revenue) / (SELECT avg(revenue) FROM monthly) AS seasonal_index
  FROM monthly GROUP BY 1
),
base AS (   -- deseasonalised recent level
  SELECT avg(m.revenue / i.seasonal_index) AS level
  FROM monthly m JOIN idx i ON i.mth = m.mth
  WHERE m.m >= now() - interval '12 months'
)
SELECT i.mth AS month_number,
       round(i.seasonal_index, 2)                        AS seasonal_index,
       round((SELECT level FROM base) * i.seasonal_index / 100.0, 2) AS forecast_revenue
FROM idx i ORDER BY 1;
```

Deseasonalise, find the level, reapply the season. Add a trend term only if the
deseasonalised series shows a consistent direction — see `sales-trends`.

### Forecast at the level of the decision

- **Purchasing** → forecast **units per product**, not shop revenue
- **Cash planning** → forecast revenue and the timing of supplier payments
- **Staffing** → forecast transactions by hour, not money

A shop-level revenue forecast cannot tell you how many units to order. Match the
granularity to the decision, and be honest that per-product forecasts for
low-volume items are close to guesswork.

```sql
-- Per-product forecast, seasonally adjusted, for reordering
SELECT p.name,
       round(sum(l.quantity) FILTER (WHERE s.sold_at >= now() - interval '90 days')/90.0, 3) AS recent_daily,
       round(sum(l.quantity) FILTER (WHERE s.sold_at >= now() - interval '455 days'
                                       AND s.sold_at <  now() - interval '365 days')/90.0, 3) AS same_period_last_year_daily
FROM product p
JOIN sale_line l ON l.product_id=p.id
JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE p.shop_id=$1 GROUP BY 1;
```

### Always give a range

A single number invites false confidence. Give a range and say what would move
it.

> "Expect ₹4.6–5.4 lakh next month, most likely around ₹5.0 lakh. The range is
> wide because last year had a promotion in the same period that we are not
> repeating."

For ordering, the asymmetry matters: for a fast mover, order toward the **upper**
end (a stockout costs a lost sale and a disappointed customer); for a perishable
or a slow mover, order toward the **lower** end.

### Measure accuracy, and keep measuring

A forecast nobody checks never improves.

```
MAPE = mean( |actual − forecast| / actual )
Bias = mean( forecast − actual )     ← the more useful one
```

**Bias matters more than error size.** Consistently forecasting high means
systematic overstocking, which shows up later as dead stock. Track bias by
category and correct for it.

```sql
SELECT date_trunc('month', period)::date AS month,
       round(avg(abs(actual - forecast) / nullif(actual,0)) * 100, 1) AS mape_pct,
       round(avg(forecast - actual)/100.0, 2)                          AS bias
FROM forecast_log WHERE shop_id=$1 GROUP BY 1 ORDER BY 1;
```

If no forecast log exists, create one — recording each forecast alongside the
actual is the only way accuracy can ever be known.

### When not to forecast

Say so plainly rather than producing a number:

- **New products** — no history. Use a comparable product, and label it a guess
- **Fewer than two years** for anything seasonal
- **Very low volume** — an item selling 3 a month has no meaningful forecast
- **After a structural change** — new competitor, relocation, price overhaul
- **One-off events** — a festival that fell differently, a road closure

A stated "we cannot forecast this reliably; here is a judgement and its
assumptions" is more useful than a spurious precise figure.

### Caveats to state with every forecast

- Method used, and that it beat the naive baseline
- Data period and its completeness
- Assumptions — no new competitor, no price change, no promotion
- Known upcoming events not in the history
- That past stockouts understate true demand, so forecasts built on them are low

### Checklist

- [ ] Naive and seasonal-naive baselines computed first
- [ ] Chosen method beats the baseline, or the baseline is used
- [ ] Seasonal adjustment applied
- [ ] Forecast produced at the granularity of the decision
- [ ] Range given, not a single number
- [ ] Ordering skewed by asymmetric cost of error
- [ ] Forecast logged against actuals
- [ ] Bias tracked, not just error magnitude
- [ ] Cases where forecasting is inappropriate stated as such
- [ ] Assumptions and caveats listed
- [ ] Stockout-depressed history flagged

## References

- **Rob Hyndman & George Athanasopoulos, _Forecasting: Principles and
  Practice_** — naive and seasonal-naive baselines, decomposition, accuracy
  measures (MAPE, bias), and the case for simple methods
  <https://otexts.com/fpp3/>
- **APICS / ASCM Dictionary** — forecast bias and demand planning terminology
- **National Retail Federation — demand planning practice**
  <https://nrf.com/research>

**Not sourced — written for this framework:** the SQL patterns, the
method-selection table, the forecast-at-the-decision-level rule, the asymmetric
ordering guidance, and the when-not-to-forecast list.
