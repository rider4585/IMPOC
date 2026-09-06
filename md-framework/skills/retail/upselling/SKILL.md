---
name: upselling
version: 1.0.0
description: |
  Increase transaction value by moving customers to a better or larger option —
  trading up, pack size, and range architecture. Use when average basket value is
  flat, when planning the range within a category, or when asked "how do we sell
  more per customer".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Upselling

Selling a **better or larger version** of what the customer already wants — as
distinct from cross-selling, which adds a different product.

Done well it is a service: the customer gets something that suits them better.
Done badly it is pressure, and in a shop with regular customers, pressure is
expensive.

> **Before running anything:** load `project-database` and check margins — see
> `profit-analysis`. An upsell to a lower-margin product is not an upsell.

### The range must support it

You cannot trade a customer up if there is nothing to trade up to. Good/better/
best within a category creates the opportunity:

```sql
SELECT p.name,
       round(p.unit_price/100.0, 2) AS price,
       round(100.0*(p.unit_price-p.cost_price)/nullif(p.unit_price,0), 1) AS margin_pct,
       sum(l.quantity) AS units_90d
FROM product p
LEFT JOIN sale_line l ON l.product_id=p.id
LEFT JOIN sale s ON s.id=l.sale_id AND s.status='completed' AND s.sold_at >= now()-interval '90 days'
WHERE p.category_id=$2 AND p.shop_id=$1 AND p.is_active
GROUP BY p.name, p.unit_price, p.cost_price
ORDER BY p.unit_price;
```

Look at the **price ladder**. Common problems:

- **Too big a gap** between tiers — nobody steps up
- **No premium option** — the range caps out at mid-market
- **Everything the same price** — no ladder at all
- **The premium option carries lower margin** — trading up loses money

A step of roughly 20–40% between tiers is usually crossable. Beyond that it reads
as a different purchase.

### Find where customers already trade up

```sql
-- Share of category units by price tier
SELECT width_bucket(p.unit_price,
                    (SELECT min(unit_price) FROM product WHERE category_id=$2),
                    (SELECT max(unit_price) FROM product WHERE category_id=$2), 3) AS tier,
       round(min(p.unit_price)/100.0,2) AS from_price,
       round(max(p.unit_price)/100.0,2) AS to_price,
       sum(l.quantity)                  AS units,
       round(100.0*sum(l.quantity)/sum(sum(l.quantity)) OVER (), 1) AS share_pct
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id
WHERE p.category_id=$2 AND s.shop_id=$1 AND s.sold_at >= now()-interval '180 days'
GROUP BY 1 ORDER BY 1;
```

If almost everything sells at the cheapest tier, either the premium options are
not visible, not explained, or not wanted. Check placement before concluding
demand.

### Pack size is the easiest upsell

Larger packs raise transaction value with almost no persuasion, provided the
value is genuine.

```sql
SELECT p.name, p.pack_size,
       round(p.unit_price/nullif(p.pack_size,0)/100.0, 2) AS price_per_unit,
       sum(l.quantity) AS units_sold
FROM product p
LEFT JOIN sale_line l ON l.product_id=p.id
LEFT JOIN sale s ON s.id=l.sale_id AND s.status='completed' AND s.sold_at >= now()-interval '90 days'
WHERE p.category_id=$2 AND p.shop_id=$1 GROUP BY 1,2,p.unit_price ORDER BY p.pack_size;
```

**Price per unit must fall as pack size rises**, or the larger pack is a worse
deal and customers will notice. A price inversion here damages trust in the whole
range — see `pricing`.

Display unit price on the shelf. It makes the value obvious and does the
upselling for you.

### Upsell only where it genuinely serves

| Legitimate | Not |
|---|---|
| Larger pack at better unit value for a regular buyer | Pushing premium on a price-sensitive customer |
| A better option that solves their stated problem | Upselling something with worse margin |
| Pointing out a multibuy they qualify for | Pressure at the till |
| Suggesting the size that matches their usage | Upselling something out of stock |

**A customer who feels pushed does not come back.** In a shop that depends on
regulars, the lifetime cost of an aggressive upsell exceeds the value of the
transaction. Frame it as information, and accept "no" immediately.

### Measure whether it works

```sql
SELECT date_trunc('month', sold_at)::date AS month,
       round(avg(total)/100.0, 2)                              AS avg_basket,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY total)/100.0, 2) AS median_basket
FROM sale WHERE status='completed' AND shop_id=$1 GROUP BY 1 ORDER BY 1;
```

Watch the **median** as well as the mean — a mean pulled up by a few large
transactions is not broad trading up. Track tier share over time; a rising share
in the upper tier is the real evidence.

### Do not upsell what you cannot supply

Check stock before any upsell prompt. Offering a premium option that is out of
stock wastes the interaction and irritates the customer — and it may lose the
base sale too.

### Caveats

- Trading up is limited by what customers can afford; a price-sensitive base has
  a ceiling
- Margin on premium lines is not always higher — verify
- Larger packs can raise waste for perishables; the customer notices
- Average basket rises for many reasons — attribute carefully
- Upselling too hard shows up later as retention loss, not immediately

### Checklist

- [ ] Price ladder reviewed for gaps, caps, and inversions
- [ ] Premium options confirmed to carry equal or better margin
- [ ] Current tier share measured
- [ ] Placement and visibility checked before concluding demand
- [ ] Pack pricing verified — unit price falls as size rises
- [ ] Unit price displayed on shelf
- [ ] Upsell framed as information, never pressure
- [ ] Stock checked before any prompt
- [ ] Median basket tracked alongside mean
- [ ] Tier share tracked over time as the real measure
- [ ] Retention watched for signs of over-selling

## References

- **National Retail Federation — average transaction value and range
  architecture** <https://nrf.com/research>
- **Standard retail practice — good/better/best range structure and unit
  pricing**
- **Nielsen Norman Group — pressure and trust in sales interactions**
  <https://www.nngroup.com/articles/ten-usability-heuristics/>
- **PostgreSQL 16 documentation — `width_bucket`, `percentile_cont`**
  <https://www.postgresql.org/docs/16/functions-math.html>

**Not sourced — written for this framework:** the SQL patterns, the price-ladder
problem list, the 20–40% step guidance, the legitimate/not table, and the
median-alongside-mean measurement rule.
