---
name: feature-breakdown
version: 1.0.0
description: |
  Split a large feature into thin vertical slices that each deliver value and can
  ship independently. Use when a feature is too big to build in one go, when
  scope is uncertain, or when asked "how do we break this down". Produces slices;
  task-decomposition then splits a slice into assignable tasks.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Feature Breakdown

Split by **value**, not by layer. Each slice should be independently shippable
and independently useful — that is what makes a split worth doing.

### Vertical, not horizontal

```
❌ Horizontal — nothing works until all four land
   1. Build the database tables
   2. Build the API
   3. Build the UI
   4. Wire it together

✅ Vertical — each slice is usable, and shipping can stop after any of them
   1. Record a stock adjustment with a reason  (schema + API + minimal UI)
   2. Show adjustment history for a product
   3. Require approval for adjustments over a threshold
   4. Bulk adjustment via CSV import
```

Horizontal slicing hides risk: integration problems surface only at the end, and
partial delivery is worth nothing. Vertical slicing means you learn from real
usage after slice one, and can stop when the value runs out.

**Each slice ends with something a user can do.** If a slice cannot be described
as a user outcome, it is a task, not a slice — see `task-decomposition`.

### How to split

Techniques, roughly in order of usefulness:

| Technique | Split by | Example |
|---|---|---|
| **Workflow steps** | Stages of a process | Record adjustment → history → approval → bulk import |
| **Rules** | Simple case first, then complexity | Flat discount → tiered → stacking rules |
| **Roles** | One role, then others | Cashier view → manager view → owner reporting |
| **Data variations** | One type, then the rest | Single-unit products → weighted goods → bundles |
| **Happy path first** | Defer error handling depth | Successful payment → partial failure → offline queue |
| **Manual then automated** | Human step first | Manual reorder flag → suggested quantities → automatic PO |
| **CRUD subset** | Read before write | View stock levels → adjust → import |

Prefer splitting by **rule complexity** when the domain is the hard part, which
in retail it usually is. Ship the simple pricing rule, learn, then add stacking.

### Sizing

A slice should be buildable in **one to three days**. Larger than that and the
estimate is unreliable, integration risk grows, and feedback comes too late.

Signals a slice is too big:

- More than a handful of acceptance criteria
- Touches more than two or three modules
- Contains the word "and" in its description
- Cannot be described as a single user outcome
- The estimate is a range wider than 2×

Anything estimated beyond two days goes to the human before work starts.

### Sequence for learning and risk

Order slices so that:

1. **Riskiest assumption first** — the thing most likely to be wrong. If the
   pricing rules turn out different than described, learn in week one.
2. **Highest value early** — so stopping after any slice still leaves value.
3. **Dependencies respected** — see `dependency-analysis`.

Do not sequence by "easiest first". That defers every hard question, and the hard
questions are what change the plan.

### Keep slices independently shippable

A slice that cannot ship alone is not a slice. Where a later slice changes an
earlier one's behaviour, use:

- **Feature flags** — ship dark, enable when complete
- **Expand/contract** — additive changes first, removal later (see
  `migration-plan`)
- **Additive API changes** — new optional fields, never breaking ones (see
  `api-design`)

### Retail-specific splitting

The domain suggests natural seams:

- **By transaction type** — sale, then return, then exchange
- **By payment method** — cash, then card, then split payments
- **By location** — one shop, then multi-shop
- **By reporting period** — daily, then weekly, then arbitrary ranges
- **Online-only, then offline-capable** — offline is a large slice of its own and
  should never be smuggled into another

**Do not split a transactional invariant across slices.** Sale creation and stock
decrement must ship together — a slice that records sales without moving stock
produces incorrect inventory the moment it is used. Atomicity is not a phase.

### Output

```markdown
# Feature: <name>

## Outcome        — what the user can do when all slices are shipped
## Slices
   1. <user outcome>   ~1d   depends on: —        risk: high (pricing rules unconfirmed)
   2. <user outcome>   ~2d   depends on: 1        risk: low
   3. <user outcome>   ~1d   depends on: 1        risk: medium
## Out of scope   — explicitly not building
## Open questions — carried from requirements
```

Each slice then goes to `acceptance-criteria` and `task-decomposition`.

### Checklist

- [ ] Slices are vertical — each ends with a user outcome
- [ ] Each slice independently shippable
- [ ] Each sized at one to three days
- [ ] Anything over two days escalated before starting
- [ ] Riskiest assumption scheduled first
- [ ] Value front-loaded so stopping early still delivers
- [ ] Dependencies between slices stated
- [ ] No transactional invariant split across slices
- [ ] Feature flags or expand/contract used where slices interact
- [ ] Out-of-scope list written

## References

- **Bill Wake — INVEST in Good Stories** — small, independent, valuable,
  testable <https://xp123.com/articles/invest-in-good-stories-and-smart-tasks/>
- **Richard Lawrence — Patterns for Splitting User Stories** — the splitting
  techniques table <https://agileforall.com/patterns-for-splitting-user-stories/>
- **Mike Cohn, _User Stories Applied_** — vertical slicing and sizing
- **Martin Fowler — Feature Toggles / Parallel Change** — shipping incomplete
  work safely <https://martinfowler.com/articles/feature-toggles.html>

**Not sourced — written for this framework:** the retail splitting seams, the
rule that transactional invariants must not be split, the too-big signals, and
the output template.
