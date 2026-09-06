---
name: project-roadmap
version: 1.0.0
description: |
  Capture project direction, priorities, and constraints that cannot be read from
  code — through structured interview with the human owner. Produces
  docs/project-knowledge/roadmap.md. Use when asked "what are we building next",
  "document the roadmap", "what are the priorities", "what constraints do we have",
  or when starting Phase 0 discovery. This is the one knowledge skill with no
  code-reading path; the answers exist only in the owner's head.
allowed-tools:
  - Read
  - Write
---

## Project Roadmap Discovery

Every other knowledge skill reads the codebase. This one cannot. Direction,
priorities, deadlines, and constraints are facts only the owner holds, and
inventing them is worse here than anywhere else — a fabricated priority
misdirects every agent downstream.

### The one rule

**Nothing in this document may be marked `[inferred]`.** Each statement is either
`[confirmed]` — the human said it — or it is a question. There is no middle
state. You may not deduce a roadmap from the code, from the commit history, or
from what would be sensible.

### Method

1. **Read the other knowledge documents first.** Discovery findings make the
   interview shorter and sharper. If `architecture.md` shows no test suite, ask
   about quality appetite rather than asking what the stack is.

2. **Ask in one batch, not a trickle.** Draft the full question set, send it as a
   single `request` to `god`, and wait. Interrupting the owner repeatedly is the
   main way this skill fails in practice.

3. **Cover these areas.** Adapt the wording; keep the coverage.

   **Direction**
   - What is the next meaningful milestone, and what makes it meaningful?
   - What should be true in six months that is not true today?
   - What are we deliberately *not* building?

   **Priorities**
   - If only one thing ships this month, which?
   - Which is worse right now: a bug in production, or a delayed feature?
   - What is the current top complaint from actual users?

   **Constraints**
   - Hard deadlines, and what drives them (regulatory, seasonal, commercial)?
   - Budget or team limits that affect technical choices?
   - Anything that must not change — integrations, contracts, data formats?

   **Users and scale**
   - Who uses this, in what setting, on what devices?
   - Current and expected scale — records, transactions, concurrent users?
   - Which flows are used constantly versus rarely?

   **Quality bar**
   - What is the tolerance for downtime, and for data error?
   - Is this handling regulated data or payments? Which regimes apply?
   - Where is "good enough" genuinely acceptable?

   **History**
   - What has been tried and abandoned, and why?
   - Which parts is the owner uneasy about?
   - What would they rebuild given the chance?

4. **Record answers verbatim where they are decisive.** A paraphrase of a priority
   loses the qualifier that made it a priority.

5. **Convert answers into agent-actionable constraints.** "We're seasonal, Q4 is
   80% of revenue" becomes an explicit rule: *no risky deploys October through
   December*. That translation is the value this document adds.

6. **Date everything and re-confirm on a cadence.** Roadmaps decay faster than
   schemas. Record the date of each answer; treat anything older than a quarter as
   stale and re-ask.

### Output

Write `docs/project-knowledge/roadmap.md`:

```markdown
# Roadmap & Constraints
*Last confirmed: YYYY-MM-DD with <owner>*

## 1. Direction        — next milestone, six-month picture, explicit non-goals
## 2. Priorities       — ordered, with the tie-breaker rule
## 3. Constraints      — deadlines, budget, immovables
## 4. Users & Scale    — who, where, how many, hot paths
## 5. Quality Bar      — downtime and data-error tolerance, compliance regimes
## 6. History          — abandoned attempts, known unease
## 7. Derived Rules    — constraints translated into agent-actionable rules
## Open Questions      — asked, not yet answered
```

Every statement carries `[confirmed YYYY-MM-DD]`.

### Finishing

- Append durable facts to `$AGENT_DIR/memory.md` — this is high-value context for
  every future session.
- `propose` the document to `god`, who owns priority decisions and is the sole
  scribe of `board.md`.
- If the owner does not answer, the document stays incomplete and honest. An
  unanswered question is a legitimate final state; a fabricated answer is not.

## References

- **Munder Difflin `PROTOCOL.md`** (hive root) — `god` as the human's proxy for
  decisions and sole scribe of `board.md`, which is why answers route through
  `god` rather than direct human contact
- **Munder Difflin `roster.json` / `config.json`** — the human-owner relationship
  this interview depends on

**Not sourced — written for this framework:** the question set in step 3, the
`[confirmed]`-or-question rule, the answer-to-constraint translation in step 5,
and the quarterly staleness convention. There is no published standard for this;
it is structured to match how the hive routes human decisions.
