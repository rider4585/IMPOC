---
name: regression-testing
version: 1.0.0
description: |
  Ensure changes do not break what already worked — building a regression suite,
  selecting what to run, and turning every production defect into a permanent
  test. Use when planning release testing, after fixing a bug, when the suite
  grows unmanageable, or when asked "what should we re-test".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Regression Testing

A regression is a defect in something that previously worked. They are
disproportionately damaging because they break behaviour users already rely on —
and in retail, behaviour someone has built a daily routine around.

### Every fixed bug becomes a test

This is the single most valuable rule in the skill, and the most often skipped
under time pressure.

```
Bug found → reproduce → write a failing test → fix → test passes → keep the test
```

The test must **fail before the fix and pass after**. A test written after the
fix, never seen failing, may assert nothing.

Without this discipline the same defects return, because the conditions that
produced them — an unusual state, a race, an edge case — are still reachable.

### Build the suite from risk

A regression suite is not "all the tests". It is the set that must pass before
anything ships.

| Tier | Contents | When |
|---|---|---|
| **Smoke** | Login, complete a sale, view sales — minutes | Every commit |
| **Core** | All money, stock, auth, and permission tests | Every merge |
| **Full** | Everything, including slow E2E and visual | Before release |

Anything touching money or stock is in **Core**, never deferred to Full. Those
are the regressions you cannot afford.

### Select what to run by impact

Running everything on every change is slow; running too little misses
regressions. Use `change-impact-analysis` to choose:

| Change | Run |
|---|---|
| Pricing or tax logic | All pricing, sale, report, and receipt tests |
| Stock logic | All stock, sale, void, refund, and concurrency tests |
| Auth or roles | Every permission test, all roles, cross-tenant |
| Schema migration | Everything touching those tables + data integrity checks |
| Shared component | All screens using it + visual tests |
| Dependency upgrade | Full suite — the blast radius is unknowable |

**Dependency upgrades always get the full suite.** You cannot reason about what
changed inside someone else's code.

### Keep the suite trustworthy

A suite that fails intermittently or takes too long stops being run, and then it
protects nothing.

- **Flaky tests are quarantined immediately**, then fixed or deleted within a
  defined window. Never left failing "known-flaky" in the gate.
- **Keep it fast** — push tests down levels (see `test-planning`); a slow suite
  gets skipped before a deadline, which is exactly when it is needed.
- **Delete obsolete tests.** Tests for removed behaviour create noise and false
  failures. Deleting a test for deleted behaviour is correct, not a coverage
  loss.
- **A failing regression test blocks the merge.** If it is wrong, fix the test
  deliberately as its own decision — never by weakening the assertion to get
  green.

### The permanent retail regression set

These must pass before any release, regardless of what changed:

- Complete a sale — totals, tax, and stock all correct
- Void and refund — stock restored, audit written, original immutable
- Concurrent sale of the last unit — exactly one succeeds
- Duplicate payment submission — charged once
- Receipt sequence unique and gapless under concurrency
- Each role's permissions, including negatives
- Cross-tenant access returns 404
- Rounding produces the documented values
- Shift close with an open sale behaves as specified
- Reports reconcile against source rows

This set encodes the invariants of the business. It should only ever grow.

### Detect regressions beyond tests

Some regressions are not test failures:

```bash
# Behaviour changes hidden in a diff
git diff main --stat
git log --oneline main..HEAD -- src/features/sales/

# Reconciliation queries as continuous regression checks
```

Scheduled data-integrity reconciliation (see `data-integrity`) catches
regressions that only appear against real data volumes and real usage — it is a
regression check that runs in production.

### Checklist

- [ ] Every fixed bug has a test that failed before the fix
- [ ] Suite tiered into smoke, core, and full
- [ ] Money, stock, auth, and permission tests are in core
- [ ] Selection driven by change-impact analysis
- [ ] Dependency upgrades trigger the full suite
- [ ] Flaky tests quarantined immediately, then fixed or deleted
- [ ] Suite fast enough to run routinely
- [ ] Obsolete tests deleted
- [ ] Failing regression blocks the merge; assertions never weakened for green
- [ ] Permanent retail regression set passes before every release
- [ ] Reconciliation checks running against production data

## References

- **ISTQB Foundation Level syllabus** — regression testing, confirmation
  testing, and test selection <https://www.istqb.org/>
- **Martin Fowler — Test Pyramid / SelfTestingCode** — suite speed and trust
  <https://martinfowler.com/bliki/SelfTestingCode.html>
- **Michael Feathers, _Working Effectively with Legacy Code_** —
  characterization tests to pin existing behaviour
- **Google Testing Blog — Flaky Tests** — quarantine as policy

**Not sourced — written for this framework:** the tiering table, the
change-to-suite selection table, the permanent retail regression set, and the
rule that dependency upgrades always trigger the full suite.
