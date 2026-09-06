---
name: implementation-plan
version: 1.0.0
description: |
  Assemble requirements, slices, tasks, and dependencies into an executable plan
  with sequencing, agent assignment, review gates, and checkpoints. Use before
  starting multi-task work, when coordinating several agents, or when asked "what
  is the plan". The output is what the orchestrator executes against.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Implementation Plan

The plan is what turns analysis into coordinated execution. It is the document
`michael` routes from and tracks against — so it must name agents, gates, and
checkpoints explicitly, not just list work.

### Prerequisites

A plan built on unresolved questions is fiction. Before writing one:

- [ ] Requirements confirmed; zero `[assumed]` rules touching money, stock, or access
- [ ] Acceptance criteria written and agreed
- [ ] Design decided; ADR written if irreversible
- [ ] Slices and tasks defined
- [ ] Dependencies mapped

If any is missing, that is the first step of the plan, not an assumption inside
it.

### Structure

```markdown
# Implementation Plan: <feature>

## Goal              — the user outcome, in one sentence
## Success           — how we will know it worked (links to acceptance criteria)
## Not doing         — explicit exclusions

## Phases
### Phase 1: <name>            (critical path: T-013 → T-014)
| Task | Owner | Est | Depends | Lanes |
|------|-------|-----|---------|-------|
| T-013 Add stock_adjustment table | postgres-specialist | 2h | — | postgres |
| T-014 POST /stock/adjustments    | backend-engineer    | 3h | T-013 | code-sec, api-sec |
| T-018 Threat model               | threat-modeler      | 2h | — | — |

**Gate:** all Phase 1 review lanes pass before Phase 2 starts.

### Phase 2: …

## Checkpoints       — where the human decides
## Risks             — what could invalidate this, and the response
## Rollback          — how to undo, per phase
## Definition of done
```

### Phase by verifiable outcome

Each phase ends with something that can be checked — not "backend done", but
"a manager can record an adjustment and it appears in history".

Phases exist to create **decision points**. At the end of each, the work can
continue, change direction, or stop with value already delivered.

### Assign agents explicitly

Every task names its owner. Unassigned tasks are how work stalls silently.

Respect the concurrency limit — the harness runs a bounded number of workers
(`maxConcurrentWorkers`, currently 4). A plan with eight parallel tracks will
serialise anyway, and the plan should say which four matter.

Where two agents' work meets, name the contract and when it must be agreed — see
`dependency-analysis`.

### Build the gates in

Review is part of the plan, not something that happens afterwards.

State per phase which lanes apply, derived from `change-impact-analysis`:

- `CRITICAL` or `HIGH` findings block the phase
- Security fixes are verified by `security-verifier`, never by their author
- The gate is a phase boundary, not a final step

A plan that puts all review at the end has no gates — it has a queue.

### Name the human checkpoints

Mark where work stops and waits. From the orchestrator's escalation list:

- Before any destructive migration
- Before changing pricing, tax, discount, or payment logic
- Before changing authentication, authorisation, or roles
- On any `CRITICAL` security finding
- On any ADR
- When an `[assumed]` money, stock, or access rule is about to become code

Put these in the plan so nobody has to remember them mid-flight.

### Plan the rollback before starting

For each phase: how is it undone? Feature flag, revert, down migration, or
compensating action.

**"Roll forward" is not a rollback plan** for anything touching money or stock —
it assumes the fix is quick and correct, at exactly the moment it is neither.

Anything irreversible needs a verified backup and human approval.

### Estimate honestly

- Estimate per task, not per phase
- Give a range where uncertain, and if the range is wider than 2×, insert a spike
- Never compress an estimate to fit a wish — say what it costs and let the human
  decide scope
- Anything beyond two days returns to `feature-breakdown`

### Keep it current

A plan is a live document. When reality diverges — a task takes longer, a
dependency appears, a rule turns out different — update the plan and tell
`michael`. Silent divergence is worse than a delay, because it invalidates every
downstream decision.

Reflect task status in `tasks.json` and propose plan changes to `god`, who is the
sole scribe of `board.md` (see `PROTOCOL.md`).

### Checklist

- [ ] Prerequisites confirmed; no unresolved money/stock/access rules
- [ ] Goal and success criteria stated
- [ ] Explicit exclusions listed
- [ ] Phases end in verifiable outcomes
- [ ] Every task has an owner and an estimate
- [ ] Parallelism respects the worker limit
- [ ] Contracts between agents named with a deadline
- [ ] Review lanes stated per phase
- [ ] Gates block on `CRITICAL`/`HIGH`
- [ ] Human checkpoints marked
- [ ] Rollback defined per phase
- [ ] Risks listed with responses
- [ ] Plan kept current as reality changes

## References

- **Mike Cohn, _Agile Estimating and Planning_** — release planning, estimation
  ranges, and replanning
- **PMI, _PMBOK Guide_** — phase gates and decision points
- **Martin Fowler — Feature Toggles** — enabling incremental delivery and
  rollback <https://martinfowler.com/articles/feature-toggles.html>
- **Munder Difflin `PROTOCOL.md`** — `tasks.json` status, `board.md` scribe rule,
  and worker concurrency

**Not sourced — written for this framework:** the plan template with lanes and
checkpoints, the prerequisite gate, the "roll forward is not a rollback" rule,
and the integration with orchestrator routing.
