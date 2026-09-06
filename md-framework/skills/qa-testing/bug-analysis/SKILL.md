---
name: bug-analysis
version: 1.0.0
description: |
  Investigate a reported defect — reproduce it, isolate the cause, assess
  severity and blast radius, and write a report an engineer can act on. Use when
  a bug is reported, when triaging, or when asked "what is actually going wrong
  here". Produces a report and routing, not a fix.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Bug Analysis

A bug report's value is entirely in its precision. "Sales are wrong sometimes"
costs a day of investigation; a minimal reproduction with expected and actual
values costs an hour to fix.

**You analyse and report. You do not fix** — that keeps the investigation honest
and the fix reviewable.

### Reproduce first

An unreproduced bug cannot be verified as fixed. Before anything else, establish:

1. **Exact steps** — every one, in order, including data used
2. **Expected result** — from the acceptance criteria or the business rule, cited
3. **Actual result** — precisely, with real values
4. **Frequency** — always, or intermittent? Intermittent almost always means
   concurrency, timing, or state
5. **Environment** — role, shop, device, browser, viewport

If it cannot be reproduced, say so explicitly and record what was tried. Do not
guess at a cause.

### Reduce to the minimum

Strip everything that does not change the outcome. Each removal is information.

```
Reported: "Voiding a sale from the history page after filtering by date
           sometimes leaves stock wrong"

Minimised: Voiding any sale containing a product that was sold twice in the
           same transaction restores stock once, not twice.
           → the filter, the page, and the date are all irrelevant
```

The minimal reproduction usually names the cause.

### Isolate the layer

Work down the stack until the defect stops appearing.

| Question | Tells you |
|---|---|
| Does the API return the wrong data? | Backend or frontend |
| Is the stored data wrong, or just the display? | Write path or read path |
| Does it happen with one user only? | Permissions or tenancy |
| Only under load or with two users? | Concurrency |
| Only after a specific earlier action? | State or sequence |
| Only on one device or viewport? | Frontend or responsive |

```bash
grep -rn "voidSale\|restoreStock" src/ --include=*.js
git log -S "restoreStock" --oneline | head          # when did this change?
git log --oneline -20 -- src/features/sales/
```

`git log -S` searching for the relevant symbol is the fastest way to find when a
behaviour changed and what else changed with it.

### Assess severity honestly

| Severity | Meaning | Examples |
|---|---|---|
| `CRITICAL` | Money or stock incorrect; data loss; security exposure | Double charge, stock drift, cross-tenant access |
| `HIGH` | Core workflow blocked, no workaround | Cannot complete a sale |
| `MEDIUM` | Workflow impaired, workaround exists | Report wrong, correctable manually |
| `LOW` | Minor or cosmetic | Misaligned label |

**Anything producing a wrong money or stock number is `CRITICAL`**, even if it
looks small and even if it happens rarely. Those defects compound silently and
are discovered at reconciliation, when the cost of correction is highest.

### Assess the blast radius

Beyond the fix, establish what has already been affected:

- **How many records are wrong?** Query for them.
- **How long has this been happening?** Use `git log` to date the change.
- **Is existing data corrupted, or only new operations affected?**
- **Do downstream reports need correcting?**

```sql
-- Example: sales whose header total disagrees with their lines
SELECT s.id, s.total, sum(l.quantity * l.unit_price) AS computed
FROM sale s JOIN sale_line l ON l.sale_id = s.id
GROUP BY s.id, s.total
HAVING s.total <> sum(l.quantity * l.unit_price);
```

**Corrupted data is a separate work item from the code fix**, and needs human
approval — see `data-integrity`. Fixing the code without correcting the records
leaves the damage in place.

### The report

```markdown
## BUG-042: Stock restored once for duplicated products on void

**Severity:** CRITICAL — stock quantity incorrect
**Frequency:** Always, when a sale contains the same product on two lines
**Affects:** All shops; introduced 2026-08-14 (commit a1b2c3d)

**Reproduce**
1. Create a sale with two lines of the same product, 2 units each
2. Complete the sale — stock decreases by 4  ✓
3. Void the sale
4. Stock increases by 2, not 4

**Expected** Stock restored by the full sold quantity (BR-stock-012)
**Actual**   Restored once per distinct product, not per line

**Evidence**  src/features/sales/sale.service.js:142 — reduces lines by
              productId before restoring
**Blast radius** 37 affected sales since 2026-08-14 (query attached);
              stock counts for 12 products are understated
**Route to**  backend-engineer (fix) + human (data correction approval)
```

### After the fix

- **Verify against the original reproduction**, not the fix description
- **Confirm a regression test exists** — a fix without one will be reintroduced
- **Check for the same class elsewhere.** A bug is rarely unique; if lines were
  deduplicated here, look for the same pattern in refunds and reports
- **Feed the case into `edge-case-analysis`** so it becomes a standing check
- If the same class appears three times, escalate to `architect` — it is
  systemic, not three bugs

### Checklist

- [ ] Reproduced reliably, or non-reproduction explicitly recorded
- [ ] Reduced to a minimal case
- [ ] Layer isolated
- [ ] Introducing change identified where possible
- [ ] Severity assigned; money/stock defects rated `CRITICAL`
- [ ] Blast radius quantified with a query
- [ ] Data corruption raised as a separate, human-approved work item
- [ ] Report contains steps, expected, actual, evidence, and routing
- [ ] Fix verified against the original reproduction
- [ ] Regression test confirmed
- [ ] Same class searched for elsewhere
- [ ] Recurring classes escalated as systemic

## References

- **ISTQB Foundation Level syllabus** — defect reporting content and severity
  versus priority <https://www.istqb.org/>
- **ISO/IEC/IEEE 29119-3** — incident report structure
- **Andreas Zeller, _Why Programs Fail_** — systematic reduction and isolation
- **Elisabeth Hendrickson, _Explore It!_** — reproduction and variation technique

**Not sourced — written for this framework:** the severity table with the
money/stock `CRITICAL` rule, the blast-radius quantification step with its
reconciliation query, the report template, and the systemic-escalation rule.
