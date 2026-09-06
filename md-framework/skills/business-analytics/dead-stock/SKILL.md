---
name: dead-stock
version: 1.0.0
description: |
  Identify stock that is not selling, quantify the capital it traps, and decide
  between clearance, return, and write-off. Use when cash is tight, during a
  range review, before a stock take, or when asked "what's not selling".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Dead Stock

Dead stock is inventory that is not going to sell at its current price, in its
current position. It is the most expensive thing in a shop: it consumed cash,
occupies space that could hold something that sells, and usually loses value
while it sits.

> **Before running anything:** load `project-database` and
> `project-inventory-rules`. A write-off is a financial event — see the approval
> rule below.

### Identify it

```sql
SELECT p.name, p.sku, c.name AS category,
       st.quantity                                  AS units_held,
       round(st.quantity * p.cost_price/100.0, 2)   AS capital_tied,
       max(s.sold_at)::date                         AS last_sold,
       coalesce(now()::date - max(s.sold_at)::date, 9999) AS days_since_sale,
       p.created_at::date                           AS first_listed
FROM product p
JOIN stock st ON st.product_id = p.id AND st.quantity > 0
LEFT JOIN category c ON c.id = p.category_id
LEFT JOIN sale_line l ON l.product_id = p.id
LEFT JOIN sale s ON s.id = l.sale_id AND s.status = 'completed'
WHERE p.shop_id = $1
GROUP BY p.name, p.sku, c.name, st.quantity, p.cost_price, p.created_at
HAVING coalesce(max(s.sold_at), '1970-01-01') < now() - interval '180 days'
ORDER BY capital_tied DESC;
```

**Sort by capital tied up, not by age.** Ten units of a slow-moving cheap item
matter far less than two units of an expensive one. The money is the story.

### Set the threshold by product type

A single "180 days" rule is wrong across a mixed range:

| Goods | Reasonable dead threshold |
|---|---|
| Perishable | Days — expiry governs, see `stock-aging` |
| Fast-moving consumables | 30–60 days |
| General merchandise | 90–180 days |
| Seasonal | One full season missed |
| Specialist / high value | 12 months, if margin justifies holding |

Agree thresholds with the owner rather than assuming; they belong in
`project-inventory-rules`.

### Rule out the false positives first

Most "dead stock" lists contain items that are not dead. Check each before
recommending anything:

- **Was it in stock?** A product recorded as held but actually zero for months
  did not fail to sell — see `product-velocity`
- **Is it seasonal?** Judge in season
- **Is it new?** A recent listing needs a trial period
- **Is it a spare, a component, or a service item** that sells rarely by design?
- **Is it visible?** Stock in a back room is not on sale
- **Was the data wrong?** An unrecorded sale or a stock adjustment error

### Quantify the cost of holding it

```sql
SELECT count(*)                                        AS dead_lines,
       sum(st.quantity)                                AS dead_units,
       round(sum(st.quantity * p.cost_price)/100.0, 2) AS capital_tied,
       round(100.0 * sum(st.quantity * p.cost_price)
             / (SELECT sum(st2.quantity * p2.cost_price)
                FROM stock st2 JOIN product p2 ON p2.id=st2.product_id
                WHERE p2.shop_id=$1), 1)               AS pct_of_inventory_value
FROM product p JOIN stock st ON st.product_id=p.id AND st.quantity > 0
WHERE p.shop_id=$1
  AND NOT EXISTS (SELECT 1 FROM sale_line l JOIN sale s ON s.id=l.sale_id
                  WHERE l.product_id=p.id AND s.status='completed'
                    AND s.sold_at >= now() - interval '180 days');
```

**The percentage of inventory value that is dead is the headline number.** It
turns a list into a decision: "₹1.4 lakh, 18% of your stock value, has not sold
in six months."

### The options, in order

1. **Reprice and promote** — try to sell it before losing value. A discount that
   recovers cost is better than a write-off
2. **Reposition** — move it somewhere visible; a surprising amount of dead stock
   is simply hidden
3. **Bundle** — pair it with a fast mover — see `cross-selling`
4. **Return to supplier** — check whether the agreement allows it, before
   discounting
5. **Clear at cost or below** — recovering some cash beats none
6. **Write off** — last resort

**Recovering 40% of cost today usually beats holding for a full recovery that
does not come.** Money released now buys stock that sells.

### Write-offs need approval and an audit trail

A write-off reduces the value of the business's assets. It is a financial event,
not a stock correction.

- **Requires human approval** — never write off stock on an agent's judgement
- Must be attributable: who, when, why, how much — see `logging`
- Must be recorded as a stock movement of its own type, not a silent adjustment
- Should be reviewed for pattern: repeated write-offs in one category is a
  purchasing problem, not a stock problem

### Prevent recurrence

Dead stock is a purchasing outcome. Feed the finding back:

- Which categories and suppliers generate it repeatedly?
- Were minimum order quantities forcing over-purchase?
- Was it a one-off promotion buy that did not sell through?
- Did a seasonal order arrive too late in the season?

```sql
SELECT c.name AS category, count(*) AS dead_lines,
       round(sum(st.quantity*p.cost_price)/100.0,2) AS capital
FROM product p JOIN stock st ON st.product_id=p.id AND st.quantity>0
JOIN category c ON c.id=p.category_id
WHERE p.shop_id=$1
  AND NOT EXISTS (SELECT 1 FROM sale_line l JOIN sale s ON s.id=l.sale_id
                  WHERE l.product_id=p.id AND s.status='completed'
                    AND s.sold_at >= now()-interval '180 days')
GROUP BY 1 ORDER BY capital DESC;
```

### Checklist

- [ ] Thresholds set by product type, agreed with the owner
- [ ] Ranked by capital tied up, not by age
- [ ] False positives ruled out — availability, season, new listing, visibility
- [ ] Total dead capital and its share of inventory value reported
- [ ] Options considered in order before recommending write-off
- [ ] Supplier return terms checked before discounting
- [ ] Write-offs escalated for human approval
- [ ] Write-offs attributable, with reason, as their own movement type
- [ ] Recurrence analysed by category and supplier
- [ ] Finding fed back into purchasing

## References

- **IAS 2 — Inventories** — net realisable value and the basis for writing
  inventory down
  <https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/>
- **APICS / ASCM Dictionary** — obsolete and excess inventory terminology
- **National Retail Federation — inventory metrics** <https://nrf.com/research>

**Not sourced — written for this framework:** the SQL patterns, the
threshold-by-product-type table, the false-positive checks, the ordered options
list, and the human-approval rule for write-offs.
