---
name: recurring-requests
version: 1.0.0
description: |
  Capture and evaluate requests for products you do not stock — logging, counting
  repetition, and deciding what is worth listing. Use when deciding what to add
  to the range, when customers keep asking for something, or when asked "what
  should we start stocking".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Recurring Requests

The one thing transaction data can never tell you: **what customers wanted that
you did not have**. A request is the only visible trace of a sale that did not
happen.

> **Before running anything:** load `project-database` and confirm requests are
> captured. If they are not, that is the finding — recommend a capture mechanism
> before anything else, because this data cannot be reconstructed later.

### Capture is the hard part

Most requests are made verbally at the counter and forgotten within minutes. Any
analysis depends entirely on staff logging them, so the mechanism must be
near-zero effort:

- A single field on the till screen — product name and nothing else mandatory
- Two taps maximum, in the middle of serving someone
- Optional customer link, never required
- No approval or categorisation at capture; do that later

**If capture takes more than a few seconds, it will not happen during a queue.**
Anything more elaborate produces a clean, empty dataset. See `ui-design`.

Also capture **failed barcode scans** — a scan for an unknown product is an
implicit request, logged for free:

```sql
SELECT scanned_code, count(*) AS times_scanned,
       max(created_at)::date AS last_scanned
FROM unknown_scan
WHERE shop_id=$1 AND created_at >= now() - interval '180 days'
GROUP BY 1 HAVING count(*) >= 3
ORDER BY 2 DESC;
```

A barcode scanned repeatedly and never found is a product customers are bringing
to your counter expecting you to sell.

### Count repetition, not volume

```sql
SELECT normalised_name,
       count(*)                        AS times_requested,
       count(DISTINCT customer_id)     AS distinct_customers,
       count(DISTINCT requested_by)    AS staff_reporting,
       min(created_at)::date           AS first_asked,
       max(created_at)::date           AS last_asked
FROM product_request
WHERE shop_id=$1 AND created_at >= now() - interval '365 days'
GROUP BY 1 ORDER BY distinct_customers DESC, times_requested DESC;
```

**`distinct_customers` is the number that matters.** One customer asking ten
times is one customer; five customers asking once each is a pattern.

Free text needs normalising — "coke zero", "Coke Zero", "diet coke zero" are one
request. Normalise on a schedule rather than at capture, so capture stays fast.

### Evaluate before listing

A request is not demand. Work through this before adding a line:

| Question | Why |
|---|---|
| How many **distinct** customers asked? | Three or more is a signal |
| Over what period? | Five in a week may be one event; five over six months is steady |
| Is it a substitute for something we stock? | May be a preference, not a gap |
| Can we source it, at what cost and minimum order? | Supplier minimums often decide it |
| What margin does it carry? | A requested product at 4% margin may not be worth the shelf |
| What shelf space does it displace? | Range is finite — something else goes |
| Is it seasonal or a passing trend? | Timing changes the decision |
| Has it been tried before and delisted? | **Check first** — it may have failed already |

That last check is easily missed and embarrassing:

```sql
SELECT name, created_at::date AS listed, deleted_at::date AS delisted,
       (SELECT sum(quantity) FROM sale_line l WHERE l.product_id=p.id) AS lifetime_units
FROM product p WHERE p.shop_id=$1 AND p.name ILIKE $2 AND p.deleted_at IS NOT NULL;
```

### Trial rather than commit

Where the signal is reasonable but not conclusive:

- Order the **supplier minimum**, not an optimistic quantity
- Set a **trial period** in advance — one purchasing cycle or one season
- Tell the customers who asked; they are your first buyers and it costs nothing
- Decide the exit before you start: what happens to unsold units

```sql
-- Did trialled products actually sell?
SELECT p.name, p.created_at::date AS listed,
       coalesce(sum(l.quantity), 0) AS units_sold,
       coalesce(st.quantity, 0)     AS still_held
FROM product p
LEFT JOIN sale_line l ON l.product_id=p.id
LEFT JOIN sale s ON s.id=l.sale_id AND s.status='completed'
LEFT JOIN stock st ON st.product_id=p.id
WHERE p.shop_id=$1 AND p.created_at >= now() - interval '180 days'
GROUP BY p.name, p.created_at, st.quantity
ORDER BY units_sold;
```

**Measure the outcome of requested products specifically.** If products added on
request consistently fail to sell, the signal is weaker than it appears and the
threshold should rise.

### Close the loop with the customer

- Tell the person who asked when it arrives — the cheapest, most effective
  loyalty gesture available
- If you will not stock it, say so; an honest "we can't get that" is better than
  repeated asking
- Where possible, offer the nearest substitute at the time of asking

Requests that produce no visible response stop being made, and then this data
disappears.

### Caveats

- Capture rate is unknown and probably low — never treat the log as complete
- Staff report unevenly; a spike may be one attentive person starting to log
- Verbal requests skew to confident customers
- One-off requests for unusual items are not a range gap
- Requests during a stockout are for something you **do** stock — check before
  listing a duplicate

### Checklist

- [ ] Capture mechanism exists and is near-zero effort
- [ ] Failed barcode scans logged as implicit requests
- [ ] Free text normalised before counting
- [ ] Ranked by distinct customers, not total mentions
- [ ] Checked whether the item was previously listed and delisted
- [ ] Checked whether requests coincide with a stockout of something stocked
- [ ] Sourcing, minimum order, margin, and displaced shelf space evaluated
- [ ] Trial quantity and period set in advance, with an exit
- [ ] Requesting customers told when it arrives
- [ ] Outcomes of requested products measured and fed back into the threshold
- [ ] Capture-rate limitation stated

## References

- **National Retail Federation — assortment planning and range gap analysis**
  <https://nrf.com/research>
- **APICS / ASCM Dictionary** — lost sales and unmet demand terminology
- **Nielsen Norman Group — the cost of high-friction data capture**
  <https://www.nngroup.com/articles/usability-testing-101/>

**Not sourced — written for this framework:** the capture-must-be-two-taps rule,
using failed barcode scans as implicit requests, the evaluation table, the
previously-delisted check, and the trial-with-a-stated-exit approach.
