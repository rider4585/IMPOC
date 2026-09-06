---
name: category-performance
version: 1.0.0
description: |
  Analyse performance at the category level — contribution, margin, growth, and
  space productivity — to guide range and shelf decisions. Use when reviewing the
  range, planning purchasing, or when asked "which categories are working".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Category Performance

Categories are how a shop is actually managed — purchasing, shelf space, and
supplier relationships all work at this level. Product-level detail matters
underneath, but decisions are made here.

> **Before running anything:** load `project-database`. Confirm how categories are
> structured — flat or hierarchical — because a hierarchy changes every
> aggregation below.

### Contribution and margin together

```sql
SELECT c.name AS category,
       sum(l.quantity)                                              AS units,
       count(DISTINCT s.id)                                         AS transactions,
       round(sum(l.quantity*l.unit_price - l.discount)/100.0, 2)    AS revenue,
       round(sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)/100.0, 2) AS profit,
       round(100.0*sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)
             / nullif(sum(l.quantity*l.unit_price - l.discount),0), 1)          AS margin_pct,
       round(100.0*sum(l.quantity*l.unit_price - l.discount)
             / sum(sum(l.quantity*l.unit_price - l.discount)) OVER (), 1)       AS pct_of_revenue,
       round(100.0*sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)
             / sum(sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)) OVER (), 1) AS pct_of_profit
FROM sale_line l
JOIN sale s     ON s.id = l.sale_id AND s.status='completed'
JOIN product p  ON p.id = l.product_id
JOIN category c ON c.id = p.category_id
WHERE s.shop_id=$1 AND s.sold_at >= $2
GROUP BY 1 ORDER BY profit DESC;
```

**Compare `pct_of_revenue` against `pct_of_profit`.** Where they diverge is where
the decision is:

- Revenue share **above** profit share → high volume, thin margin. Is it earning
  its shelf space, or is it a traffic builder?
- Profit share **above** revenue share → quietly valuable. Usually
  under-supported.

### Growth, not just size

```sql
SELECT c.name,
       round(sum(l.quantity*l.unit_price - l.discount)
             FILTER (WHERE s.sold_at >= now() - interval '90 days')/100.0, 2) AS current_90d,
       round(sum(l.quantity*l.unit_price - l.discount)
             FILTER (WHERE s.sold_at >= now() - interval '455 days'
                       AND s.sold_at <  now() - interval '365 days')/100.0, 2) AS same_period_last_year
FROM sale_line l
JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id
JOIN category c ON c.id=p.category_id
WHERE s.shop_id=$1 GROUP BY 1;
```

Use **year-on-year** windows, not month-on-month — categories are the most
seasonal level of the business, and a month comparison mostly measures the
season. See `seasonal-analysis`.

### Space and capital productivity

The question a shop owner actually asks: *is this category worth the shelf it
occupies?*

```sql
-- Profit per unit of average inventory value held (a GMROI-style ratio)
SELECT c.name,
       round(sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)/100.0,2) AS profit_365d,
       round(avg(st.quantity * p.cost_price)/100.0, 2)                          AS avg_stock_value,
       round( sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)
              / nullif(avg(st.quantity * p.cost_price),0), 2)                   AS gmroi
FROM category c
JOIN product p ON p.category_id=c.id
LEFT JOIN stock st ON st.product_id=p.id
LEFT JOIN sale_line l ON l.product_id=p.id
LEFT JOIN sale s ON s.id=l.sale_id AND s.status='completed'
                AND s.sold_at >= now() - interval '365 days'
WHERE c.shop_id=$1 GROUP BY 1 ORDER BY gmroi DESC NULLS LAST;
```

**GMROI** — gross margin return on inventory investment — is the retail metric
for this: profit earned per rupee tied up in stock. A GMROI below 1 means the
category returns less profit than the capital it holds.

Where shelf metreage is recorded, profit per linear metre is the sharper version.
Where it is not, GMROI is the best available proxy — say which you used.

### Category roles

Not every category should be judged the same way. Assign a role, then measure
against it:

| Role | Purpose | Judge on |
|---|---|---|
| **Destination** | Why customers choose this shop | Revenue share, footfall |
| **Routine** | Everyday staples | Consistency, availability |
| **Traffic builder** | Draws people in | Basket attachment, not own margin |
| **Convenience** | Bought because they are here | Margin |
| **Seasonal** | Time-bounded | In-season performance only |

Judging a traffic builder on its own margin leads to delisting the thing that
brings people through the door. Check basket attachment first — see
`cross-selling`.

### Caveats

- Category assignment must be consistent; uncategorised products distort shares.
  **Count them and report the figure**
- Hierarchical categories can double-count if rolled up carelessly
- Out-of-stock periods depress a category unfairly
- A category with very few products is volatile — one product's movement swings it
- Seasonal categories out of season look worse than they are

```sql
SELECT count(*) FILTER (WHERE category_id IS NULL) AS uncategorised, count(*) AS total
FROM product WHERE shop_id=$1 AND is_active;
```

### Checklist

- [ ] Category structure understood (flat or hierarchical)
- [ ] Revenue share and profit share compared, divergence explained
- [ ] Year-on-year growth used, not month-on-month
- [ ] GMROI or profit-per-space computed
- [ ] Category roles assigned before judging
- [ ] Traffic builders assessed on attachment, not own margin
- [ ] Uncategorised products counted and disclosed
- [ ] Small categories flagged as volatile
- [ ] Out-of-stock and seasonality accounted for
- [ ] Output tied to a decision — range, space, or purchasing

## References

- **National Retail Federation — GMROI and category management metrics**
  <https://nrf.com/research>
- **ECR / category management practice** — category roles (destination, routine,
  convenience, seasonal) as a standard framework
- **PostgreSQL 16 documentation — window functions and `FILTER`**
  <https://www.postgresql.org/docs/16/tutorial-window.html>

**Not sourced — written for this framework:** the SQL patterns, the
revenue-share-vs-profit-share reading, the judge-against-role rule, and the
uncategorised-product disclosure.
