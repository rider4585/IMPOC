---
name: campaign-roi
version: 1.0.0
description: |
  Calculate the financial return of a campaign — full cost accounting,
  incremental gross profit, and payback. Use after a campaign, when comparing
  campaigns, or when asked "was it worth it". Requires the incremental effect
  from campaign-analysis.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Campaign ROI

The financial verdict. `campaign-analysis` establishes what the campaign
**caused**; this establishes whether that was worth the money.

The two most common errors: using revenue instead of margin, and counting only
the obvious costs.

> **Before calculating:** obtain the incremental figures from
> `campaign-analysis`. ROI computed on gross sales rather than incremental
> margin is meaningless and will justify campaigns that lost money.

### The calculation

```
ROI = (Incremental gross profit − Total campaign cost) ÷ Total campaign cost
```

Every term matters:

- **Incremental**, not total — see `campaign-analysis`
- **Gross profit**, not revenue — a ₹50,000 uplift at 20% margin is ₹10,000
- **Total cost**, including the discount given away

```sql
-- Incremental gross profit from the treated group
SELECT round(sum(l.quantity*(l.unit_price - l.cost_price) - l.discount)/100.0, 2) AS gross_profit,
       round(sum(l.discount)/100.0, 2)                                            AS discount_given,
       count(DISTINCT s.id)                                                       AS purchases
FROM sale s
JOIN sale_line l ON l.sale_id=s.id
JOIN campaign_audience g ON g.customer_id=s.customer_id AND g.campaign_id=$1
WHERE g.assignment='treated' AND s.status='completed' AND s.sold_at BETWEEN $2 AND $3;
```

### Count every cost

The costs people forget are usually larger than the ones they remember.

| Cost | Often forgotten? |
|---|---|
| Message or media spend | No |
| **Discount given** | **Yes — usually the largest cost** |
| Free items or samples | Sometimes |
| Staff time — preparation, execution | **Almost always** |
| Signage, print, materials | Sometimes |
| Delivery or fulfilment concessions | Yes |
| Additional stock ordered that did not sell | **Yes — and it becomes dead stock** |
| Payment processing on incremental sales | Usually |

**The discount is a cost.** A "free" in-store promotion that gave away 20% margin
on 400 units has a real, computable cost — see `offer-strategy`.

Staff time is a genuine cost even in a small shop; an hour spent preparing a
promotion is an hour not spent selling.

### Worked example

```
Incremental revenue                        ₹52,000
Gross margin on those sales (28%)          ₹14,560   ← the actual benefit

Costs
  WhatsApp messages (400 × ₹0.85)             ₹340
  Discount given (12% on ₹52,000)           ₹6,240
  Staff time (4h)                             ₹800
  Signage                                     ₹500
  Unsold stock ordered for the campaign     ₹3,200
  Total                                     ₹11,080

Net gain    ₹14,560 − ₹11,080 = ₹3,480
ROI         ₹3,480 ÷ ₹11,080 = 31%
```

Positive, but modest — and it depended entirely on using the *incremental*
revenue. Had gross revenue been used, this would have looked like a triumph.

### Sanity checks

Before reporting, verify:

- **Is the incremental figure genuinely incremental?** Control group or
  equivalent baseline used
- **Is margin historical?** Using current cost restates the result — see
  `profit-analysis`
- **Is the window right?** Include the post-period so pull-forward is not counted
  as gain
- **Is unsold campaign stock counted?** It is a real cost, and often the one that
  turns a positive result negative

### ROI is not the only measure

Some campaigns are investments whose return arrives later:

| Campaign type | Judge on |
|---|---|
| Stock clearance | Cash released and space freed, not ROI |
| New product trial | Repeat purchase rate, not first-purchase profit |
| Reactivation | Whether reactivated customers stay — measure over months |
| Defensive | Retention among affected customers |

For reactivation, the honest measure is whether those customers are still
purchasing three and six months later. A campaign that brings someone back for
one discounted purchase and never again has negative long-run value.

```sql
-- Did reactivated customers stay?
SELECT count(*) FILTER (WHERE later_purchases > 0) AS retained,
       count(*)                                    AS reactivated
FROM (
  SELECT g.customer_id,
         count(*) FILTER (WHERE s.sold_at > $3::date + interval '30 days') AS later_purchases
  FROM campaign_audience g
  LEFT JOIN sale s ON s.customer_id=g.customer_id AND s.status='completed'
  WHERE g.campaign_id=$1 AND g.assignment='treated'
  GROUP BY 1 HAVING count(*) FILTER (WHERE s.sold_at BETWEEN $2 AND $3) > 0
) x;
```

### Compare campaigns on the same basis

```sql
SELECT c.name, c.channel,
       round(c.total_cost/100.0, 2)                                     AS cost,
       round(c.incremental_gross_profit/100.0, 2)                       AS gross_profit,
       round(100.0*(c.incremental_gross_profit - c.total_cost)
             / nullif(c.total_cost,0), 1)                               AS roi_pct
FROM campaign c WHERE c.shop_id=$1 AND c.ended_at >= now() - interval '365 days'
ORDER BY roi_pct DESC;
```

Only meaningful if every campaign was measured the same way — one measured with a
control group and another on gross sales are not comparable. Record the method
alongside the result.

### Report the verdict plainly

> "The campaign returned 31% — about ₹3,500 net on ₹11,000 spent. Most of the
> cost was the discount, not the messaging. A smaller discount to a narrower
> audience would likely do better. It hit its customer target, but the profit was
> marginal."

For a non-technical audience, state money before percentages.

### Checklist

- [ ] Incremental effect obtained from `campaign-analysis`, not gross sales
- [ ] Gross profit used, not revenue
- [ ] Historical cost used for margin
- [ ] Discount counted as a cost
- [ ] Staff time counted
- [ ] Unsold campaign stock counted
- [ ] Post-period included to catch pull-forward
- [ ] Long-run measure used for reactivation campaigns
- [ ] Non-ROI objectives judged on their own terms
- [ ] Comparisons made on a consistent measurement basis
- [ ] Verdict stated in money, plainly

## References

- **National Retail Federation — promotional ROI measurement**
  <https://nrf.com/research>
- **Standard direct marketing practice** — incremental profit over gross
  response as the basis for return
- **Peter Fader, _Customer Centricity_** — long-run customer value over
  single-campaign response
- **IAS 2 — Inventories** — cost basis for the margin used here
  <https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/>

**Not sourced — written for this framework:** the full cost table with the
frequently-forgotten column, the worked example, the campaign-type judging table,
the reactivation retention query, and the comparability requirement.
