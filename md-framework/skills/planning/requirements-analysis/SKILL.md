---
name: requirements-analysis
version: 1.0.0
description: |
  Turn a vague request into precise, testable requirements — eliciting the real
  need, surfacing hidden business rules, and marking what is unconfirmed. Use
  when a feature is requested, when a request is ambiguous, before any design
  work, or when asked "what exactly are we building".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Requirements Analysis

The people making requests describe **outcomes**, not mechanisms. "I need to see
which products aren't selling" is an outcome; the requirement is what counts as
"not selling", over what period, in which shops, and what they intend to do about
it.

Ambiguity that survives this step becomes a defect later, and it is cheapest to
resolve now.

### Confidence marking (mandatory)

Carried through from Phase 0 discovery:

- `[verified]` — read in code or confirmed by the owner. Cite it.
- `[inferred]` — deduced from existing behaviour. Say from what.
- `[assumed]` — a guess. Goes to **Open Questions**, never into the body as fact.

**Hard rule:** no requirement touching money, stock quantity, or access control
may reach an engineer while `[inferred]` or `[assumed]`. Confirm it or stop.

### Find the real need

Ask "why" until you reach the business outcome. The stated request is often a
proposed solution, and frequently not the best one.

```
"Add an export button to the sales page"
  → Why? "I need to send figures to my accountant"
  → Why that way? "It's the only way I can get last month's totals"
  → Real need: monthly totals in a form the accountant accepts
  → Possibly: a monthly summary report, or a scheduled email
```

Deliver the stated request when it is right. But record the underlying need,
because it is what acceptance is judged against.

### Read before asking

Exhaust the codebase first. Half of what gets asked is already answered by
existing behaviour — see `project-business-rules`.

```bash
grep -rniE "(discount|refund|void|adjust)" src/features/ --include=*.js | head -20
```

Arriving with "here is what the system does today, is that still right?" produces
better answers than an open question, and costs the owner less time.

### The questions that matter

**Scope**
- Who does this, and how often?
- What triggers it?
- What is explicitly *not* included?

**Rules** — the highest-risk area
- What exactly determines the outcome?
- What are the limits, thresholds, and rounding?
- Who is permitted to do it?
- Can it be undone? By whom, and until when?

**Data**
- What is recorded, and is it auditable?
- What happens to existing records?
- What must be reported afterwards?

**Failure**
- What should happen when it fails halfway?
- What if two people do it at once?
- What if the network drops mid-operation?

### Hunt the edge cases nobody mentions

Retail is dense with them, and they are where the defects live. Work this list on
every feature that touches a transaction:

| Area | Ask about |
|---|---|
| Returns | Partial returns; returns without a receipt; beyond the window; of a discounted item |
| Payment | Split across methods; over-tender and change; one leg failing; refund to a different method |
| Stock | Zero and negative; reserved-but-unpaid; expired batches; adjustments during a sale |
| Pricing | Promotion expiring mid-sale; overlapping promotions; price change while an item is in the cart |
| Concurrency | Two tills selling the last unit; same sale open twice; stock-take during trading |
| Sessions | Shift ends mid-sale; till closed with an open transaction; power loss |
| Offline | Network drops mid-payment; queued sales; conflicting sequence numbers |

The requester will not raise these. Asking about them **is** the analysis.

### Non-functional requirements

Easy to omit, expensive to retrofit. State explicitly where relevant:

- **Performance** — how fast, on what device? A till has a stricter budget than a
  report (see `performance-architecture`).
- **Volume** — how many rows, how much growth?
- **Permissions** — which roles, and is the boundary per shop?
- **Audit** — must this be attributable? Almost always yes for money and stock.
- **Availability** — what happens when it is down? Is there a manual fallback?

### Output

```markdown
# Requirements: <feature>

## Problem          — the real need, and who has it
## Users            — roles affected, and how they differ
## Scope            — in scope
## Out of scope     — explicit exclusions
## Business rules
   BR-001  <rule in business language>  [verified — sale.service.js:88]
   BR-002  <rule>                       [assumed — see Open Questions]
## Data             — recorded, changed, retained, audited
## Edge cases       — enumerated, with expected behaviour
## Failure          — partial failure, concurrency, offline
## Non-functional   — performance, volume, permissions, audit
## Open Questions   — every [assumed] item, as a plain question
```

Write rules in language the shop owner can confirm: "A sale cannot be voided
after end-of-day close" — not "`voidSale()` throws when `closedAt` is set".

### Finishing

- Batch Open Questions and ask once. Trickling questions out is the main way this
  step fails in practice.
- Flag which questions involve money, stock, or access so they are prioritised.
- Never resolve an open question by choosing the most plausible answer.
- Hand to `acceptance-criteria` and `feature-breakdown` once rules are confirmed.

### Checklist

- [ ] Underlying need identified, not just the stated request
- [ ] Existing behaviour read before asking
- [ ] Every rule marked verified / inferred / assumed
- [ ] Zero assumed rules touching money, stock, or access
- [ ] Rules written in business language, with citations
- [ ] Edge-case table worked through
- [ ] Failure, concurrency, and offline behaviour specified
- [ ] Out-of-scope list written
- [ ] Non-functional requirements stated
- [ ] Open Questions batched and escalated once

## References

- **ISO/IEC/IEEE 29148:2018 (superseding IEEE 830)** — requirement
  characteristics: unambiguous, verifiable, complete, consistent
- **Karl Wiegers, _Software Requirements_** — elicitation technique and the
  need-behind-the-request approach
- **Gojko Adzic, _Specification by Example_** — expressing rules in the
  business's own language
- **INVEST criteria (Bill Wake)** — negotiable, valuable, testable requirements
  <https://xp123.com/articles/invest-in-good-stories-and-smart-tasks/>

**Not sourced — written for this framework:** the confidence marking and the
money/stock/access blocking rule, the retail edge-case table, the
non-functional prompts, and the output template.
