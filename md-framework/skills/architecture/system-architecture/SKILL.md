---
name: system-architecture
version: 1.0.0
description: |
  Design the overall structure of a system — layers, module decomposition, data
  flow, and the decisions that are expensive to reverse. Use when designing a new
  subsystem, restructuring an existing one, evaluating a significant change, or
  when asked "how should this be structured". Read project-architecture first on
  an existing codebase.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## System Architecture

Architecture is the set of decisions that are expensive to change later.
Everything else is implementation, and should be left to the people doing it.

The job is to make the expensive decisions well and to keep the cheap ones out of
your queue.

### Reversible or not — decide this first

| Reversible | Irreversible / costly |
|---|---|
| Which validation library | The data model |
| Folder layout | Module and ownership boundaries |
| A function's signature | Public API contracts |
| Caching a particular query | Introducing a new datastore |
| Log format | Splitting a service |

Reversible decisions get a recommendation and move on — deciding slowly costs
more than deciding wrongly. Irreversible ones get a written rationale, an ADR,
and a human checkpoint. See `adr`.

### Design for the system that exists

On an existing codebase, read `project-architecture` before proposing anything.
A design that ignores current structure produces a rewrite nobody asked for.
Respect what is there unless you can state the migration cost and justify it.

### Layers

The layering most web systems want, and the rule each layer obeys:

```
Route        →  path, middleware chain. No logic.
Controller   →  HTTP in, HTTP out. Parse, call service, shape response.
Service      →  business rules. Never sees req/res. The system's real behaviour.
Repository   →  data access. Owns queries for its tables.
Model        →  schema definition.
```

The rules that make layering worth having:

1. **Dependencies point inward.** Services do not import controllers.
2. **A service never receives `req`/`res`.** Once it does, it can only be called
   over HTTP — not from a job, a CLI task, or another service.
3. **Business rules live in exactly one layer.** A rule duplicated in a
   controller and a service will diverge.
4. **Skipping a layer is a finding**, not a shortcut — a controller running
   queries directly is how business rules escape into HTTP handlers.

### Decompose by capability, not by technical type

A module is a business capability: `sales`, `inventory`, `products`, `pricing`,
`reporting`. Not `helpers`, `utils`, `common`, `managers`.

**A module you can only describe by its technical category is drawn wrong.** A
`utils` folder is unowned by definition, so nothing in it is ever safely
deleted.

For each module state: what it owns, what it exposes, what it depends on, and
which tables it writes. See `module-boundaries`.

### One writer per table

The most consequential structural rule in a data-centric system.

Every table has exactly one module that writes it. Others read through an
explicit contract — a service method, not a direct query.

When two modules write the same table, its invariants exist in two places and
will eventually disagree. In a retail system that means stock or money that does
not reconcile.

### Transactional boundaries are architecture

In a POS this is the design decision that matters most, and it cannot be
retrofitted.

A sale must record the sale, its lines, the stock movement, and the payment
**atomically**. That constraint dictates that these live in one database and one
transaction — which in turn means they should not be split across services
without a very good reason and a compensating design.

Decide and record: what is in the transaction, what happens on partial failure,
and what is reconciled asynchronously. See `transactions`.

### Modular monolith first

For a system of this size, a well-structured monolith is almost always right.
Services introduce network calls, partial failure, distributed transactions, and
deployment coordination — all real costs, paid immediately, for benefits that
only appear at scale you do not have.

**Get the module boundaries right inside the monolith first.** If they are clean,
extracting a service later is mechanical. If they are not, splitting produces a
distributed version of the same mess, with worse failure modes.

Extract a service only when there is a specific, stated reason: independent
scaling of a genuinely hot component, a hard isolation requirement, or team
boundaries that cannot be managed otherwise.

### Asynchronous work

Move out of the request path anything that is slow, unreliable, or not needed for
the response: PDF and barcode generation, bulk imports, email, report building,
external syncs.

State for each: what triggers it, retry behaviour, idempotency, and what the user
sees while it runs. A queued job with no idempotency guarantee is a duplicate
waiting to happen.

### Avoid speculative generality

Do not build for requirements nobody has stated. An abstraction with one
implementation is a cost with no benefit; three similar cases justify one, one
does not. Plugin systems, generic rule engines, and configurable workflows are
almost always premature.

### Output

A design document containing:

```markdown
## Problem            — what is being solved, and the constraints
## Approach           — the chosen design
## Alternatives       — what was rejected, and why
## Modules affected   — with ownership and contracts
## Data ownership     — table → writing module
## Transactions       — atomic boundaries, failure behaviour
## Migration          — how to get from here to there
## Risks              — what could go wrong
## Reversibility      — reversible, or ADR + human checkpoint
```

### Checklist

- [ ] `project-architecture` read; design fits the system that exists
- [ ] Decision classified reversible or not; ADR written if not
- [ ] Modules named by capability, not technical type
- [ ] One writer per table; cross-module reads via explicit contracts
- [ ] Layer rules hold; no service receives `req`/`res`
- [ ] Transactional boundaries specified where money or stock moves
- [ ] Failure behaviour defined for every asynchronous path
- [ ] Monolith-first unless service extraction is specifically justified
- [ ] No abstraction with a single implementation
- [ ] Alternatives recorded with rejection reasons
- [ ] Migration path defined if existing data is affected

## References

- **Martin Fowler, _Patterns of Enterprise Application Architecture_** — layering
  and service-layer patterns <https://martinfowler.com/eaaCatalog/>
- **Martin Fowler — MonolithFirst / Microservice Premium** — the monolith-first
  argument <https://martinfowler.com/bliki/MonolithFirst.html>
- **Eric Evans, _Domain-Driven Design_** — decomposition by capability, bounded
  contexts
- **C4 model** — levels of architectural description <https://c4model.com>
- **arc42** — design document structure <https://arc42.org/overview>
- **AWS Well-Architected Framework** — the reversible/irreversible framing and
  operational considerations
  <https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html>

**Not sourced — written for this framework:** the reversibility table, the
one-writer-per-table rule, the POS transactional-boundary requirement, and the
design document template.
