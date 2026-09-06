---
name: task-decomposition
version: 1.0.0
description: |
  Break a slice into one-concern tasks, each assignable to a single agent with a
  clear definition of done. Use when preparing work for assignment, when a task
  is too large or ambiguous to start, or when asked "what are the actual steps".
  Consumes slices from feature-breakdown; feeds routing.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Task Decomposition

A task is the unit one agent picks up and finishes. The test of a good
decomposition is that the assignee needs **no further clarification** to start.

### One task, one concern, one owner

```
❌ "Implement stock adjustments"
   — spans schema, API, UI, and tests; no single owner; unclear when it is done

✅ 1. Add stock_adjustment table + migration        → postgres-specialist
   2. Add POST /stock/adjustments endpoint          → backend-engineer
   3. Add adjustment form to the product page       → frontend-engineer
   4. Add integration + concurrency tests           → qa-engineer
```

If a task needs two different specialists, it is two tasks. That is the clearest
signal available.

### Task anatomy

Every task carries all of this, or it is not ready to assign:

```markdown
## T-014: Add POST /stock/adjustments endpoint

**Owner:** backend-engineer
**Depends on:** T-013 (stock_adjustment table)
**Estimate:** ~3h

**Context**
Managers must record stock corrections with a reason. See BR-stock-007.

**Scope**
- Route, controller, service, Zod schema
- Writes an audit record in the same transaction
- Role check: stock:adjust

**Not in scope**
- The UI (T-015)
- Bulk import (slice 4)

**Done when**
- [ ] Endpoint accepts { productId, delta, reason } and validates all three
- [ ] Adjustment and audit record written atomically
- [ ] Stock cannot go negative (guarded update + CHECK)
- [ ] Cashier receives 403; another shop's product returns 404
- [ ] Unit + integration tests pass

**Review lanes:** code-security, api-security, postgres
```

The **Not in scope** section prevents the most common failure — an agent
helpfully building the next task too, which makes review harder and estimates
meaningless.

### Sizing

Aim for **two to eight hours**. Smaller becomes coordination overhead; larger
hides uncertainty.

Signals a task is too big:

| Signal | Split by |
|---|---|
| Needs two specialists | Discipline |
| Description contains "and" | The conjunction |
| More than ~5 "done when" items | Outcome |
| Touches more than two modules | Module |
| Estimate range wider than 2× | Investigate first — see spikes below |

### Order tasks so each is verifiable

Sequence so that every task can be checked when it lands, not only at the end:

1. **Data layer** — schema and migration
2. **Domain layer** — service logic and rules, unit tested
3. **API layer** — endpoint, validation, authorisation
4. **UI layer** — screens against the real endpoint
5. **Tests** — integration, concurrency, and negative cases
6. **Docs and knowledge** — update the `project-*` skills if behaviour changed

Within a slice this is usually a chain; across slices it may parallelise. See
`dependency-analysis`.

### Separate spikes from delivery

When the estimate is genuinely unknown, do not guess — create a **timeboxed
spike**:

```markdown
## T-020 (spike, 2h): Determine how offline sales reconcile receipt sequences
Output: a written recommendation. No production code.
```

A spike has a fixed time budget and produces a decision, not a feature. It must
not silently become the implementation.

### Tasks that are always separate

These get their own tasks, never folded into a feature task:

- **Migrations** — separate lock/rollback risk, separate review, separate
  approval if destructive (see `migrations`)
- **Refactoring** — mixing it with a feature makes both hard to review and hard
  to revert
- **Dependency upgrades** — their own risk profile and their own audit
- **Security remediation** — must be independently verifiable by someone who did
  not write it (see `security-verification`)

### Assigning

Each task names its owning agent. Where a task touches money, stock, or access,
the security lane is mandatory and stated on the task, not decided later.

Tasks estimated beyond two days do not get assigned — they return to
`feature-breakdown`.

### Checklist

- [ ] Each task has one concern and one owner
- [ ] No task requires two specialists
- [ ] Each sized between two and eight hours
- [ ] Anything over two days returned for re-slicing
- [ ] Every task states context, scope, out-of-scope, and done-when
- [ ] Done-when items are individually verifiable
- [ ] Dependencies stated as part of the task
- [ ] Ordered so each task is verifiable on completion
- [ ] Unknowns handled as timeboxed spikes, not guessed estimates
- [ ] Migrations, refactors, upgrades, and security fixes are separate tasks
- [ ] Review lanes named on tasks touching money, stock, or access

## References

- **Bill Wake — INVEST in Good Stories and Smart Tasks** — the "smart tasks"
  half: specific, measurable, achievable
  <https://xp123.com/articles/invest-in-good-stories-and-smart-tasks/>
- **Mike Cohn, _Agile Estimating and Planning_** — task sizing and spikes
- **Martin Fowler — Refactoring** — the separation of refactoring from behaviour
  change <https://martinfowler.com/books/refactoring.html>

**Not sourced — written for this framework:** the task anatomy template, the
too-big signal table, the always-separate task list, and the escalation
thresholds that feed orchestrator routing.
