---
name: test-planning
version: 1.0.0
description: |
  Decide what to test, at which level, and in what priority — risk-based
  coverage, level selection, and the plan that turns acceptance criteria into
  executable tests. Use before testing a feature, when deciding test scope, or
  when asked "what should we test here".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Test Planning

Testing everything is impossible; testing randomly is wasteful. A test plan is a
**risk allocation decision** — where to spend effort, and what you are knowingly
not covering.

### Prioritise by risk, not by coverage

Risk = **likelihood of failure × cost of failure**. Rank features by it and spend
accordingly.

| Area | Cost of failure | Effort |
|---|---|---|
| Payment, totals, tax | Money lost or miscollected; compliance | Highest |
| Stock movement | Overselling, incorrect inventory | Highest |
| Void, refund, override | Financial loss, fraud, audit failure | Highest |
| Authentication, permissions | Cross-tenant exposure | High |
| Receipt numbering | Tax compliance | High |
| Reporting | Bad decisions, slow to detect | Medium |
| Product search, filters | Annoyance | Low |
| Cosmetic UI | Minor | Lowest |

In a POS, anything that can make money or stock wrong outranks everything else,
regardless of how rarely it runs.

### Choose the level deliberately

Each level has a cost and a purpose. Putting a test at the wrong level makes it
slow, flaky, or blind.

| Level | Good for | Cost | Keep it for |
|---|---|---|---|
| **Unit** | Rules, calculations, edge cases | Very low | Pricing, rounding, validation logic |
| **Integration** | Contracts, auth, transactions | Low | Endpoints, rollback, tenancy |
| **Concurrency** | Races | Medium | Every stock and money path |
| **E2E** | Critical user journeys only | High, flaky | Checkout, login, void |
| **Exploratory** | The unknown unknowns | Human time | New and changed areas |

**Push tests down.** Anything testable at unit level should not be an E2E test —
same coverage, a hundredth of the cost and none of the flakiness. Reserve E2E for
journeys where the *integration* is the risk.

### Work from acceptance criteria

Acceptance criteria are already the test cases — see `acceptance-criteria`. The
plan maps each to a level and adds what criteria typically miss:

- Concurrency scenarios
- Security negatives (wrong role, another tenant's record)
- Failure and partial-failure paths
- Boundary values

If a criterion cannot be mapped to a test, it was not testable — return it.

### The retail scenarios that must always be covered

Independent of the feature, if the change touches these paths:

- **Concurrent sale of the last unit** — exactly one succeeds, stock never
  negative
- **Double-submitted payment** — charged once
- **Void and refund** — stock restored, audit record written, original immutable
- **Receipt sequence** — unique and gapless under concurrent checkout
- **Shift close with an open sale** — defined, non-destructive behaviour
- **Cross-tenant access** — returns 404, not another shop's data
- **Rounding** — exact expected values, per the documented rule
- **Offline/reconnect** — if supported; if not, the failure is explicit

### Plan format

```markdown
# Test Plan: <feature>

## Risk assessment    — areas ranked by likelihood × cost
## Scope              — what is tested
## Out of scope       — what is not, and why  ← the honest part
## By level
   Unit          — rules and calculations
   Integration   — endpoints, auth, transactions
   Concurrency   — races
   E2E           — journeys (few)
   Exploratory   — charters
## Test data          — fixtures and factories needed
## Environment        — real PostgreSQL; seeded state
## Entry criteria     — when testing can start
## Exit criteria      — when testing is done
## Risks accepted     — known gaps, with sign-off
```

**Out of scope and risks accepted are the sections that matter.** A plan claiming
full coverage is either wrong or unaffordable; stating the gaps lets the human
decide whether to accept them.

### Exit criteria

Define done before starting, or testing expands until someone gets tired:

- All acceptance criteria have passing tests
- All `CRITICAL`/`HIGH` defects fixed and verified
- Concurrency tests pass for money and stock paths
- Security negatives pass
- No known defect in a money, stock, or access path
- Remaining defects logged with severity and accepted

Coverage percentage is a diagnostic, not an exit criterion — see `unit-testing`.

### Checklist

- [ ] Risk assessment completed and ranked
- [ ] Money and stock paths ranked highest
- [ ] Each acceptance criterion mapped to a level
- [ ] Tests pushed to the lowest level that can cover them
- [ ] E2E limited to critical journeys
- [ ] Concurrency scenarios planned for every stock and money path
- [ ] Security negatives included
- [ ] Standing retail scenarios covered where applicable
- [ ] Test data and environment defined
- [ ] Out of scope stated explicitly
- [ ] Exit criteria agreed before testing starts
- [ ] Accepted risks recorded and signed off

## References

- **ISTQB Foundation Level syllabus** — test levels, risk-based testing, entry
  and exit criteria <https://www.istqb.org/>
- **Martin Fowler — Test Pyramid** — level selection and pushing tests down
  <https://martinfowler.com/bliki/TestPyramid.html>
- **ISO/IEC/IEEE 29119-3** — test plan documentation structure
- **Gojko Adzic, _Specification by Example_** — acceptance criteria as the
  source of test cases

**Not sourced — written for this framework:** the retail risk table, the standing
retail scenario list, the exit criteria, and the emphasis on out-of-scope and
accepted-risk sections.
