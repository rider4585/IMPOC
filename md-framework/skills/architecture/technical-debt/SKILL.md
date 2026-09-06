---
name: technical-debt
version: 1.0.0
description: |
  Identify, quantify, and sequence technical debt — distinguishing deliberate
  trade-offs from decay, estimating cost and risk, and deciding what to repay.
  Use when maintaining a debt register, when velocity is dropping, when arguing
  for remediation time, or when asked "should we fix this now".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Technical Debt

Debt is a **deliberate trade-off**: taking a shortcut now, knowing it costs
interest later. That is a legitimate engineering decision.

What is usually called debt is not debt at all — it is decay, or code that was
never good. The distinction matters because it changes the response.

| Kind | Origin | Response |
|---|---|---|
| **Deliberate debt** | Knowingly shipped a shortcut | Track, schedule repayment |
| **Accidental debt** | Learned better later | Refactor when touching it |
| **Decay** | Environment moved — deps, versions, platform | Continuous maintenance |
| **Not debt** | Code you dislike stylistically | Leave it alone |

"Not debt" matters. Rewriting working code because it is not to your taste
consumes budget that real debt needs.

### Quantify, or it will not be prioritised

"The sales module is messy" loses every argument against a feature request. Debt
competes for time and must be stated in comparable terms.

For each item record:

| Field | Example |
|---|---|
| **What** | Stock decrement is read-modify-write, not atomic |
| **Where** | `src/features/sales/sale.service.js:88` |
| **Interest** | ~4 h/month diagnosing oversell reports |
| **Risk** | Overselling under concurrent checkout — customer-facing, financial |
| **Repayment cost** | ~4 h — atomic update + `CHECK` constraint + concurrency test |
| **Blast radius** | Checkout path; needs regression testing |
| **Trigger** | Immediate — financial correctness |

Interest and risk are what make the case. A four-hour fix removing a financial
correctness risk needs no further argument; a two-week refactor saving an hour a
month does not survive the comparison, and should not.

### Finding it

```bash
# Explicit markers
grep -rn "TODO\|FIXME\|HACK\|XXX\|@deprecated" src/ --include=*.js --include=*.jsx | wc -l
# Churn — files changed most often are where debt costs most
git log --format= --name-only -n 500 | sort | uniq -c | sort -rn | head -20
# Complexity proxy
find src -name '*.js' -o -name '*.jsx' | xargs wc -l | sort -rn | head -15
# Dependency decay
npm outdated; npm audit --audit-level=high
# Co-change: modules that always change together
git log --format='%H' -n 200 | while read c; do
  git show --name-only --format= "$c" | grep -oE 'features/[a-z]+' | sort -u | paste -sd, -
done | sort | uniq -c | sort -rn | head
```

**Cross-reference churn with complexity.** A large, tangled file nobody touches
costs nothing; a moderately messy file changed weekly is where the interest is
actually paid. Prioritise the intersection, not the worst file.

Reviewers reporting the same class of issue three times is also a debt signal —
that is systemic, not three bugs.

### Prioritise by risk × interest

| Risk | High interest | Low interest |
|---|---|---|
| **High** | Fix now — often blocks other work | Schedule this quarter |
| **Low** | Fix when next touching the area | Log it; may never be worth fixing |

Items that never reach the top of this matrix should be **closed as accepted**,
not carried forever. A register full of items nobody will ever do is noise that
hides the real ones.

For a retail system, these sit permanently in the top-left and outrank most
feature work:

- Anything that can make money or stock incorrect
- Anything unattributable that changes money or stock
- Missing tenant scoping
- Missing transactional boundaries on checkout

### Repay incrementally

**Prefer the boy-scout rule to dedicated refactor projects.** Improve the code
you are already touching, in the same change, within the scope of the task.

Big-bang rewrites fail predictably: they take longer than estimated, run in
parallel with continued feature work, and reproduce the original bugs. Reserve
them for cases where incremental change is genuinely impossible, and require an
ADR and a human decision.

For structural debt, use **strangler fig**: build the new path alongside the old,
migrate callers incrementally, delete the old one when nothing references it.
Each step ships and is reversible.

**Do not mix debt repayment with feature work in the same change.** A diff
containing both is hard to review and hard to revert — see the scope rules in the
orchestrator instructions.

### Prevent accumulation

- Definition of done includes tests and documentation
- Review gates catch structural drift early
- Dependencies updated continuously, not in an annual project
- Deliberate shortcuts logged **when taken**, with the reason and a trigger
- Constraints and types encode invariants so decay is harder

A shortcut recorded at the moment it is taken costs a minute; reconstructing why
it exists two years later costs a day.

### The register

Keep it in the repository, reviewed like code:

```markdown
| ID | Item | Where | Risk | Interest | Cost | Trigger | Status |
|----|------|-------|------|----------|------|---------|--------|
| TD-001 | Non-atomic stock decrement | sale.service.js:88 | High — oversell | 4h/mo | 4h | Now | Open |
| TD-004 | Sales report unbounded by date | reports.service.js:22 | Med — outage risk | 1h/mo | 3h | Before 100 shops | Open |
| TD-009 | Legacy catchAsync wrappers | routes/* | None | None | 2h | — | Accepted |
```

Review it on a cadence with the human. Items with no trigger and no interest are
closed as accepted.

### Checklist

- [ ] Each item classified: deliberate, accidental, decay, or not debt
- [ ] Stylistic preferences excluded
- [ ] Every item has location, risk, interest, and repayment cost
- [ ] Churn cross-referenced with complexity to prioritise
- [ ] Money, stock, attribution, and tenancy items ranked highest
- [ ] Prioritised by risk × interest
- [ ] Items that will never be done closed as accepted
- [ ] Repayment incremental; rewrites require an ADR
- [ ] Debt repayment not mixed into feature changes
- [ ] New deliberate shortcuts logged when taken
- [ ] Register in the repository and reviewed on a cadence

## References

- **Ward Cunningham — the original debt metaphor** — debt as a deliberate
  trade-off, not bad code <https://wiki.c2.com/?WardExplainsDebtMetaphor>
- **Martin Fowler — Technical Debt Quadrant** — deliberate/inadvertent ×
  prudent/reckless <https://martinfowler.com/bliki/TechnicalDebtQuadrant.html>
- **Martin Fowler — Strangler Fig Application** — incremental structural
  replacement <https://martinfowler.com/bliki/StranglerFigApplication.html>
- **Michael Feathers, _Working Effectively with Legacy Code_** — the boy-scout
  rule and safe incremental change
- **Adam Tornhill, _Your Code as a Crime Scene_** — churn × complexity as a
  prioritisation signal

**Not sourced — written for this framework:** the four-kind classification table,
the quantification fields, the retail always-top-priority list, the register
format, and the detection commands.
