---
name: seasonal-analysis
version: 1.0.0
description: |
  Identify and quantify recurring seasonal patterns — annual, monthly, weekly,
  and daily — and use them for stock and staffing decisions. Use when planning
  purchasing ahead of a season, when comparing periods, or when asked "is this
  normal for the time of year".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Seasonal Analysis

Retail is seasonal at every scale: hour of day, day of week, month of year, and
festival calendar. Almost every misleading retail comparison is a seasonal
pattern mistaken for a trend.

> **Before running anything:** load `project-database`. Seasonal analysis needs
> at least two full years of data to distinguish a pattern from a one-off — with
> one year, you can describe but not confirm.

### The four scales

| Scale | Drives | Decision it informs |
|---|---|---|
| **Hour of day** | Footfall through the day | Staffing, break timing, deliveries |
| **Day of week** | Weekly rhythm | Rota, promotion timing |
| **Month / season** | Weather, holidays, income cycles | Purchasing, cash planning |
| **Festival calendar** | Local events | Stock ahead, extended hours |

### Weekly and daily pattern

```sql
SELECT extract(dow  FROM sold_at)  AS day_of_week,
       extract(hour FROM sold_at)  AS hour,
       count(*)                    AS transactions,
       round(sum(total)/100.0, 2)  AS revenue,
       round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS pct_of_transactions
FROM sale
WHERE status='completed' AND shop_id=$1 AND sold_at >= now() - interval '365 days'
GROUP BY 1,2 ORDER BY 1,2;
```

This is the most immediately actionable seasonal output — it answers "when do we
need more people" and "is that quiet hour worth opening for".

### Monthly seasonal index

Express each month relative to the annual average. An index of 1.0 is average;
1.4 means 40% above.

```sql
WITH monthly AS (
  SELECT date_trunc('month', sold_at) AS m,
         extract(month FROM sold_at)  AS month_num,
         sum(total)                   AS revenue
  FROM sale WHERE status='completed' AND shop_id=$1
    AND sold_at >= now() - interval '3 years'
  GROUP BY 1,2
)
SELECT month_num,
       round(avg(revenue)/100.0, 2)                              AS avg_revenue,
       round(avg(revenue) / (SELECT avg(revenue) FROM monthly), 2) AS seasonal_index,
       count(*)                                                  AS years_of_data
FROM monthly GROUP BY 1 ORDER BY 1;
```

**Report `years_of_data`.** An index built from one observation per month is a
description of last year, not a seasonal pattern — say so rather than presenting
it as one.

### Use the index to compare fairly

The point of the index is to answer "was this month actually good?"

```
December revenue      ₹6.2L
December index        1.45   (December is normally 45% above average)
Deseasonalised        ₹4.28L
Average month         ₹4.30L
→ December was normal, not exceptional.
```

Without this adjustment, every December looks like a triumph and every February
like a crisis. Present the deseasonalised figure whenever comparing across
months.

### Seasonal products behave differently from seasonal trade

Distinguish two things:

- **Seasonal trade** — the whole shop is busier (festival period, weekend)
- **Seasonal products** — specific lines that only sell in a window

```sql
-- Products whose sales concentrate in a few months
WITH by_month AS (
  SELECT p.id, p.name, extract(month FROM s.sold_at) AS mth, sum(l.quantity) AS units
  FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
  JOIN product p ON p.id=l.product_id
  WHERE s.shop_id=$1 AND s.sold_at >= now() - interval '2 years'
  GROUP BY 1,2,3
)
SELECT name,
       sum(units)                                             AS annual_units,
       round(100.0 * max(units) / nullif(sum(units),0), 1)    AS pct_in_peak_month,
       (array_agg(mth ORDER BY units DESC))[1]                AS peak_month
FROM by_month GROUP BY id, name
HAVING sum(units) > 20
ORDER BY pct_in_peak_month DESC;
```

A product with a high share of its annual sales in one or two months is
seasonal — **never judge it out of season**, and never let it appear in a
dead-stock list during its off period. See `dead-stock`.

### Plan ahead of the season, not into it

The practical value of this analysis is timing:

- **Order** ahead by the lead time plus the ramp-up — see `reorder-analysis`
- **Raise reorder points** before the season starts, and lower them after
- **Staff** to the hourly pattern, not to an average
- **Plan cash**: seasonal stock ties up money weeks before it returns
- **Plan the exit**: what happens to unsold seasonal stock, and when markdowns
  begin — see `stock-aging`

The most common seasonal failure is ordering during the season and receiving
stock as it ends.

### Local calendar matters more than the generic one

Festivals, school terms, local events, paydays, and weather drive small-shop
trade more than any generic seasonal model. Salary cycles in particular produce a
strong monthly rhythm in many markets.

These are not in the data as labels — ask the owner and record them in
`project-roadmap` or a calendar table, then annotate the analysis with them.

### Caveats

- Two full years minimum to confirm a pattern; one year describes only
- A moving festival date shifts the peak between months year to year
- One-off events (a closure, a competitor opening) contaminate the average
- New shops have no seasonal history — use category or regional judgement
- Weather-driven variation is not a stable seasonal pattern

### Checklist

- [ ] At least two years of data, or the limitation stated
- [ ] Hour-of-day and day-of-week pattern produced
- [ ] Monthly seasonal index computed, with years-of-data disclosed
- [ ] Cross-month comparisons deseasonalised
- [ ] Seasonal products identified separately from seasonal trade
- [ ] Seasonal products excluded from off-season dead-stock findings
- [ ] Moving festival dates accounted for
- [ ] One-off events excluded or annotated
- [ ] Local calendar collected from the owner and recorded
- [ ] Output framed as timing decisions — order, staff, cash, exit

## References

- **Rob Hyndman & George Athanasopoulos, _Forecasting: Principles and
  Practice_** — seasonal indices, decomposition, and data requirements
  <https://otexts.com/fpp3/>
- **National Retail Federation — seasonal retail patterns and comparable
  period reporting** <https://nrf.com/research>
- **PostgreSQL 16 documentation — `extract`, `date_trunc`, `array_agg`**
  <https://www.postgresql.org/docs/16/functions-datetime.html>

**Not sourced — written for this framework:** the four-scale table, the SQL
patterns, the deseasonalised comparison presentation, the seasonal-product
exclusion from dead stock, and the local-calendar requirement.
