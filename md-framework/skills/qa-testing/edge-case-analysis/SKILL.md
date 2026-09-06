---
name: edge-case-analysis
version: 1.0.0
description: |
  Systematically find the inputs and states nobody specified — boundaries,
  empties, extremes, invalid values, and unusual sequences. Use when writing
  tests, reviewing requirements, after a production defect, or when asked "what
  else could go wrong here".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Edge Case Analysis

Defects cluster at boundaries and in states nobody described. This is a
**systematic** technique, not creativity — work the categories and the cases
appear.

### Boundary value analysis

For any bounded value, test the boundary and both sides of it. Off-by-one is the
most common arithmetic defect in software.

```
Quantity 1–100:  test 0, 1, 2, 99, 100, 101
Discount 0–100%: test -1, 0, 1, 99, 100, 101
Stock available: test 0, 1, exactly the requested amount, one less, one more
Date range:      test the first day, the last day, one day outside each end
```

The highest-value case in retail: **buying exactly the remaining stock**, then
one more. That single boundary catches most stock defects.

### Equivalence partitioning

Group inputs that should behave identically, test one from each group plus every
boundary between them. Testing five valid quantities adds nothing; testing one
valid, one at each boundary, and one invalid covers the space.

### The standing checklist

Work every category on every feature.

**Empty and absent**
- Empty list, empty string, whitespace only
- `null` vs `undefined` vs missing field vs `0` vs `false`
- No results, no permissions, no products, first-ever record
- Empty cart, sale with no lines

**Extremes**
- Very large quantities, very large totals, integer limits
- Very long names, SKUs, notes — do they truncate, wrap, or break layout?
- Thousands of lines on one sale
- A shop with 100,000 products
- Reports spanning years

**Invalid and hostile**
- Negative quantity, negative price, negative discount
- Non-numeric where numeric expected; `NaN`, `Infinity`
- Unicode, emoji, RTL text, zero-width characters in names
- SQL and HTML metacharacters in every text field
- Values from another tenant

**Numeric and money**
- Zero-value sale, zero-price product, 100% discount
- Rounding boundaries — `.005`, `.995`
- Discount driving price below cost
- Tax on a zero-rated item
- Currency precision limits

**Time**
- Midnight, month end, year end, financial year end
- Daylight-saving transitions
- Leap day
- A transaction spanning midnight or a promotion boundary
- Clock skew between a till and the server
- Timezone differences across shops

**State and sequence**
- Acting on an already-completed, already-voided, or already-refunded record
- Out-of-order operations — refund before payment settles
- Interrupted operations — closing mid-sale, power loss
- Stale data — acting on a record changed since it was loaded
- Repeated identical requests

**Concurrency**
- Two users editing the same record
- Two tills selling the last unit
- Stock adjustment during a sale
- Shift close while a sale is open
- Same request submitted twice

**Permissions**
- Each role attempting each operation, including the negatives
- Another shop's record by id
- A role changed mid-session
- A disabled user with a still-valid token

**Environment**
- Network drop mid-request; slow network
- Offline, then reconnect
- Browser back button and refresh mid-flow
- Two tabs on the same sale
- Scanner input arriving while the field is unfocused

### Derive cases from the domain

Beyond the checklist, ask what is unusual **in retail**:

- A product with no price set
- A product deleted after being sold
- Returning an item bought under a since-expired promotion
- A refund larger than the original after a partial refund
- Weighted goods where quantity is fractional
- A bundle whose components are individually out of stock
- Cash tendered less than the total

### Prioritise

You cannot test everything. Rank by cost of failure:

1. Anything producing a wrong money or stock number
2. Anything permitting a permission bypass
3. Anything causing data loss or corruption
4. Anything crashing a user flow
5. Cosmetic issues

### Record and reuse

An edge case found in production is a permanent addition to this checklist —
that is how it improves. Feed confirmed cases into `acceptance-criteria` so they
become regression tests, and note recurring classes in `bug-analysis`.

### Checklist

- [ ] Boundary values tested on both sides for every bounded input
- [ ] Equivalence partitions identified; one case per partition plus boundaries
- [ ] Empty and absent category worked
- [ ] Extremes tested, including display and layout impact
- [ ] Invalid and hostile inputs tested on every text field
- [ ] Money edge cases: zero, 100%, rounding boundaries, below cost
- [ ] Time edge cases including DST and period boundaries
- [ ] State and sequence: repeat, out-of-order, interrupted, stale
- [ ] Concurrency cases for shared records
- [ ] Permission negatives per role, including cross-tenant
- [ ] Environment: offline, reconnect, refresh, multiple tabs
- [ ] Domain-specific cases derived
- [ ] Cases prioritised by cost of failure
- [ ] Production-found cases added to the standing list

## References

- **ISTQB Foundation Level syllabus** — boundary value analysis and equivalence
  partitioning <https://www.istqb.org/>
- **Elisabeth Hendrickson, _Explore It!_** — heuristics for generating
  variations and unusual states
- **Cem Kaner et al., _Testing Computer Software_** — systematic input analysis
- **OWASP Web Security Testing Guide** — hostile input categories
  <https://owasp.org/www-project-web-security-testing-guide/>

**Not sourced — written for this framework:** the standing category checklist,
the retail-specific domain cases, the exactly-the-remaining-stock boundary, and
the prioritisation order.
