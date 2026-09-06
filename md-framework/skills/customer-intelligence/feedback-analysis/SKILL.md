---
name: feedback-analysis
version: 1.0.0
description: |
  Turn customer feedback into decisions — collecting, categorising, weighting,
  and prioritising what customers tell you. Use when reviewing feedback, when
  deciding what to fix or stock next, or when asked "what are customers saying".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Feedback Analysis

Feedback is cheap to collect and easy to misread. The two failure modes are
ignoring it and over-reacting to it — one loud complaint is not a trend, and a
quiet recurring theme often is.

> **Before running anything:** load `project-database` and confirm whether
> feedback is captured at all, and in what form. If there is no feedback table,
> say so and recommend a capture mechanism before analysis.

### Sources, and their biases

| Source | Bias |
|---|---|
| Written feedback / reviews | Skews to extremes — very happy or very angry |
| Complaints | Only the problems, and only from people who bother |
| Staff-reported comments | Filtered by what staff remember and choose to pass on |
| Direct conversation | Richest, least systematic |
| Behaviour (returns, churn) | Unbiased, but silent about cause |

**Behaviour is the most reliable signal.** What customers do — stop coming,
return items, abandon a purchase — is more trustworthy than what they say. Use
stated feedback to explain behavioural signals, not to replace them.

The silent majority never gives feedback. Never treat the feedback set as
representative of customers.

### Categorise consistently

Free text cannot be prioritised. Assign each item to a stable set of categories,
and keep the set small:

```
product-quality · product-range · price · availability · service
staff · store-environment · checkout-speed · payment · other
```

Record for each item: category, sentiment, whether it is actionable, the product
or category if relevant, and the date.

```sql
SELECT category,
       count(*)                                             AS items,
       count(*) FILTER (WHERE sentiment = 'negative')       AS negative,
       count(*) FILTER (WHERE is_actionable)                AS actionable,
       max(created_at)::date                                AS most_recent
FROM feedback
WHERE shop_id=$1 AND created_at >= now() - interval '90 days'
GROUP BY 1 ORDER BY negative DESC;
```

### Weight by frequency and cost, not volume of words

A single articulate complaint can dominate attention unfairly. Prioritise by:

**Frequency × impact × fixability**

| Signal | Weight |
|---|---|
| Repeated by several customers | High — a pattern, not a preference |
| Concerns availability or price of a top-selling line | High — affects many, measurable |
| Concerns a one-off incident | Low unless it recurs |
| Cheap and quick to fix | Raise priority |
| Requires a structural change | Route to planning, not to a quick fix |

The most valuable feedback is the **quietly repeated** kind — three people
mentioning the same missing product is worth more than one long complaint about a
single bad day.

### Corroborate against the data

Feedback becomes actionable when it is confirmed in behaviour.

```sql
-- "You never have X" — check whether that is true
SELECT p.name,
       count(*) FILTER (WHERE sm.quantity_after = 0) AS zero_stock_events,
       max(s.sold_at)::date                          AS last_sold
FROM product p
LEFT JOIN stock_movement sm ON sm.product_id=p.id AND sm.created_at >= now()-interval '90 days'
LEFT JOIN sale_line l ON l.product_id=p.id
LEFT JOIN sale s ON s.id=l.sale_id AND s.status='completed'
WHERE p.shop_id=$1 AND p.name ILIKE $2
GROUP BY 1;
```

"Checkout is slow" → check transaction duration. "Prices went up" → check the
price history. Feedback plus data is a finding; feedback alone is a hypothesis.

### Close the loop

Feedback that produces no visible response stops arriving.

- Acknowledge, especially complaints — see `complaint-analysis`
- Where a change was made **because** of feedback, say so publicly. It is the
  cheapest way to encourage more
- Track what was fixed, so the same issue is not re-litigated

### Report it usefully

```markdown
## Feedback — last 90 days (n = 47, from ~2,400 transactions)

**Themes**
1. Product availability (14 mentions) — 9 name the same three products,
   all of which had 10+ zero-stock days. Confirmed in data.
2. Checkout speed (8) — concentrated Saturday mornings, matching the
   busiest hour with the same staffing as Tuesday.
3. Price (6) — general, not tied to specific lines. Not corroborated.

**Recommended**
- Raise reorder points on the three named products (cheap, confirmed)
- Add a second till Saturday 10:00–13:00 (confirmed by transaction data)

**Not recommended yet**
- Price changes — feedback is not specific and margin is already thin

**Caveat** 47 responses from 2,400 transactions is ~2%, skewed to
customers with strong opinions.
```

Lead with what is **corroborated**, separate what is not, and always state the
response rate.

### Caveats

- Response rate and its skew, stated every time
- Recency bias: recent feedback feels more urgent than it is
- Vocal minority effects
- Staff-relayed feedback is filtered
- Seasonal complaints (queues at festival time) may be normal, not a defect

### Checklist

- [ ] Feedback capture mechanism confirmed to exist
- [ ] Source biases acknowledged
- [ ] Consistent, small category set applied
- [ ] Themes counted by frequency, not by length or volume
- [ ] Each theme corroborated against transaction or stock data
- [ ] Uncorroborated themes clearly separated
- [ ] Prioritised by frequency × impact × fixability
- [ ] Response rate stated as a proportion of transactions
- [ ] Recommendations tied to specific, checkable actions
- [ ] Loop closed — changes attributed back to feedback

## References

- **Nielsen Norman Group — the limits of self-reported data** — why behaviour
  outranks stated preference
  <https://www.nngroup.com/articles/first-rule-of-usability-dont-listen-to-users/>
- **Fred Reichheld — customer feedback and the follow-up loop**
- **National Retail Federation — customer experience measurement**
  <https://nrf.com/research>

**Not sourced — written for this framework:** the source-bias table, the
corroboration requirement, the frequency × impact × fixability weighting, the
report template, and the mandatory response-rate disclosure.
