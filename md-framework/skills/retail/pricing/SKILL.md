---
name: pricing
version: 1.0.0
description: |
  Set and review retail prices — cost-plus, competitive and value-based
  approaches, price architecture, and reviewing an existing range. Use when
  setting a price, reviewing margins, responding to a cost increase, or when
  asked "what should we charge".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Pricing

The highest-leverage decision in retail. A 1% price improvement flows almost
entirely to profit, where a 1% volume increase carries its cost of goods with it.

> **Before changing anything:** load `project-pricing-rules`. Pricing changes are
> financial decisions requiring **human approval** — an agent may analyse and
> recommend, never apply.

### Three approaches, used together

| Approach | Method | Right for |
|---|---|---|
| **Cost-plus** | Cost × (1 + markup) | The default; ensures viability |
| **Competitive** | Relative to nearby shops | Known-value items customers compare |
| **Value-based** | What the customer will pay | Unique, convenience, or specialist lines |

Cost-plus alone leaves money on the table for items nobody comparison-shops, and
prices you out of the ones they do. Segment the range and apply the right method
to each part.

### Know your known-value items

A small number of products drive price perception for the whole shop. Customers
know what milk, bread, or a staple costs; they have no idea about most other
things.

```sql
-- Candidates: highest-frequency, most broadly purchased lines
SELECT p.name,
       count(DISTINCT s.id)                                       AS baskets,
       round(100.0*count(DISTINCT s.id)
             / (SELECT count(*) FROM sale WHERE status='completed'
                  AND shop_id=$1 AND sold_at >= now()-interval '90 days'), 1) AS pct_of_baskets
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id
WHERE s.shop_id=$1 AND s.sold_at >= now() - interval '90 days'
GROUP BY 1 ORDER BY baskets DESC LIMIT 30;
```

**Price these competitively; make margin elsewhere.** This is the core of retail
price architecture — be visibly fair on what people check, and price the rest on
value.

### Markup and margin, again

```
Price = Cost ÷ (1 − target margin)        ← margin-based, the correct form
Price = Cost × (1 + markup)               ← markup-based
```

A 40% target margin needs a 67% markup. Using markup where margin was intended
underprices systematically. See `profit-analysis`.

### Review the existing range for problems

The most valuable pricing work is usually fixing what is already wrong.

```sql
SELECT p.name, c.name AS category,
       round(p.cost_price/100.0, 2)  AS cost,
       round(p.unit_price/100.0, 2)  AS price,
       round(100.0*(p.unit_price - p.cost_price)/nullif(p.unit_price,0), 1) AS margin_pct,
       sum(l.quantity) AS units_90d
FROM product p
LEFT JOIN category c ON c.id=p.category_id
LEFT JOIN sale_line l ON l.product_id=p.id
LEFT JOIN sale s ON s.id=l.sale_id AND s.status='completed' AND s.sold_at >= now()-interval '90 days'
WHERE p.shop_id=$1 AND p.is_active
GROUP BY p.name, c.name, p.cost_price, p.unit_price
ORDER BY margin_pct;
```

Look for:

- **Negative or near-zero margin** — usually a cost increase never passed on.
  Fix immediately
- **Wildly inconsistent margin within a category** — often accidental
- **Prices unchanged for years** while cost rose
- **Price inversions** — a larger pack cheaper per unit than a smaller one is
  fine; the reverse confuses and annoys customers

```sql
-- Products where cost now exceeds or nearly meets price
SELECT name, round(cost_price/100.0,2) AS cost, round(unit_price/100.0,2) AS price
FROM product WHERE shop_id=$1 AND is_active AND unit_price <= cost_price * 1.05
ORDER BY (unit_price - cost_price);
```

That query should return nothing. Anything it returns is losing money on every
sale.

### Responding to a cost increase

- **Do not absorb it silently.** Margin erosion is invisible until it is severe
- Pass it through on non-known-value items promptly
- For known-value items, consider timing, pack size, or absorbing temporarily as
  a deliberate decision with an end date
- Review the whole category, not one product — a single increase often signals a
  broader supplier move

### Price endings and psychology

Endings (₹99 versus ₹100) have real effects, but they are second-order. Get the
level right first.

Use them consistently: inconsistent endings across a range look careless. Whole
numbers at a till speed up cash handling, which has an operational value of its
own.

### Price changes need care in the system

A price change is not just a number:

- **Shelf labels must be reprinted** — a stale label causing the wrong price at
  the till is a common and damaging complaint (see `complaint-analysis`)
- Historical sales keep their original price — never restate history
- Open carts and held sales may hold the old price; decide the behaviour
- Promotions interacting with a new base price need re-checking
- The change must be attributable: who, when, why — see `logging`

### Testing a price change

Change one thing, measure, keep or revert:

```sql
SELECT date_trunc('week', s.sold_at)::date AS week,
       sum(l.quantity)                                              AS units,
       round(avg(l.unit_price)/100.0, 2)                            AS avg_price,
       round(sum(l.quantity*(l.unit_price-l.cost_price))/100.0, 2)  AS gross_profit
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE l.product_id=$2 AND s.shop_id=$1 AND s.sold_at >= now() - interval '16 weeks'
GROUP BY 1 ORDER BY 1;
```

**Judge on gross profit, not units.** A price rise that loses some volume but
raises profit succeeded. Allow several weeks — customers notice slowly, and one
week is noise.

### Caveats

- Costs must be current; stale cost data invalidates every margin figure
- Volume changes after a price change may be seasonal, not causal
- Competitor prices change; a competitive position decays
- Elasticity varies enormously by product — do not generalise from one test
- Very low-volume products give unreliable test results

### Checklist

- [ ] `project-pricing-rules` loaded
- [ ] Known-value items identified from basket frequency
- [ ] Competitive pricing applied to those; value pricing elsewhere
- [ ] Margin formula used, not markup, where margin is intended
- [ ] Range reviewed for negative, inconsistent, and stale prices
- [ ] Below-cost lines fixed immediately
- [ ] Cost increases passed through deliberately, category-wide
- [ ] Price endings consistent
- [ ] Shelf label reprinting handled as part of any change
- [ ] Change attributable and logged
- [ ] Changes tested over several weeks and judged on gross profit
- [ ] **Human approval obtained before any price is applied**

## References

- **National Retail Federation — pricing and margin metrics**
  <https://nrf.com/research>
- **Standard retail pricing practice** — known-value items and price
  architecture; price-ending research
- **IAS 2 — Inventories** — cost basis underlying margin
  <https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/>
- **PostgreSQL 16 documentation — aggregate and window functions**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the SQL patterns, the
known-value-item identification query, the range-review problem list, the
shelf-label consequence, and the human-approval requirement.
