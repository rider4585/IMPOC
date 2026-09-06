---
name: architecture-review
version: 1.0.0
description: |
  Review a design or an existing structure against correctness, boundaries,
  scalability, security, and operability — and issue a verdict. Use as the
  architecture lane of a review gate, when evaluating a proposal, or when asked
  "is this design sound". Reports findings and a verdict; does not implement.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Architecture Review

Review the design **before** it is built, when a finding costs a conversation
rather than a rewrite. Report findings and a verdict; never implement.

A review that only says "no" is unfinished. Every rejection carries a reason and
a path forward.

### Before reviewing

1. **Read `project-architecture`** — a design is only assessable against the
   system that exists.
2. **Establish what problem this solves.** A design without a stated problem
   cannot be evaluated, only admired. If the problem is unclear, that is the
   first finding.
3. **Establish the constraints** — scale, deadline, team, existing data.

### The lanes

**1. Problem and fit**
- Is the problem stated, and is this design solving it?
- Does it fit the system that exists, or assume one that does not?
- Is the complexity proportionate to the problem?
- Is there a simpler design that meets the requirement?

*The most valuable finding an architecture review produces is "this is more than
the problem needs".*

**2. Boundaries and ownership**
- Are modules capability-shaped, not technical-type-shaped?
- **One writing module per table?** Shared writers are `HIGH`.
- Are cross-module accesses through explicit contracts?
- Any dependency cycles introduced?
- Does the public surface stay small?

**3. Data and transactions**
- Are atomic boundaries specified where money or stock moves?
- Can a partial failure leave money and stock inconsistent?
- Is the tenancy model applied — `shop_id` present, in unique constraints,
  enforced structurally?
- Are invariants enforced by constraints, not only application code?
- Is derived data reconcilable?

**4. Contracts**
- Is the API designed from client use cases, or exposing tables?
- How many round trips does the primary screen need?
- Are changes additive or breaking? Is versioning handled?
- Is every resource scopable to a tenant?
- Is authority (`role`, `shopId`, price) taken from the session, never the
  payload?

**5. Security**
- Are controls structural, or reliant on discipline?
- Trust boundaries identified; validation and authorisation on the trusted side?
- Do controls fail closed?
- Is every money/stock/access operation attributable, with reason where relevant?
- Threat model needed? Route to `threat-modeler`.

**6. Scale and performance**
- Which growth dimension does this affect, and what are the numbers?
- Is the query count per endpoint bounded by design?
- Is anything unbounded — pagination, exports, report ranges?
- Does it introduce contention on a hot row?
- Is slow or unreliable work outside the request path?

**7. Operability**
- How is it deployed, and can it be rolled back?
- Is it observable — correlation ids, metrics, logs?
- What happens when each dependency fails?
- Are migrations safe on live data, and reversible?
- What does the on-call story look like at 2 a.m.?

**8. Reversibility**
- Is this reversible? If not, is there an ADR and a human checkpoint?
- What would it cost to undo in six months?

### Severity

| Level | Meaning | Examples |
|---|---|---|
| `CRITICAL` | Data loss, or money/stock can become inconsistent | Non-atomic sale + stock; unscoped tenant access |
| `HIGH` | Serious structural defect, expensive later | Shared table writers; missing versioning; control that fails open |
| `MEDIUM` | Real problem, bounded | Unbounded export; N+1 by design; missing reconciliation |
| `LOW` | Should improve | Naming, doc gaps |
| `INFO` | Observation | Alternative worth noting |

### Verdict

Exactly one:

- **APPROVED** — proceed
- **APPROVED WITH CONDITIONS** — proceed; listed items must be addressed during
  implementation and re-checked at code review
- **NEEDS REVISION** — specific changes required, then re-review
- **REJECTED** — the approach is wrong; state why and what to do instead

A `CRITICAL` or `HIGH` finding blocks approval.

### Reporting

```
SEVERITY   CRITICAL
AREA       Data and transactions
ISSUE      Stock decrement is in a separate transaction from sale creation
IMPACT     A failure between them leaves a sale with no stock movement;
           inventory and sales reports disagree with no way to reconcile
FIX        Single transaction covering sale, lines, stock movement, and payment.
           Move the receipt PDF generation outside it — it does not need to be
           atomic and should not extend the transaction.
```

Every finding names the area, the concrete consequence, and a specific
alternative.

### Reviewing existing architecture

Same lanes, different output: findings feed the debt register rather than a
verdict, quantified by cost and risk — see `technical-debt`. Do not propose a
rewrite; propose the smallest change that removes the largest risk.

### Checklist

- [ ] `project-architecture` read first
- [ ] Problem statement and constraints established
- [ ] All eight lanes applied
- [ ] Simpler alternatives considered and named
- [ ] Table ownership checked for shared writers
- [ ] Atomicity verified for money and stock paths
- [ ] Tenancy enforcement checked
- [ ] Controls checked for structural placement and fail-closed behaviour
- [ ] Query counts and unbounded operations checked
- [ ] Rollback and observability addressed
- [ ] Reversibility judged; ADR required if irreversible
- [ ] Every finding has severity, impact, and a specific alternative
- [ ] One verdict issued

## References

- **AWS Well-Architected Framework** — the review-by-pillar method underlying the
  lanes
  <https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html>
- **arc42 / C4 model** — what a design must describe to be reviewable
  <https://arc42.org/overview>
- **Michael Nygard, _Release It!_** — operability, failure modes, and stability
  patterns
- **OWASP Top 10 (2021) A04 Insecure Design** — the security lane
  <https://owasp.org/Top10/A04_2021-Insecure_Design/>
- **Martin Fowler — Who Needs an Architect?** — architecture as
  irreversible decisions <https://martinfowler.com/ieeeSoftware/whoNeedsArchitect.pdf>

**Not sourced — written for this framework:** the eight-lane structure, the
retail-specific criteria (atomic sale/stock, tenancy, hot-row contention), the
severity mapping, the four verdicts, and the finding format.
