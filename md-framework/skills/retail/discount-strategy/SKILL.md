---
name: discount-strategy
version: 1.0.0
description: |
  Control discounting so it serves a purpose rather than eroding margin —
  policy, authority limits, measuring the true cost, and detecting abuse. Use
  when margin is falling, when discounting seems habitual, or when asked "should
  we discount this".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Discount Strategy

Every rupee discounted comes straight out of gross profit. Discounting is
sometimes right, but it is rarely as effective as it feels, and unmanaged
discounting is one of the most common ways a shop quietly stops making money.

> **Before changing anything:** load `project-pricing-rules` — stacking, floors,
> and rounding. Discount policy changes require **human approval**.

### Measure what discounting actually costs

Most shops do not know. Start here.

```sql
SELECT date_trunc('month', s.sold_at)::date AS month,
       round(sum(l.quantity*l.unit_price)/100.0, 2)      AS gross_at_list,
       round(sum(l.discount)/100.0, 2)                   AS discount_given,
       round(100.0*sum(l.discount)/nullif(sum(l.quantity*l.unit_price),0), 1) AS discount_rate_pct,
       round(100.0*(sum(l.quantity*(l.unit_price-l.cost_price)) - sum(l.discount))
             / nullif(sum(l.quantity*l.unit_price - l.discount),0), 1)        AS margin_after_discount
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE s.shop_id=$1 AND s.sold_at >= now() - interval '18 months'
GROUP BY 1 ORDER BY 1;
```

**A rising discount rate against flat revenue means the shop is buying its own
sales.** That single trend line is the most valuable output of this skill.

### The break-even nobody calculates

```
Margin before discount   32%
Discount                 15%
Margin after             17%
Volume needed to break even = 32 ÷ 17 ≈ 1.9×
```

**A 15% discount on a 32% margin needs nearly double the volume just to stand
still.** Almost no promotion achieves that. Computing this before discounting
prevents most of the damage.

### When discounting is justified

| Justified | Not justified |
|---|---|
| Clearing stock that will otherwise be written off | "Everyone else is discounting" |
| Time-limited trial of a new line | Habitual monthly promotion |
| Reactivating a lapsed customer | Rewarding customers who buy anyway |
| Threshold offers that grow the basket | Blanket percentage off the range |
| Matching a competitor on a known-value item | Matching on items nobody compares |
| Clearing near-expiry stock | Discounting a fast mover in short supply |

The last one is worth stating: **never discount something that is selling well
and is scarce.** It gives away margin on guaranteed sales and brings the stockout
forward.

### Authority limits, enforced by the system

Discretionary discount at the till is where margin leaks invisibly.

- Each role has a **maximum discount**, enforced in software, not policy
- Above it requires a manager, and the approval is recorded
- **A reason is mandatory** on any manual discount
- A **cost floor** prevents any discount taking a line below cost — enforce it as
  a constraint (see `constraints`)

See `authorization` for the implementation pattern.

### Monitor discretionary discounting

```sql
SELECT u.name, u.role,
       count(*) FILTER (WHERE l.discount > 0)                              AS discounted_lines,
       round(100.0*count(*) FILTER (WHERE l.discount > 0)/count(*), 1)     AS pct_of_lines,
       round(sum(l.discount)/100.0, 2)                                     AS total_given,
       count(*) FILTER (WHERE l.discount > 0 AND l.discount_reason IS NULL) AS without_reason
FROM sale_line l
JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN "user" u ON u.id=s.cashier_id
WHERE s.shop_id=$1 AND s.sold_at >= now() - interval '90 days'
GROUP BY 1,2 ORDER BY total_given DESC;
```

Read this carefully and fairly. A high rate may be shift allocation, a
misconfigured promotion, or an unclear policy — **investigate before concluding
anything about a person**. Normalise by transactions handled first.

Discounts without a recorded reason are the finding to act on: they are
unauditable, and an unauditable financial concession is an internal control
failure regardless of intent.

### Detect the patterns worth investigating

```sql
-- Repeated discounts to the same customer by the same staff member
SELECT u.name AS staff, c.name AS customer, count(*) AS discounted_sales,
       round(sum(l.discount)/100.0, 2) AS total_discount
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN "user" u ON u.id=s.cashier_id JOIN customer c ON c.id=s.customer_id
WHERE l.discount > 0 AND s.shop_id=$1 AND s.sold_at >= now()-interval '180 days'
GROUP BY 1,2 HAVING count(*) >= 5 ORDER BY total_discount DESC;
```

This is a **question, not an accusation** — it may be a legitimate trade customer.
Route findings that suggest deliberate abuse to the human, privately, never into
a dashboard.

### Do not train customers to wait

The most expensive long-term cost, and it is invisible in any single period.

A shop that discounts the same category every month teaches customers never to
pay full price for it. The reference price drops permanently, and full-price
sales in that category never recover.

- Vary the mechanic and the timing; avoid a predictable cycle
- Prefer targeted, personal offers over shop-wide ones
- Use value-adds instead of price cuts where possible — see `offer-strategy`
- Watch the share of sales made at full price:

```sql
SELECT date_trunc('month', s.sold_at)::date AS month,
       round(100.0 * count(*) FILTER (WHERE l.discount = 0) / count(*), 1) AS pct_lines_at_full_price
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE s.shop_id=$1 GROUP BY 1 ORDER BY 1;
```

A declining full-price share is habituation in progress.

### Alternatives before discounting

- Improve availability of what sells — a stockout costs more than a discount
- Better placement — see `merchandising`
- Bundle rather than cut price
- Add value: delivery, guarantee, service
- Do nothing — some slow stock is better cleared later than discounted now

### Checklist

- [ ] Discount rate measured and trended
- [ ] Break-even volume computed before any discount
- [ ] Justification tested against the table
- [ ] Never discounting scarce fast movers
- [ ] Authority limits enforced in software, not policy
- [ ] Reason mandatory and recorded on every manual discount
- [ ] Cost floor enforced as a database constraint
- [ ] Discretionary discounting monitored, normalised before interpretation
- [ ] Unauditable discounts treated as a control failure
- [ ] Abuse patterns escalated privately, not published
- [ ] Full-price share tracked for habituation
- [ ] Alternatives considered first
- [ ] Human approval for policy changes

## References

- **National Retail Federation — promotional depth and margin impact**
  <https://nrf.com/research>
- **Byron Sharp, _How Brands Grow_** — the limited long-term effect of price
  promotion, and reference-price erosion
- **PCI DSS v4.0 Requirement 10 / general internal control practice** — audit
  trails for financial concessions
  <https://www.pcisecuritystandards.org/document_library/>

**Not sourced — written for this framework:** the SQL patterns, the break-even
calculation, the justified/not-justified table, the enforce-in-software authority
model, the habituation monitoring, and the investigate-fairly guidance.
