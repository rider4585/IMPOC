---
name: merchandising
version: 1.0.0
description: |
  Decide what goes where — layout, shelf position, space allocation, and display
  — to raise sales without discounting. Use when planning layout, when space is
  contested, when a product is not selling despite being stocked, or when asked
  "where should we put this".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Merchandising

Placement is free. Moving stock costs nothing but effort and can change sales
materially — which makes it the first thing to try before any discount.

> **Before running anything:** load `project-database`. Merchandising decisions
> should be tested against sales data, not left to opinion.

### Allocate space by contribution, not by volume

The most common error is giving space to what sells most units rather than what
earns most.

```sql
SELECT c.name AS category,
       sum(l.quantity)                                                     AS units,
       round(sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)/100.0, 2) AS profit,
       round(100.0*sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)
             / sum(sum(l.quantity*(l.unit_price-l.cost_price) - l.discount)) OVER (), 1) AS pct_of_profit
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id JOIN category c ON c.id=p.category_id
WHERE s.shop_id=$1 AND s.sold_at >= now() - interval '180 days'
GROUP BY 1 ORDER BY profit DESC;
```

Compare **share of profit** against share of space. A category taking 30% of the
shelf and contributing 8% of profit is the finding.

Where shelf metreage is recorded, profit per linear metre is the sharper measure;
where it is not, GMROI is the best proxy — see `inventory-profitability`.

### Position within the shop

| Zone | Character | Put here |
|---|---|---|
| Entrance | Customers are orienting, not yet buying | Seasonal, new, or promotional display — not staples |
| Main path | Highest traffic | High-profit, high-demand |
| Rear | Customers walk past everything to reach it | Staples people came for — milk, bread |
| Till area | Waiting, impulse | Small, high-margin add-ons |
| Dead corners | Low traffic | Bulky, destination, or low-priority stock |

**Putting staples at the back is deliberate**: customers pass the rest of the shop
to reach what they came for. It is the oldest merchandising decision there is, and
it still works.

### Position on the shelf

Eye level and the level just below it are the strongest positions; the bottom
shelf and above eye level are weakest.

- **Eye level** — highest-margin and target lines
- **Just below eye level** — high-volume, easily reached
- **Bottom** — bulky, heavy, cheap, or bulk packs
- **Top** — slow movers, backup stock

Also give **more facings to faster sellers**, so they neither look empty nor run
out mid-day. A fast mover with one facing is a stockout waiting to happen — see
`product-velocity`.

### Adjacency

Place complements together. Use real association data rather than intuition —
see `cross-selling`.

The valuable moves are pairs with high lift that are currently **far apart**.
Pairs already adjacent have nothing to gain, and the association may be caused by
the adjacency in the first place.

### Test every change

Merchandising is one of the few retail interventions with a clean before/after
measurement.

```sql
SELECT date_trunc('week', s.sold_at)::date AS week,
       sum(l.quantity) AS units,
       round(sum(l.quantity*l.unit_price - l.discount)/100.0, 2) AS revenue
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE l.product_id = $2 AND s.shop_id=$1
  AND s.sold_at >= now() - interval '16 weeks'
GROUP BY 1 ORDER BY 1;
```

- **Change one thing at a time**, or you learn nothing
- Allow **three to four weeks** — a single week is noise
- Record the date of every move, or the data becomes uninterpretable later
- **Revert what does not work.** Space is finite; every placement displaces
  something else

### Availability beats presentation

A perfectly merchandised empty shelf sells nothing.

```sql
SELECT p.name, count(*) FILTER (WHERE sm.quantity_after = 0) AS zero_stock_events
FROM product p JOIN stock_movement sm ON sm.product_id=p.id
WHERE p.shop_id=$1 AND sm.created_at >= now() - interval '90 days'
GROUP BY 1 HAVING count(*) FILTER (WHERE sm.quantity_after=0) > 0
ORDER BY 2 DESC;
```

Before attributing poor sales to placement, check whether the product was
actually there — see `product-velocity`.

### The basics that get overlooked

- **Prices must be visible and correct.** A missing or stale label costs sales and
  causes complaints — see `complaint-analysis`
- **Face products forward** and keep shelves filled; a gappy shelf reads as a shop
  in trouble
- **Rotate stock so oldest sells first** — FEFO where there is expiry (see
  `stock-aging`)
- **Keep aisles passable**; a blocked aisle removes a whole section from the trip
- **Light the displays** you want noticed

### Feed placement decisions with data

Merchandising is where several analyses become an action:

| Input | Decision |
|---|---|
| `product-velocity` | Facings and position for fast movers |
| `inventory-profitability` | Space allocation by category |
| `cross-selling` | Adjacency |
| `dead-stock` | Reposition before discounting |
| `seasonal-analysis` | What goes in the entrance display, and when |

**Repositioning is the first remedy for dead stock**, before any markdown — a
surprising amount of it is simply not visible.

### Caveats

- Effects take weeks to show; do not judge in days
- Seasonal changes confound before/after comparisons
- Moving one product displaces another — measure both
- Small shops have limited space; the trade-off is real
- Customer habit means regulars may not find a moved staple; signage helps

### Checklist

- [ ] Space allocated by profit contribution, not unit volume
- [ ] Share of space compared against share of profit
- [ ] Staples positioned to draw customers through the shop
- [ ] High-margin lines at eye level
- [ ] Facings proportional to sales rate
- [ ] Adjacency based on measured association, not intuition
- [ ] One change at a time, dated and recorded
- [ ] Three to four weeks allowed before judging
- [ ] Displaced product measured too
- [ ] Ineffective changes reverted
- [ ] Availability verified before blaming placement
- [ ] Labels correct and visible; shelves faced and rotated
- [ ] Dead stock repositioned before it is discounted

## References

- **National Retail Federation — space productivity and sales per linear
  metre** <https://nrf.com/research>
- **Standard retail merchandising practice** — shelf position value, facings,
  and store flow
- **Paco Underhill, _Why We Buy_** — shopper movement through a store and the
  effect of position
- **PostgreSQL 16 documentation — window functions**
  <https://www.postgresql.org/docs/16/tutorial-window.html>

**Not sourced — written for this framework:** the SQL patterns, the zone table,
the test-one-change-and-revert discipline, the availability-before-placement
rule, and the input-to-decision mapping.
