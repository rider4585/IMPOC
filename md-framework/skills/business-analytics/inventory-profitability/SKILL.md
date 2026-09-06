---
name: inventory-profitability
version: 1.0.0
description: |
  Judge whether inventory is earning its capital — GMROI, profit per unit of
  space and cash, and where money is trapped. Use when cash is constrained, when
  deciding what to stock more or less of, or when asked "is our stock working for
  us".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Inventory Profitability

The question that ties margin and velocity together: **for every rupee tied up in
stock, how much profit comes back?** A high-margin item that never sells and a
fast-selling item with no margin are both poor uses of capital, and only this
analysis catches both.

> **Before running anything:** load `project-database` and
> `project-inventory-rules`. This requires historical cost on sale lines — see
> `profit-analysis`.

### GMROI is the core metric

```
GMROI = Gross profit over a period ÷ Average inventory at cost
```

- **GMROI > 3** — strong; capital is working hard
- **GMROI 2–3** — healthy for most retail
- **GMROI 1–2** — weak; examine
- **GMROI < 1** — the stock returns less profit than the cash it holds

```sql
WITH profit AS (
  SELECT l.product_id,
         sum(l.quantity * (l.unit_price - l.cost_price) - l.discount) AS gross_profit,
         sum(l.quantity)                                              AS units_sold
  FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
  WHERE s.sold_at >= now() - interval '365 days'
  GROUP BY 1
)
SELECT p.name, c.name AS category,
       coalesce(pr.units_sold, 0)                              AS units_365d,
       round(coalesce(pr.gross_profit,0)/100.0, 2)             AS gross_profit,
       coalesce(st.quantity,0)                                 AS stock_now,
       round(coalesce(st.quantity,0) * p.cost_price/100.0, 2)  AS capital_tied,
       round(coalesce(pr.gross_profit,0)
             / nullif(st.quantity * p.cost_price, 0), 2)       AS gmroi
FROM product p
LEFT JOIN profit pr  ON pr.product_id = p.id
LEFT JOIN stock st   ON st.product_id = p.id
LEFT JOIN category c ON c.id = p.category_id
WHERE p.shop_id = $1 AND p.is_active
ORDER BY gmroi ASC NULLS FIRST;
```

**Sort ascending.** The bottom of this list is where the money is stuck, and that
is the actionable end.

Using current stock as the denominator is an approximation; average inventory
over the period is more correct where movement history allows — see
`stock-turnover`. State which you used.

### Profit per rupee is the decision lens

For a shop with limited cash — which is most shops — the real question is not
"which product is most profitable" but "where should the next ₹10,000 go".

```sql
-- Ranked by return on the capital each product consumes
SELECT p.name,
       round(sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)/100.0, 2) AS profit_365d,
       round(avg(st.quantity * p.cost_price)/100.0, 2)                          AS avg_capital,
       round(sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)
             / nullif(avg(st.quantity * p.cost_price), 0), 2)                   AS return_per_rupee
FROM product p
JOIN sale_line l ON l.product_id=p.id
JOIN sale s ON s.id=l.sale_id AND s.status='completed' AND s.sold_at >= now()-interval '365 days'
LEFT JOIN stock st ON st.product_id=p.id
WHERE p.shop_id=$1 GROUP BY 1
ORDER BY return_per_rupee DESC NULLS LAST;
```

The top of this list deserves more stock; the bottom deserves less. That is a
more useful recommendation than any margin ranking alone.

### The four positions

Cross **margin** with **turnover** — the two components of GMROI:

| | High turnover | Low turnover |
|---|---|---|
| **High margin** | **Winners** — stock deeper, protect availability | **Slow earners** — fine if capital allows; try promoting |
| **Low margin** | **Volume drivers** — only worth it if they build baskets | **Capital traps** — reduce or delist |

GMROI can be identical for a high-margin slow item and a low-margin fast one; the
decomposition tells you which lever to pull. Never act on GMROI alone.

### Where the money is trapped

```sql
SELECT c.name AS category,
       round(sum(st.quantity * p.cost_price)/100.0, 2) AS capital_tied,
       round(100.0 * sum(st.quantity * p.cost_price)
             / sum(sum(st.quantity * p.cost_price)) OVER (), 1) AS pct_of_inventory,
       round(sum(pr.gross_profit)/nullif(sum(st.quantity*p.cost_price),0), 2) AS gmroi
FROM product p
JOIN stock st ON st.product_id=p.id
JOIN category c ON c.id=p.category_id
LEFT JOIN (SELECT l.product_id, sum(l.quantity*(l.unit_price-l.cost_price)-l.discount) AS gross_profit
           FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
           WHERE s.sold_at >= now()-interval '365 days' GROUP BY 1) pr ON pr.product_id=p.id
WHERE p.shop_id=$1 GROUP BY 1 ORDER BY capital_tied DESC;
```

A category holding 30% of inventory value and returning a GMROI below 1 is the
clearest possible signal to buy less of it.

### Turning it into a recommendation

The output should be a reallocation, not a report:

> "₹1.8 lakh — 22% of your stock value — sits in homeware, returning ₹0.80 of
> profit per rupee. Beverages returns ₹4.20 and is out of stock two days a week.
> Moving ₹50,000 of purchasing from homeware to beverages would be worth roughly
> ₹1.7 lakh of additional annual gross profit, assuming demand holds."

State the assumption. Demand does not always hold when you buy more.

### Caveats

- Requires historical cost on sale lines; approximate without it
- Current-stock denominator is a snapshot; average inventory is better
- Seasonal products distort a whole-year GMROI — assess in season
- Excludes rent, wages, and shrinkage; this is gross, not net
- Low-volume products produce unstable ratios
- Volume drivers may earn their place through basket attachment — check
  `cross-selling` before cutting them

### Checklist

- [ ] Historical cost used; approximation disclosed if unavailable
- [ ] GMROI computed per product and per category
- [ ] Denominator basis stated (current vs average inventory)
- [ ] Results sorted to surface trapped capital
- [ ] Margin and turnover decomposed, not GMROI alone
- [ ] Four-position classification applied
- [ ] Category-level capital concentration reported
- [ ] Basket attachment checked before cutting volume drivers
- [ ] Seasonal products assessed in season
- [ ] Output expressed as a reallocation recommendation with its assumption
- [ ] Stated that this is gross, not net, profitability

## References

- **National Retail Federation — GMROI definition and retail inventory
  metrics** <https://nrf.com/research>
- **APICS / ASCM Dictionary** — inventory turnover and return-on-inventory
  terminology
- **IAS 2 — Inventories** — cost basis underlying these calculations
  <https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/>
- **PostgreSQL 16 documentation — window functions**
  <https://www.postgresql.org/docs/16/tutorial-window.html>

**Not sourced — written for this framework:** the SQL patterns, the
return-per-rupee framing for constrained cash, the four-position table, and the
reallocation recommendation format.
