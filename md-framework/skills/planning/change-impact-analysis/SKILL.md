---
name: change-impact-analysis
version: 1.0.0
description: |
  Trace the blast radius of a proposed change — what code, data, contracts,
  clients, and reports it affects — before making it. Use before any non-trivial
  change, when deciding which review lanes apply, when estimating risk, or when
  asked "what else does this touch".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Change Impact Analysis

Find what a change touches **before** making it. The cost of a change is rarely
the edit; it is everything that depended on the old behaviour.

This analysis also produces the routing decision: which review lanes apply, and
whether a human checkpoint is required.

### Trace outward in layers

Work from the change point outward. Each layer has its own search.

**1. Direct callers**
```bash
grep -rn "functionName\|ModelName" src/ --include=*.js --include=*.jsx
grep -rn "from '@/features/sales'" src/ --include=*.js
```

**2. Data**
```bash
grep -rn "tableName\|ModelName\." src/ --include=*.js
grep -rn "column_name" migrations/ src/ --include=*.js
```
Who writes it, who reads it, and is there a stored aggregate derived from it?

**3. API contract**
```bash
grep -rn "'/api/v1/sales" src/ --include=*.js --include=*.jsx
grep -rn "sales" postman/ 2>/dev/null | head
```
Does the request or response shape change? Is that additive or breaking (see
`api-design`)?

**4. Clients**
Frontend components, other services, integrations, the Postman collection, and
anything a shop owner has bookmarked or scripted.

**5. Reports and exports**
The most commonly missed layer. A field rename or a status change silently breaks
a report that nobody runs until month-end.

**6. Tests and fixtures**
```bash
grep -rn "sale\|stock" test/ --include=*.test.js | head -20
```

**7. Documentation and knowledge**
The `project-*` skills, ADRs, and the Postman collection are all downstream of a
behaviour change and must be updated in the same work item.

### Classify the change

| Type | Blast radius | Requires |
|---|---|---|
| **Additive** — new field, new endpoint | Small | Normal review |
| **Behaviour change** — same shape, different result | **Large and invisible** | Full analysis + tests |
| **Breaking** — removed or renamed | Large but visible | Versioning or expand/contract |
| **Data migration** — existing rows change | Largest | Human approval + backup |

**Behaviour changes are the dangerous category.** Nothing fails to compile,
nothing 404s — the system simply produces different numbers. A change to how
discount is rounded touches every historical comparison and every report, with no
error anywhere.

### The retail questions

Ask these on every change:

- **Does it change a stored number?** Totals, stock, cost, tax. If yes, what
  happens to existing rows, and do historical records still reconcile?
- **Does it change a calculation?** Then old and new records were computed
  differently. Is that acceptable, and is it documented?
- **Does it affect the till path?** That is the hot path with the strictest
  latency budget and the least tolerance for failure.
- **Does it change who can do something?** Permission changes need the security
  lane and a human checkpoint.
- **Does it affect audit records?** Attribution and append-only guarantees must
  survive.
- **Does it change reporting output?** Someone reconciles against these numbers.

### Deriving the review lanes

The analysis answers the routing question directly:

| If it touches | Lane required |
|---|---|
| Any code | `code-security-reviewer` |
| An endpoint | `api-security-reviewer` |
| Schema or queries | `postgres-code-review` |
| UI | `frontend-reviewer`, `design-system-guardian` |
| Money, stock, pricing, or permissions | `security-lead` **and** a human checkpoint |
| Dependencies | `dependency-auditor` |
| A hot path or a query | `performance-engineer` |
| Module boundaries or contracts | `architect`, possibly an ADR |

### Assess risk honestly

| Level | Meaning |
|---|---|
| **Low** | Additive, isolated, reversible |
| **Medium** | Multiple modules, or a contract change with versioning |
| **High** | Behaviour change affecting stored numbers, or permissions |
| **Critical** | Irreversible data migration, or anything altering financial history |

`High` and `Critical` require a rollback plan before work starts, and `Critical`
requires human approval and a verified backup.

### Output

```markdown
## Change            — what is being changed, and why
## Type              — additive / behaviour / breaking / migration
## Affected
   Code       — files and callers
   Data       — tables, columns, derived values
   Contracts  — endpoints, request/response changes
   Clients    — components, integrations, collections
   Reports    — anything reading the affected values
   Tests      — what must be updated
   Docs       — project-* skills, ADRs
## Not affected      — checked and ruled out
## Risk              — level, with reasoning
## Review lanes      — derived from the above
## Rollback          — how to undo, and whether it has been tested
## Human checkpoint  — required or not, and why
```

**Not affected** matters as much as affected: it records what you checked, so the
next person knows the search was done rather than skipped.

### Checklist

- [ ] All seven layers traced outward from the change point
- [ ] Reports and exports explicitly checked
- [ ] Change classified by type
- [ ] Behaviour changes identified as such, not treated as additive
- [ ] Retail questions answered — stored numbers, calculations, till path, audit
- [ ] Existing data reconciliation considered
- [ ] Review lanes derived and stated
- [ ] Risk level assigned with reasoning
- [ ] Rollback plan for high-risk changes
- [ ] Human checkpoint decided for money, stock, permissions, or migrations
- [ ] Knowledge skills scheduled for update in the same work item

## References

- **Michael Feathers, _Working Effectively with Legacy Code_** — effect sketching
  and tracing change propagation
- **Martin Fowler — Parallel Change / Tolerant Reader** — managing breaking
  changes <https://martinfowler.com/bliki/ParallelChange.html>
- **ISO/IEC/IEEE 12207** — change impact analysis as a defined process activity
- **Munder Difflin `PROTOCOL.md`** — escalation routing for changes needing
  human sign-off

**Not sourced — written for this framework:** the seven-layer trace with search
commands, the change-type table and the behaviour-change warning, the retail
question list, the lane-derivation table, and the "not affected" convention.
