---
name: adr
version: 1.0.0
description: |
  Write Architecture Decision Records — capturing a significant decision, its
  context, the alternatives rejected, and its consequences. Use when making a
  decision that is expensive to reverse, when someone asks "why is it built this
  way", or when a past decision needs superseding.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Architecture Decision Records

An ADR records **why** a decision was made, at the moment it was made, while the
alternatives and constraints are still known. Code shows what was decided; only
an ADR shows why, and why the obvious alternative was rejected.

Without them, every past decision looks arbitrary, and teams either cargo-cult it
or reverse it without knowing what it was solving.

### When to write one

Write an ADR when the decision is **expensive to reverse**:

- Data model or tenancy model choices
- Module and ownership boundaries
- Adding a datastore, a service, or a significant dependency
- API contract or versioning decisions
- Authentication and authorisation model
- Transactional boundaries
- Anything you would have to explain to a new engineer asking "why?"

**Do not write one for** library choices with no structural impact, folder
layout, naming conventions, or anything reversible in an afternoon. An ADR log
full of trivia stops being read, which defeats the purpose.

Rule of thumb: if changing your mind later means a migration, write one.

### The format

One file per decision, numbered, immutable once accepted:

```
docs/adr/
  0001-use-postgresql-as-primary-datastore.md
  0002-shared-schema-multi-tenancy.md
  0003-modular-monolith-over-services.md
  0004-integer-minor-units-for-money.md
```

```markdown
# ADR-0004: Represent money as integer minor units

- **Status:** Accepted
- **Date:** 2026-09-06
- **Deciders:** Ravi (owner), architect
- **Supersedes:** —

## Context

Prices, totals, tax, and discounts appear across checkout, reporting, and
exports. JavaScript numbers are IEEE 754 doubles and cannot represent decimal
values exactly: `0.1 + 0.2 === 0.30000000000000004`. Sequelize returns
PostgreSQL `NUMERIC` as a string to avoid this loss.

Cent-level drift across thousands of transactions does not net out, and would
surface as a reconciliation failure that is expensive to diagnose and correct
retrospectively.

## Decision

Money is represented as **integer minor units** (paise) throughout the
application, the API, and the database. Formatting to a decimal string happens
only at display time, via `Intl.NumberFormat`.

## Alternatives considered

**PostgreSQL `NUMERIC` with a decimal library in JS** — exact, and idiomatic for
financial data. Rejected because it requires every arithmetic site to use the
library correctly; a single `parseFloat` reintroduces the defect silently.

**Floating point with rounding at display** — rejected. Errors accumulate before
display, so rounding at the edge does not correct them.

## Consequences

**Positive**
- Arithmetic is exact; no float error is possible
- Comparisons and equality behave correctly
- Serialises unambiguously across the API

**Negative**
- Every boundary must convert; a missed conversion is off by 100×
- Values are not human-readable in the database
- Existing columns require a migration

**Mitigations**
- Conversion helpers in one module; direct arithmetic on major units is a review
  finding
- `CHECK (unit_price >= 0)` constraints
- Tests assert exact integers; `toBeCloseTo` on money is a review finding

## Compliance

Enforced by `postgres-code-review` and `secure-code-review`; detection commands
in `javascript`.
```

### The parts that carry the value

**Context** — the forces at the time: constraints, scale, team, deadlines. This
is what lets a future reader judge whether the decision still applies. A decision
made for 50 shops may be wrong at 5,000, and only the context reveals that.

**Alternatives with rejection reasons** — the most valuable section, and the most
often omitted. Without it, someone will propose the rejected option again in a
year, and nobody will remember why it was declined.

**Consequences, including the negative ones** — an ADR listing only benefits is
marketing. Honest trade-offs are what make the record trustworthy. Include
mitigations for the downsides you accepted.

### Status lifecycle

```
Proposed → Accepted → Deprecated
                    → Superseded by ADR-NNNN
```

**Never edit or delete an accepted ADR.** It is a historical record of what was
decided and why, not a description of the current system. When the decision
changes, write a new ADR that supersedes it, and add a link both ways.

Keep them in the repository, next to the code, reviewed like code.

### Writing well

- **Short.** One to two pages. Long ADRs go unread.
- **Plain language.** A future reader may not share your context.
- **One decision per record.** Two decisions in one file cannot be superseded
  independently.
- **Date and name the deciders.** Accountability is part of the record.
- **Write it when deciding**, not afterwards. Reconstructed reasoning is
  rationalisation.

### Checklist

- [ ] The decision is genuinely expensive to reverse
- [ ] Numbered, dated, and status set
- [ ] Deciders named
- [ ] Context states the forces and constraints at the time
- [ ] Alternatives listed **with reasons for rejection**
- [ ] Consequences include the negative ones
- [ ] Mitigations stated for accepted downsides
- [ ] How the decision is enforced is named
- [ ] One decision per record
- [ ] Stored in the repository, reviewed like code
- [ ] Superseding decisions link both ways; the original is never edited

## References

- **Michael Nygard, "Documenting Architecture Decisions" (2011)** — the original
  format and the context/decision/consequences structure
  <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>
- **`adr-tools` / adr.github.io** — numbering, status lifecycle, superseding
  convention <https://adr.github.io/>
- **arc42 — §9 Design Decisions** — where ADRs sit in a wider architecture
  document <https://arc42.org/overview>
- **ThoughtWorks Technology Radar — Lightweight ADRs** — adoption guidance
  <https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records>

**Not sourced — written for this framework:** the when-to-write and
when-not-to-write lists, the worked money-representation ADR, the "Compliance"
section naming the enforcing skills, and the checklist.
