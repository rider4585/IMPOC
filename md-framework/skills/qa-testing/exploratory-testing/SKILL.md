---
name: exploratory-testing
version: 1.0.0
description: |
  Find defects that scripted tests cannot — simultaneous learning, test design,
  and execution, structured by charters and session notes. Use on new or heavily
  changed areas, after an unexpected production defect, or when asked to "have a
  proper look at this".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Exploratory Testing

Scripted tests verify what you already thought of. Exploratory testing finds what
nobody thought of — which is where the surprising defects are.

It is **structured**, not random. The structure is the charter and the notes;
without them it is undirected clicking that cannot be reviewed or repeated.

### Charters

A charter is a mission with a boundary and a timebox — typically 60–90 minutes.

```
Explore   the void and refund flow
With      a manager account and sales containing duplicate products
To discover  incorrect stock restoration and missing audit records
```

Good charters are specific enough to direct attention and open enough to allow
discovery. "Test the app" is not a charter; "explore what happens when a sale is
modified from two tabs" is.

Prioritise charters where risk is highest and coverage weakest: new features,
recently changed code, areas with a defect history, and anything touching money
or stock.

### Heuristics that generate ideas

When you run out of things to try, apply a heuristic rather than stopping.

| Heuristic | Try |
|---|---|
| **Interruption** | Refresh, back button, close mid-flow, lose network |
| **Repetition** | Do it twice, ten times, double-click everything |
| **Sequence** | Do steps out of order; skip a step |
| **Concurrency** | Two tabs, two users, same record |
| **Boundaries** | Zero, one, maximum, one over |
| **Extremes** | Very long text, huge quantities, thousands of rows |
| **Permissions** | The same flow as every other role |
| **Time** | Across midnight, month end, a promotion boundary |
| **Stale state** | Load a page, change data elsewhere, then act |
| **Never-done** | The thing the design clearly did not anticipate |

**Follow the smell.** When something looks slightly off — an odd number, a slow
response, a flicker — stop and dig. Those are usually the surface of a real
defect.

### Retail charters worth running

- Two tills selling the same last unit, simultaneously
- Void a sale while a refund for it is being processed
- Scan the same barcode repeatedly, very fast
- Close a shift while a sale is open on another till
- Apply a promotion that expires during checkout
- Return an item bought under a since-deleted product
- Payment fails after stock is committed
- Network drops between payment and receipt
- Adjust stock while a sale containing that product is open
- Change a price while the item is in an open cart

Each of these has produced real defects in real POS systems. They are hard to
script and easy to explore.

### Take notes as you go

Session notes make the work reviewable and reusable:

```markdown
## Session: Void and refund — 2026-09-06, 75 min

**Charter:** duplicate-product sales, manager role

**Coverage**
- Voided sales with 1, 2, and 5 lines
- Voided a sale with the same product on two lines  ← defect found
- Attempted void as cashier (correctly refused)
- Voided after a partial refund

**Findings**
- BUG-042 Stock restored once per product, not per line (CRITICAL)
- BUG-043 Generic error when re-voiding; should say already voided (LOW)
- Question: should voiding a partially refunded sale be allowed at all?

**Not covered** Offline voiding; multi-shop; > 20 lines
**Next** Charter for refund edge cases
```

**"Not covered" matters as much as coverage** — it tells the next person where
the gap is.

### Feed findings back

Exploratory testing is only worth the time if its findings become permanent:

1. Every defect → `bug-analysis` → a regression test (see `regression-testing`)
2. Every valuable case → added to `edge-case-analysis`
3. Every question raised → back to `requirements-analysis`
4. Repeated defect classes → escalate as systemic

A charter that finds a defect class should generate a scripted test so it is
never found by exploration again.

### When to use it

**High value:** new features, heavily changed areas, before release, after a
production surprise, unfamiliar parts of the system, and integration points.

**Low value:** stable code with no changes, areas already covered by strong
scripted tests, and pure calculation logic — that is better covered exhaustively
at unit level.

### Checklist

- [ ] Charter written: explore / with / to discover
- [ ] Timeboxed, typically 60–90 minutes
- [ ] Prioritised by risk and change
- [ ] Heuristics applied when ideas run out
- [ ] Anomalies followed rather than dismissed
- [ ] Session notes record coverage, findings, and gaps
- [ ] "Not covered" recorded explicitly
- [ ] Defects routed to bug analysis with reproductions
- [ ] Valuable cases added to the standing edge-case list
- [ ] Questions routed back to requirements
- [ ] Repeated classes escalated as systemic

## References

- **Cem Kaner — Exploratory Testing** — simultaneous learning, design, and
  execution <https://kaner.com/pdfs/ETatQAI.pdf>
- **Jonathan Bach — Session-Based Test Management** — charters, sessions, and
  session notes <https://www.satisfice.com/download/session-based-test-management>
- **Elisabeth Hendrickson, _Explore It!_** — heuristics for generating variation
- **James Bach and Michael Bolton — Rapid Software Testing** — following anomalies

**Not sourced — written for this framework:** the retail charter list, the
heuristic table, the session-note template with the "not covered" convention, and
the feedback loop into regression and edge-case skills.
