---
name: dependency-analysis
version: 1.0.0
description: |
  Identify what blocks what, sequence work correctly, and find the critical path
  and parallelisable work. Use when ordering tasks, when work is blocked, when
  planning multi-agent work, or when asked "what order should we do these in".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Dependency Analysis

Wrong sequencing produces idle agents, rework, and half-integrated code. The goal
is to find the genuine order constraints — and, just as importantly, the ones
that are not real.

### Kinds of dependency

| Kind | Meaning | Example |
|---|---|---|
| **Hard technical** | B cannot start until A exists | Endpoint needs the table |
| **Soft technical** | B is easier after A, but not blocked | UI is easier with a real endpoint |
| **Knowledge** | B needs a decision from A | Nothing starts until the pricing rule is confirmed |
| **Resource** | Same agent needed for both | One backend engineer, two tasks |
| **External** | Outside your control | Payment provider credentials |

**Distinguish hard from soft.** Soft dependencies are treated as hard far more
often than they should be, and each one wrongly treated as hard removes
parallelism. A UI can be built against an agreed contract before the endpoint
exists — that is a soft dependency, resolvable with a stub.

### Build the graph

State every dependency on the task itself, not in a separate document that drifts.

```
T-013 schema        ──┬─→ T-014 endpoint ──→ T-015 UI ──→ T-017 e2e tests
                      └─→ T-016 repository ────────────────┘

T-018 threat model  (independent — start immediately)
T-019 test fixtures (independent — start immediately)
```

Then extract two things:

**The critical path** — the longest chain. Its length is the minimum duration,
and shortening anything off it changes nothing. Focus attention here.

**Parallelisable work** — everything not on the critical path. With four
concurrent agents available (see the harness `maxConcurrentWorkers`), this is
what keeps them busy.

### Resolve knowledge dependencies first

Knowledge dependencies block everything downstream and are the cheapest to
resolve — they need a question answered, not code written.

```
❌ Start implementing pricing, discover mid-build that stacking rules are unclear,
   stop, ask, wait, rework.

✅ Confirm stacking rules before scheduling any pricing task.
```

Any `[assumed]` rule touching money, stock, or access is a hard blocker on every
task that depends on it — see `requirements-analysis`. Batch these questions and
ask before scheduling, not during.

### Break false dependencies

Most sequential plans have removable constraints:

| Apparent dependency | Break it with |
|---|---|
| UI waits for the endpoint | Agree the contract; build against a stub |
| Feature waits for the migration | Expand/contract — additive migration first |
| Tests wait for implementation | Write tests from acceptance criteria first |
| Everything waits on one schema | Split the migration by table |
| Two features touch one module | Sequence the module edits, parallelise the rest |

Agreeing the API contract early is the highest-leverage move available — it turns
a chain into two parallel branches.

### Sequence for risk, then value

Among genuinely independent work:

1. **Riskiest first** — the task most likely to invalidate the plan
2. **Blockers first** — anything with many dependents
3. **Highest value** — so stopping early still delivers

Never sequence by "easiest first". It defers every hard question to the point
where changing course is most expensive.

### Cross-agent coordination

Where two agents' tasks meet, the interface is a dependency in itself:

- **Agree the contract before both start**, and record it on both tasks
- Name which agent owns it — the producer, normally
- A contract change mid-flight is a `propose` to `god`, not a private
  arrangement between two agents

Two agents editing the same file is a resource conflict. Sequence those tasks, or
split the file first.

### Watch for cycles

```
T-014 endpoint needs the response shape from T-015 UI
T-015 UI needs the endpoint from T-014
```

A cycle means the boundary is wrong, or a decision is missing. Break it by
extracting the shared thing — usually the contract — into its own earlier task.

### Output

```markdown
## Critical path      — the ordered chain, with total duration
## Parallel tracks    — what can run alongside, and by which agent
## Blockers           — unresolved knowledge and external dependencies
## Contracts to agree — interface, owner, and when it must be settled
## Risks              — what would invalidate this sequence
```

### Checklist

- [ ] Every dependency classified hard / soft / knowledge / resource / external
- [ ] Soft dependencies not treated as hard
- [ ] Knowledge dependencies resolved before scheduling dependent work
- [ ] No money, stock, or access rule left assumed before its tasks are scheduled
- [ ] Critical path identified
- [ ] Parallel work identified and assigned to available agents
- [ ] False dependencies broken where possible
- [ ] Contracts between agents agreed before both start
- [ ] No cycles; any found are broken by extracting the contract
- [ ] Sequenced by risk, then blocking, then value
- [ ] External dependencies flagged with lead times

## References

- **Critical Path Method (PMI, _PMBOK Guide_)** — critical path and float
- **Mike Cohn, _Agile Estimating and Planning_** — dependency handling and
  sequencing for risk and value
- **Martin Fowler — Parallel Change** — breaking migration dependencies
  <https://martinfowler.com/bliki/ParallelChange.html>
- **Munder Difflin `PROTOCOL.md`** — `propose` routing for contract changes and
  the concurrent worker model

**Not sourced — written for this framework:** the dependency-kind table, the
false-dependency table, the cross-agent contract rules, and the output template.
