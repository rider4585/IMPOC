---
name: acceptance-criteria
version: 1.0.0
description: |
  Write testable acceptance criteria in Given/When/Then that define done for a
  feature — covering happy paths, edge cases, failures, and permissions. Use when
  specifying a feature, before implementation begins, or when asked "how will we
  know this is finished". Feeds directly into test planning.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Acceptance Criteria

Acceptance criteria define **done**. They are the contract between the person who
asked, the engineer who builds, and the tester who verifies.

**The rule:** if you cannot state how to verify it, it is not a criterion — it is
a wish. Delete it or rewrite it.

### Given / When / Then

```gherkin
Scenario: Void a completed sale restores stock
  Given a completed sale of 3 units of "Blue Pen"
    And the current stock of "Blue Pen" is 10
   When a manager voids the sale with reason "customer changed mind"
   Then the sale status becomes "void"
    And the stock of "Blue Pen" becomes 13
    And an audit record is created with the manager's id and the reason
```

- **Given** — the starting state, and only what matters to this scenario
- **When** — one action, by a named role
- **Then** — observable outcomes, all of them

### Observable behaviour only

Criteria describe what a user or an API client can see. They must survive a
refactor.

```gherkin
# ❌ implementation — breaks when the code changes, tests nothing meaningful
Then voidSale() is called and sets status to 'void' in the sales table

# ✅ behaviour — still true after any rewrite
Then the sale appears as "Voided" in the sales list
 And the stock level increases by the sold quantity
```

If a criterion names a function, table, or file, rewrite it.

### Cover more than the happy path

One happy path and five edge cases is a healthy ratio. Work through each
category:

**Happy path** — the intended flow, once.

**Edge cases** — boundaries and unusual but valid states.
```gherkin
Scenario: Voiding a partially refunded sale
Scenario: Voiding a sale containing a since-deleted product
Scenario: Voiding the last sale before end-of-day close
```

**Failures** — what happens when it cannot proceed.
```gherkin
Scenario: Voiding a sale that is already void
   Then the request is rejected with "This sale has already been voided"
    And no stock movement is recorded
```

**Permissions** — one per role that matters, including the negative case.
```gherkin
Scenario: A cashier cannot void a sale
   When a cashier attempts to void the sale
   Then the request is refused
    And the sale remains completed
```

**Concurrency** — wherever two people can act at once.
```gherkin
Scenario: Two tills sell the last unit simultaneously
  Given the stock of "Blue Pen" is 1
   When two sales for 1 unit are submitted at the same time
   Then exactly one succeeds
    And the other is rejected as out of stock
    And the stock is 0, never negative
```

The concurrency scenarios are the ones nobody writes and the ones that fail in
production — see `concurrency`.

### Be exact about numbers

Money and quantity criteria must state precise values, including rounding.

```gherkin
# ❌ unverifiable
Then the total is calculated correctly

# ✅ exact, and encodes the rounding rule
  Given a line of 3 units at ₹19.99 with a 10% discount
   Then the line subtotal is ₹53.97
    And the discount is ₹5.40   # 5.397 rounded half-up
    And the line total is ₹48.57
```

Worked examples with real numbers catch rounding disagreements before code
exists. If you cannot compute the expected value, the rule is not yet defined —
return to `requirements-analysis`.

### Include the states, not just the outcome

Every async operation has states the user sees. They are part of done.

```gherkin
Scenario: The sales list is loading
   Then a skeleton matching the table layout is shown

Scenario: No sales match the active filters
   Then the message distinguishes "no sales yet" from "none match these filters"
    And a way to clear the filters is offered
```

See `loading-states`.

### Definition of done

Acceptance criteria say what the feature does. The definition of done says what
"finished" means for every feature — keep it separate and standing:

- All acceptance criteria pass
- Tests written, including negative and concurrency cases
- Applicable review lanes passed
- No `CRITICAL` or `HIGH` findings open
- Documentation and knowledge skills updated if behaviour changed
- Audit records verified for money and stock operations

### Checklist

- [ ] Every criterion verifiable — you can state how to test it
- [ ] Written as observable behaviour, no implementation references
- [ ] Happy path covered
- [ ] Edge cases covered, drawn from the requirements edge-case list
- [ ] Failure behaviour specified, including partial failure
- [ ] Permission cases per relevant role, including negatives
- [ ] Concurrency scenarios wherever simultaneous action is possible
- [ ] Money and quantity values exact, with rounding shown
- [ ] Loading, empty, and error states included
- [ ] Confirmed with the requester before implementation
- [ ] Handed to QA as the basis for the test plan

## References

- **Gherkin syntax (Cucumber)** — Given/When/Then structure and scenario style
  <https://cucumber.io/docs/gherkin/reference/>
- **Gojko Adzic, _Specification by Example_** — concrete examples as
  specification, and worked numeric examples
- **Dan North — Introducing BDD** — the origin of the Given/When/Then form
  <https://dannorth.net/introducing-bdd/>
- **INVEST criteria (Bill Wake)** — testable as a property of a good requirement
  <https://xp123.com/articles/invest-in-good-stories-and-smart-tasks/>

**Not sourced — written for this framework:** the six coverage categories
including concurrency, the exact-numbers rule with worked rounding, the
requirement to specify async states, and the standing definition of done.
