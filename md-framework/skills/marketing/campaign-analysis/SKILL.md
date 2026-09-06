---
name: campaign-analysis
version: 1.0.0
description: |
  Determine what a campaign actually caused — incrementality, control groups,
  attribution, and separating effect from coincidence. Use after a campaign, when
  deciding whether to repeat it, or when asked "did the campaign work". For the
  money calculation see campaign-roi.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Campaign Analysis

The only question worth answering: **what happened that would not have happened
anyway?** Sales during a campaign are not the campaign's effect — most of them
would have occurred regardless.

> **Before analysing:** load `project-database` and the campaign plan. If success
> criteria and a comparison were not defined before launch, say so — post-hoc
> analysis of an unplanned campaign is weak, and the honest answer may be "we
> cannot tell".

### Incrementality is the whole game

```
Observed sales during campaign         420 units
Expected without campaign (baseline)   310 units
Incremental                            110 units   ← the campaign's actual effect
```

A campaign that "sold 420 units" sold 110. Reporting the gross figure overstates
every campaign ever run, and leads to repeating ones that lost money.

### Establish the baseline properly, in this order

| Method | Strength | Use when |
|---|---|---|
| **Control group** | Strongest — same period, same conditions | Targeted campaigns where a holdout is possible |
| **Same period last year** | Good — controls for season | A year of history exists |
| **Pre-period trend extrapolation** | Moderate | Stable demand, no seasonality |
| Immediately preceding period | Weak — confounded by season | Last resort; say so |

**Hold back a random slice of the eligible audience.** It costs a little reach and
converts guessing into knowing:

```sql
SELECT g.assignment,
       count(DISTINCT g.customer_id)                                        AS customers,
       count(DISTINCT s.id)                                                 AS purchases,
       round(100.0 * count(DISTINCT s.customer_id)/count(DISTINCT g.customer_id), 1) AS response_rate_pct,
       round(sum(s.total)/100.0, 2)                                         AS revenue,
       round(sum(s.total)/nullif(count(DISTINCT g.customer_id),0)/100.0, 2) AS revenue_per_customer
FROM campaign_audience g
LEFT JOIN sale s ON s.customer_id=g.customer_id AND s.status='completed'
                AND s.sold_at BETWEEN $2 AND $3
WHERE g.campaign_id=$1
GROUP BY 1;
```

Revenue per customer, treated versus control, is the incremental effect. Compare
that, not the treated group against nothing.

### Watch for the effects that look like success

Four things routinely inflate an apparent result:

**Pull-forward** — customers bought earlier than they would have. Sales rise
during the campaign, then dip. Always look at the period **after**:

```sql
SELECT date_trunc('week', sold_at)::date AS week, round(sum(total)/100.0,2) AS revenue
FROM sale WHERE status='completed' AND shop_id=$1
  AND sold_at BETWEEN $2::date - interval '8 weeks' AND $2::date + interval '8 weeks'
GROUP BY 1 ORDER BY 1;
```

A campaign week up 40% followed by two weeks down 20% moved timing, not demand.

**Cannibalisation** — the promoted product sold, a substitute did not.

```sql
SELECT p.name,
       sum(l.quantity) FILTER (WHERE s.sold_at BETWEEN $2 AND $3) AS during,
       sum(l.quantity) FILTER (WHERE s.sold_at BETWEEN $2::date - interval '30 days' AND $2) AS before
FROM sale_line l JOIN sale s ON s.id=l.sale_id AND s.status='completed'
JOIN product p ON p.id=l.product_id
WHERE p.category_id=$4 AND s.shop_id=$1 GROUP BY 1;
```

Look at the whole category, not the promoted line.

**Subsidised base sales** — the discount went to people who would have paid full
price. This is where most promotional margin is lost, and a control group is the
only way to size it.

**Coincidence** — a festival, weather, a competitor closing, payday. Check what
else happened in the window before claiming credit.

### Report honestly

```markdown
## Campaign: Beverage reactivation — August

**Objective** Bring back lapsed beverage buyers. Target: 60 of 400 return.

**Result**
Treated (350)  — 71 purchased (20.3%), ₹31,200 revenue
Control  (50)  — 6 purchased  (12.0%), ₹4,100  revenue
Incremental response  +8.3pp → ~29 incremental customers
Incremental revenue   ₹31,200 − (₹4,100 × 7) = ₹2,500

**Effects checked**
- Post-period: no dip — not pull-forward
- Category: whole category up; no cannibalisation detected
- Coincidence: no festival or competitor event in the window

**Conclusion** The campaign worked, but the margin on ₹2,500 incremental
revenue is ₹800 against ₹1,400 of message costs and discount. It reached the
customer target and lost money. Repeat only with a cheaper mechanic.
```

**A campaign can hit its target and still lose money.** Say both — see
`campaign-roi`.

### When you cannot tell

Say so. Common cases:

- No control group and no comparable prior period
- Campaign coincided with a festival or an unrelated event
- Audience too small for the difference to mean anything
- Multiple campaigns overlapping, effects inseparable
- Data not captured — no campaign identifier on sales

"We cannot attribute this reliably; here is what we observed and why it is
ambiguous" is a legitimate and more useful answer than a confident wrong number.

### Feed it forward

- Record the result against the plan so the next campaign starts from evidence
- Note which mechanic, audience, and channel combination worked
- Note what did not, and stop repeating it
- Update response-rate assumptions used in planning

### Caveats

- Small audiences produce differences that are not real
- Response rate is not the same as incremental effect
- Repeat campaigns to the same audience decay in effectiveness
- Attribution across channels is guesswork without a control group
- Customers reached but not identified at purchase are invisible

### Checklist

- [ ] Plan and success criteria retrieved; absence noted if missing
- [ ] Baseline established by the strongest available method
- [ ] Control group compared on revenue per customer
- [ ] Pull-forward checked in the post-period
- [ ] Cannibalisation checked at category level
- [ ] Coincident events ruled out
- [ ] Incremental effect reported, not gross
- [ ] Statistical fragility of small audiences acknowledged
- [ ] Financial result stated alongside the objective result
- [ ] "Cannot tell" stated where true
- [ ] Learning recorded for the next campaign

## References

- **Standard direct marketing practice** — holdout control groups and
  incremental response measurement
- **National Retail Federation — promotional effectiveness measurement**
  <https://nrf.com/research>
- **Byron Sharp, _How Brands Grow_** — promotion effects, pull-forward, and the
  limits of loyalty targeting
- **PostgreSQL 16 documentation — `FILTER`, date arithmetic**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the baseline-method table, the four
inflating effects with their queries, the honest report format, and the
"when you cannot tell" list.
