---
name: project-business-rules
version: 1.0.0
description: |
  Extract the business rules an existing system actually enforces — from
  validators, service logic, database constraints, and state machines — and
  record them in reviewable language. Produces
  docs/project-knowledge/business-rules.md. Use when asked "what are the business
  rules", "how does this feature actually work", "why does the system reject
  this", or when starting Phase 0 discovery. Run this before changing any logic
  that touches money, stock, or access.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Project Business Rules Discovery

Business rules are the part of a system where being wrong is not a bug report —
it is money, stock, or compliance. They are rarely documented and almost never
in one place. Your job is to find them and state them in language the business
owner can confirm.

### Confidence marking (mandatory)

`[verified]` (read in code, cited) · `[inferred]` (deduced from behaviour or
naming) · `[assumed]` (Open Questions).

**Hard rule:** a rule touching money, stock quantity, or access control may never
leave this skill as `[inferred]` or `[assumed]` without appearing in Open
Questions. Downstream agents are forbidden from implementing against an
unconfirmed rule of this kind.

### Where rules hide

Look in all six places. Rules found in only one are usually incomplete.

| Location | What to look for |
|---|---|
| Validators / DTOs | Field-level constraints, allowed ranges, required combinations |
| Service layer | The real logic — conditionals, guards, early returns |
| Database constraints | `CHECK`, `UNIQUE`, `NOT NULL`, FK cascade rules |
| State machines | Allowed status transitions, and who may trigger them |
| Scheduled jobs | Rules that fire on time rather than on request |
| Tests | Often the clearest statement of intended behaviour |

### Method

1. **Pick one domain at a time.** Rules cluster by entity. Do orders, then stock,
   then pricing — never all at once.

2. **Read the service layer first, then the validators.** Validators show what is
   *accepted*; services show what actually *happens*. When they disagree, the
   service is the rule and the validator is a filter.

3. **Trace every conditional that changes an outcome.** For each `if` that
   rejects, branches, or alters a number, ask: what business fact is this
   encoding? Write that fact, not the code.

4. **Map state transitions explicitly.** For any entity with a status, build the
   full transition table: from-state, to-state, trigger, who may do it, side
   effects. Missing transitions are as significant as present ones.

5. **Find the rules the database enforces.** A `CHECK` constraint is a rule the
   application cannot violate — record it alongside application rules, marked as
   database-enforced.

6. **Identify the rounding and unit conventions.** Currency storage (minor units
   vs decimal), rounding direction, tax inclusivity, and quantity precision. These
   are silently assumed everywhere and wrong somewhere.

7. **Write each rule so a non-engineer can confirm it.** "A sale cannot be voided
   after end-of-day close" — not "`voidSale()` throws when `closedAt != null`".
   Cite the code, but state the rule in business language.

### Output

Write `docs/project-knowledge/business-rules.md`:

```markdown
# Business Rules

## Conventions       — currency units, rounding, timezone, precision
## <Domain>
### BR-<domain>-001  <one-line rule in business language>
- **Confidence:** verified
- **Enforced at:** `src/services/order.service.ts:142`
- **Behaviour on violation:** rejected with 422, no partial write
- **Notes:** interacts with BR-stock-004

## State Transitions — table per entity
## Database-Enforced Rules
## Open Questions    — every unconfirmed rule, as a plain question
```

Give every rule a stable `BR-` identifier. Other documents and agents will cite
these.

### Finishing

- Append durable facts to `$AGENT_DIR/memory.md`.
- `propose` Open Questions to `god` in one batch, flagging which involve money,
  stock, or access so they can be prioritised for human confirmation.
- Never resolve an Open Question by choosing the most plausible answer.

## References

- **Michael Feathers, _Working Effectively with Legacy Code_** — reading
  behaviour from existing code without changing it (steps 2–3)
- **Eric Evans, _Domain-Driven Design_** — expressing rules in the domain's own
  language rather than implementation terms (step 7)
- **Martin Fowler, _Patterns of Enterprise Application Architecture_** — state
  machine and transition-table treatment (step 4)
- **PostgreSQL 16 documentation — Constraints** — database-enforced rules (step 5)
  <https://www.postgresql.org/docs/16/ddl-constraints.html>
- **Munder Difflin `PROTOCOL.md`** — memory write-back and `propose` handoff

**Not sourced — added deliberately:** the confidence marking, the `BR-` numbering
convention, and the prohibition on implementing against unconfirmed money, stock,
or access rules.
