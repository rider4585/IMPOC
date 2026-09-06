---
name: campaign-planning
version: 1.0.0
description: |
  Plan a marketing campaign end to end — objective, audience, offer, channel,
  budget, and how success will be measured. Use before running any promotion or
  outreach, or when asked "should we run a campaign" or "how do we promote this".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Campaign Planning

A campaign is an investment with an expected return. Most retail campaigns fail
not in execution but in planning: no clear objective, no defined audience, and no
way to tell afterwards whether it worked.

> **Before planning:** load `project-database`. Every element below should be
> grounded in data the shop already has — see `customer-segmentation`,
> `product-velocity`, and `seasonal-analysis`.

### Start with the objective, and make it measurable

| Objective | Measure |
|---|---|
| Clear specific stock | Units of those products sold |
| Bring lapsed customers back | Lapsed customers who purchased |
| Raise basket size | Average basket among targeted customers |
| Drive trial of a new line | First-time purchasers of that line |
| Increase visit frequency | Repeat rate in the period |
| Defend against a competitor | Retention among affected customers |

**One objective per campaign.** A campaign trying to clear stock *and* acquire
customers *and* raise basket size will achieve none of them measurably, because
the offer needed for each is different.

State the target number before starting: "sell 200 of the 340 units held", not
"move some stock".

### Define the audience narrowly

Everyone is not an audience. Use segmentation:

| Objective | Audience |
|---|---|
| Clear stock | Customers who bought this or an adjacent category |
| Reactivate | Lapsed but previously regular — see `customer-retention` |
| Raise basket | Frequent buyers with small baskets |
| Trial | Buyers of the closest existing product |

```sql
-- Example: lapsed regulars who bought the target category
SELECT c.id, c.name, c.phone, max(s.sold_at)::date AS last_purchase
FROM customer c JOIN sale s ON s.customer_id=c.id AND s.status='completed'
JOIN sale_line l ON l.sale_id=s.id JOIN product p ON p.id=l.product_id
WHERE c.shop_id=$1 AND p.category_id=$2 AND c.marketing_consent
GROUP BY c.id, c.name, c.phone
HAVING max(s.sold_at) < now() - interval '60 days' AND count(DISTINCT s.id) >= 3;
```

**Filter on marketing consent in the query**, not afterwards. See
`whatsapp-campaigns` for the compliance rules.

A narrower audience with a relevant offer beats a broad one with a generic
discount, and costs less.

### Design the offer around margin

The offer must be affordable. Work out the margin cost **before** committing —
see `offer-strategy` and `discount-strategy`.

```
Product margin        32%
Proposed discount     20%
Remaining margin      12%
Break-even uplift     required volume increase to hold gross profit flat
```

If the campaign needs a 2.5× volume increase merely to break even, it is not a
campaign — it is a loss with marketing attached.

Prefer offers that do not cut price on things that would sell anyway: bundles,
threshold offers, and added value over blanket percentage discounts.

### Choose the channel by audience and cost

| Channel | Good for | Cost | Note |
|---|---|---|---|
| In-store signage | Everyone already visiting | Near zero | Start here — it is free and immediate |
| Till prompt | Basket-building at the moment of purchase | Near zero | One suggestion only |
| WhatsApp | Direct, high open rate | Per message | **Consent required** — see `whatsapp-campaigns` |
| SMS | Direct, broad reach | Per message | Consent and DND rules apply |
| Social media | Awareness, local reach | Time | See `social-media-strategy` |
| Local print / flyer | Non-digital customers | Moderate | Hard to attribute |

**Exhaust the free channels first.** A shop with existing footfall usually has
more to gain from better in-store execution than from paid outreach.

### Check stock before promoting

The most common self-inflicted campaign failure: promoting something and running
out on day two.

```sql
SELECT p.name, coalesce(st.quantity,0) AS stock_now,
       round(sum(l.quantity)/90.0, 2)  AS normal_daily_rate,
       round(coalesce(st.quantity,0) / nullif(sum(l.quantity)/90.0, 0), 1) AS days_at_normal_rate
FROM product p LEFT JOIN stock st ON st.product_id=p.id
LEFT JOIN sale_line l ON l.product_id=p.id
LEFT JOIN sale s ON s.id=l.sale_id AND s.status='completed' AND s.sold_at >= now()-interval '90 days'
WHERE p.id = ANY($2) GROUP BY p.name, st.quantity;
```

A promotion typically lifts demand well above the normal rate. If there is only a
week of stock at the normal rate, there is not enough for a promotion —
see `reorder-analysis`.

### Plan the measurement before launching

Decide **now** how success will be judged, or the campaign will be evaluated by
whether it felt busy:

- The metric, and the target
- The comparison — prior equivalent period, or a non-targeted control group
- The window, including any lag
- Which costs count — see `campaign-roi`

**A control group is the only reliable comparison.** Holding back a random slice
of the eligible audience costs a little reach and is the difference between
knowing and guessing.

### The plan

```markdown
# Campaign: <name>
## Objective        — one, with a numeric target
## Audience         — definition, size, consent status
## Offer            — mechanic, margin cost, break-even uplift
## Channel          — and why
## Stock check      — units held vs expected demand
## Timing           — dates, and why this window
## Budget           — message costs, discount cost, staff time
## Measurement      — metric, comparison, control group, window
## Risks            — stockout, margin erosion, discount habituation
## Approval         — required for anything affecting price or margin
```

**Anything changing price or discount requires human approval** — it is a
financial decision, not a marketing one.

### Common failure modes

| Failure | Prevention |
|---|---|
| No measurable objective | Numeric target set before launch |
| Discounting what would sell anyway | Target the specific audience and product |
| Running out mid-campaign | Stock check against uplifted demand |
| No control group | Hold back a random slice |
| Training customers to wait for discounts | Vary the mechanic; avoid predictable cycles |
| Contacting people without consent | Filter on consent in the query |

The discount-habituation risk is the most underrated: a shop that discounts the
same category every month teaches customers never to pay full price for it.

### Checklist

- [ ] Single objective with a numeric target
- [ ] Audience defined from data, filtered on marketing consent
- [ ] Offer costed; break-even uplift computed
- [ ] Free channels considered before paid
- [ ] Stock checked against uplifted demand
- [ ] Measurement, comparison, and control group defined before launch
- [ ] Budget includes discount cost and staff time, not just messaging
- [ ] Timing checked against seasonality
- [ ] Human approval obtained for price or discount changes
- [ ] Habituation risk considered

## References

- **National Retail Federation — promotional planning and measurement**
  <https://nrf.com/research>
- **Byron Sharp, _How Brands Grow_** — reach, and the limits of loyalty-only
  targeting
- **Standard direct marketing practice** — control groups and holdout testing
- **RFM segmentation** — audience selection by recency and value

**Not sourced — written for this framework:** the objective-to-measure table, the
break-even uplift requirement, the stock-check-before-promoting rule, the channel
table with free-first guidance, and the failure-mode table.
