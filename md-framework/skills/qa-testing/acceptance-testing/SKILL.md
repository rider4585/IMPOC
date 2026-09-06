---
name: acceptance-testing
version: 1.0.0
description: |
  Verify a feature against its acceptance criteria and confirm it solves the
  requester's actual problem. Use when a feature is ready for sign-off, before
  release, or when asked "is this ready to ship". Distinct from technical
  correctness — this asks whether the right thing was built.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Acceptance Testing

Every other level asks *does it work correctly?* This asks *is it the right
thing, and can the business accept it?* A feature can pass every technical test
and still fail acceptance because it solved the wrong problem.

### Test against the criteria, verbatim

Work through each acceptance criterion as written — see `acceptance-criteria`.
Do not paraphrase them into what you think was meant.

```markdown
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| AC-1 | Voiding a completed sale restores stock | ✅ Pass | Stock 10 → 7 → 10 |
| AC-2 | A cashier cannot void a sale | ✅ Pass | 403 returned |
| AC-3 | Void records actor and reason | ❌ Fail | Reason stored, actor null |
| AC-4 | Voided sale cannot be voided again | ⚠️ Partial | Rejected, but error is generic |
```

Record **evidence**, not just a verdict. "Pass" without evidence is an opinion.

### Then check it solves the real problem

Criteria can be met while the need is not. Return to the problem statement from
`requirements-analysis`:

- Does this address the **underlying need**, or only the literal request?
- Can the intended user complete the task without help?
- Is it usable in the real environment — a busy till, not a quiet desk?
- Does it fit existing workflows, or force an awkward detour?

A stock adjustment feature that technically works but takes eleven taps during
trading hours will not be used, and staff will keep a paper note instead. That is
an acceptance failure, and it is better found now than after rollout.

### Verify with realistic data and conditions

Acceptance testing on three seeded products proves very little.

- Realistic volume — hundreds of products, months of sales
- Real-world names: long, unicode, punctuation, near-duplicates
- Actual device and viewport — the till, not a laptop
- Realistic timing — try it while other operations are running
- Every relevant role, including the most restricted

### Business rule verification

For anything touching money, walk **worked examples by hand** and compare:

```
Line: 3 × ₹19.99, 10% discount, 18% GST
  Subtotal          ₹59.97
  Discount (10%)     ₹6.00   (5.997 → half-up)
  Net               ₹53.97
  GST (18%)          ₹9.71   (9.7146 → half-up)
  Total             ₹63.68
```

Compare against the system's output digit for digit. A one-paisa difference is a
finding, not a rounding preference — it means the implemented rule differs from
the documented one, and it will compound.

Have the **business owner confirm** the expected figures where any rule was
marked `[assumed]` during requirements.

### Who signs off

| Concern | Verifier |
|---|---|
| Criteria met | QA |
| Business rules correct | The human owner |
| Money and tax figures | The human owner — always |
| Usable in practice | The intended user, if available |
| Technically sound | The review lanes |

**Money and tax rules require human sign-off.** QA can verify the system does
what the spec says; only the owner can confirm the spec is right, and being wrong
there is a compliance problem rather than a bug.

### Outcomes

- **Accepted** — all criteria pass, problem solved, owner signed off
- **Accepted with defects** — ships with `LOW`/`MEDIUM` issues logged and
  scheduled; never with an open money, stock, or access defect
- **Rejected** — criteria unmet, or it does not solve the problem. State which.

### Before sign-off

Confirm the surrounding obligations, not just the feature:

- Audit records written for every money and stock operation
- Permissions correct for every role
- Error and empty states usable
- Existing data unaffected, or migrated and reconciled
- Knowledge skills (`project-*`) updated if behaviour changed

### Checklist

- [ ] Every acceptance criterion tested verbatim, with evidence
- [ ] Underlying problem re-checked, not just the literal request
- [ ] Tested with realistic data volume and real-world values
- [ ] Tested on the actual target device and viewport
- [ ] Tested as every relevant role
- [ ] Money and tax figures verified by hand against worked examples
- [ ] Previously assumed rules confirmed by the owner
- [ ] Audit records verified
- [ ] Existing data checked for impact
- [ ] Knowledge documentation updated
- [ ] Outcome recorded with defects listed
- [ ] No open money, stock, or access defect at sign-off

## References

- **ISTQB Foundation Level syllabus** — acceptance testing objectives and the
  distinction from system testing <https://www.istqb.org/>
- **Gojko Adzic, _Specification by Example_** — verifying against concrete
  examples with business participation
- **ISO/IEC/IEEE 29119-3** — test result reporting
- **Nielsen Norman Group — usability in context** — why environment matters
  <https://www.nngroup.com/articles/usability-testing-101/>

**Not sourced — written for this framework:** the evidence-recording table, the
worked money verification requirement, the sign-off responsibility table with
mandatory human approval for money and tax, and the pre-sign-off obligations.
