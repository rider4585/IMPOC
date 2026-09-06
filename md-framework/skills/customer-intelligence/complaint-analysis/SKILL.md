---
name: complaint-analysis
version: 1.0.0
description: |
  Analyse complaints for root cause and pattern — categorisation, severity,
  recurrence, and resolution tracking. Use when reviewing complaints, when the
  same problem recurs, or when asked "what are people complaining about".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Complaint Analysis

A complaint is a customer telling you what is broken, at their own cost. Most
dissatisfied customers say nothing and simply stop coming — so each complaint
represents many silent ones.

> **Before running anything:** load `project-database` and confirm complaints are
> recorded. If they are only remembered by staff, recommend capture first — an
> unrecorded complaint cannot be analysed or followed up.

### Categorise by cause, not by symptom

The customer describes a symptom; the analysis needs the cause.

| Symptom | Possible causes |
|---|---|
| "Wrong price at the till" | Shelf label stale, price change not propagated, promotion misconfigured |
| "You never have it" | Stockout, delisted, misplaced on shelf |
| "Product was bad" | Supplier quality, expired stock on shelf, storage |
| "Checkout took forever" | Understaffed at that hour, scanner failure, system slowness |
| "Charged twice" | **Duplicate payment — a system defect, escalate** |
| "Refund refused" | Policy unclear, staff untrained, policy actually wrong |

Two of these route out of business analysis entirely: a double charge is a
`concurrency`/idempotency defect, and a stale shelf price may be a pricing
propagation bug. **Escalate those to `michael` as system findings**, not as
customer service items.

### Severity

| Level | Meaning | Response |
|---|---|---|
| `CRITICAL` | Financial harm, safety, or legal exposure | Immediate; owner informed |
| `HIGH` | Customer likely lost; significant inconvenience | Same day |
| `MEDIUM` | Real dissatisfaction, recoverable | Within days |
| `LOW` | Minor irritation | Log, look for pattern |

Charged twice, sold expired food, or refused a lawful refund are `CRITICAL` — not
because the customer is angry, but because of the exposure.

### Find the patterns

One complaint is an incident. Three of the same kind is a process failure.

```sql
SELECT category, subcategory,
       count(*)                                       AS complaints,
       count(DISTINCT customer_id)                    AS distinct_customers,
       min(created_at)::date                          AS first_seen,
       max(created_at)::date                          AS last_seen,
       count(*) FILTER (WHERE resolved_at IS NULL)    AS unresolved
FROM complaint
WHERE shop_id=$1 AND created_at >= now() - interval '180 days'
GROUP BY 1,2 HAVING count(*) >= 3
ORDER BY complaints DESC;
```

Then check whether they concentrate:

```sql
SELECT extract(dow FROM created_at) AS day_of_week,
       extract(hour FROM created_at) AS hour,
       count(*) AS complaints
FROM complaint WHERE shop_id=$1 AND created_at >= now()-interval '180 days'
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10;
```

Complaints clustered at one hour or one day usually mean **staffing**, not
attitude — check it against the transaction volume for that hour before drawing
any conclusion about people.

### Root cause, not blame

Ask why repeatedly until you reach something fixable by a change to a process or
the system:

```
"Customer charged the wrong price"
  → the shelf label said ₹45, the till charged ₹52
  → the price changed on Tuesday; labels were not reprinted
  → there is no report of price changes needing new labels
  → ROOT CAUSE: no linkage between a price change and label reprinting
  → FIX: a "price changed since last label print" report
```

A root cause that ends at a person ("staff error") is usually incomplete. Ask
what made the error easy — see `usability-review` and the error-prevention
guidance in `interaction-design`.

### Resolution tracking

An unresolved complaint is worse than none — it confirms the customer's view that
nobody cares.

```sql
SELECT count(*) FILTER (WHERE resolved_at IS NULL)                       AS open,
       count(*) FILTER (WHERE resolved_at IS NULL
                          AND created_at < now() - interval '7 days')    AS open_over_7_days,
       round(avg(extract(day FROM resolved_at - created_at)) FILTER (WHERE resolved_at IS NOT NULL), 1)
                                                                          AS avg_days_to_resolve
FROM complaint WHERE shop_id=$1 AND created_at >= now() - interval '90 days';
```

Track whether complainants return afterwards — a resolved complaint often
produces a **more** loyal customer than one who never complained, and an
unresolved one produces a permanent loss.

```sql
-- Did complainants come back?
SELECT count(*) FILTER (WHERE returned) AS returned, count(*) AS complainants
FROM (
  SELECT c.customer_id,
         EXISTS (SELECT 1 FROM sale s WHERE s.customer_id=c.customer_id
                   AND s.status='completed' AND s.sold_at > c.created_at) AS returned
  FROM complaint c WHERE c.shop_id=$1 AND c.created_at >= now()-interval '180 days'
) x;
```

### Report it as fixes, not as a list

```markdown
## Complaints — 180 days (n = 23)

**Patterns**
1. Wrong price at till (7) — all following price changes; labels not reprinted.
   ROOT CAUSE: no price-change-to-label linkage.  FIX: reprint report.
2. Long queue (5) — all Saturday 10:00–12:00, the busiest hour, single till.
   FIX: second till at that hour.
3. **Charged twice (2) — SYSTEM DEFECT.** Escalated to michael; see
   idempotency on payment.

**Resolution** 19 of 23 resolved, average 3.2 days. 4 open, 2 over a week.
**Return rate** 15 of 21 identified complainants purchased again.
```

### Caveats

- Complaints are a small, self-selected sample of dissatisfaction
- Absence of complaints is not satisfaction
- Staff may under-record complaints that reflect on them — check whether the
  count is plausible against transaction volume
- Seasonal peaks in queue complaints may be capacity, not process failure

### Checklist

- [ ] Complaint capture confirmed to exist
- [ ] Categorised by cause, not symptom
- [ ] System defects escalated rather than treated as service issues
- [ ] Severity assigned; financial and safety issues rated `CRITICAL`
- [ ] Recurring patterns identified (three or more)
- [ ] Time and day clustering checked against volume before blaming staff
- [ ] Root cause pursued to a process or system change
- [ ] Open and overdue complaints reported
- [ ] Return rate of complainants measured
- [ ] Output framed as fixes with root causes

## References

- **TARP / customer service research** — the ratio of silent dissatisfied
  customers to complainants, and the loyalty effect of good resolution
- **Fred Reichheld, _The Loyalty Effect_** — service recovery and retention
- **Root cause analysis (5 Whys)** — Toyota Production System practice
- **PostgreSQL 16 documentation — `FILTER`, `EXISTS`**
  <https://www.postgresql.org/docs/16/functions-aggregate.html>

**Not sourced — written for this framework:** the symptom-to-cause table, the
escalation rule for system defects, the severity mapping, the worked root-cause
chain, and the report format.
