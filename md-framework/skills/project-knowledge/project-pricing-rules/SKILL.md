---
name: project-pricing-rules
version: 1.0.0
description: |
  Document how an existing system determines the price a customer pays: price
  resolution order, tax treatment, discounts and their stacking rules, rounding,
  promotions, and price overrides. Produces
  docs/project-knowledge/pricing-rules.md. Use when asked "how is price
  calculated", "document pricing rules", "how does tax work", "why did this
  discount apply", or when starting Phase 0 discovery. Required before any change
  to price, tax, or discount logic.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Project Pricing Rules Discovery

Pricing is where small errors compound invisibly. A rounding direction recorded
wrongly here becomes a tax liability discovered at audit. Precision is the whole
job.

> **Domain skill.** Retail pricing. Replace on a branch for other verticals.

### Confidence marking (mandatory)

`[verified]` (read in code, cited) · `[inferred]` · `[assumed]`.

**Hard rule:** no pricing, tax, discount, or rounding rule may be implemented
against while `[inferred]` or `[assumed]`. These are the highest-risk rules in
the system.

### Method

1. **Find the single calculation path — or prove there isn't one.** Locate every
   place a final price is computed. Multiple independent implementations (cart,
   checkout, invoice, report) that can disagree is the most important finding
   this skill can produce.
   ```bash
   grep -rnE "(price|total|subtotal|tax|vat|discount|net|gross)" src/ --include=*.js | head -50
   ```

2. **Establish the storage representation.** Minor units (integer cents) or
   decimal? Floating point anywhere in the chain is a defect — record every
   occurrence. Note the currency model and whether multi-currency exists.

3. **Document the price resolution order.** Which price wins when several apply:
   base price, customer-group price, contract price, promotional price,
   quantity break, manual override. Write the precedence explicitly as an ordered
   list, then verify it in code.

4. **Document tax treatment precisely.** Inclusive or exclusive of tax, the rate
   source, per-product or per-category rates, exemptions, and — critically —
   whether tax is computed per line or on the order total. The two produce
   different results and both are legitimate; record which this system does.

5. **Document rounding exactly.** Where rounding occurs in the sequence, to how
   many places, and in which direction (half-up, half-even/banker's, truncate).
   Rounding per line versus on the total is a material difference. Record the
   order of operations as a formula.

6. **Map discounts and their stacking.** Types (percentage, fixed, buy-X-get-Y,
   threshold), whether they combine or are exclusive, application order, and
   whether the base is pre- or post-tax. Record any floor that prevents a
   discount driving price below cost — or record its absence.

7. **Document promotions and their windows.** Time bounds, timezone used for the
   boundary, eligibility conditions, usage limits, and behaviour for a transaction
   that spans the expiry moment.

8. **Document manual overrides.** Who may override a price, within what bounds,
   whether a reason is required, and whether the override is attributable and
   logged. An unlogged override is an internal control failure — flag it.

9. **Verify with worked examples.** Take three real cases — a simple line, a
   discounted line with tax, and a multi-line order with a threshold discount —
   and compute them by hand against the documented rules. If your arithmetic
   disagrees with the code, the code is the rule and your understanding is wrong.
   Repeat until they agree, then record the examples.

### Output

Write `docs/project-knowledge/pricing-rules.md`:

```markdown
# Pricing Rules

## 1. Calculation Paths  — every implementation found  ⚠️ divergence is critical
## 2. Representation     — minor units/decimal, currency, float occurrences
## 3. Resolution Order   — ordered precedence of price sources
## 4. Tax                — inclusive/exclusive, rate source, per-line vs total
## 5. Rounding           — formula with order of operations and direction
## 6. Discounts          — types, stacking, base, cost floor
## 7. Promotions         — windows, timezone, limits, boundary behaviour
## 8. Overrides          — authority, bounds, reason, audit
## 9. Worked Examples    — three verified end-to-end calculations
## Open Questions
```

Number rules as `BR-price-NNN`.

### Finishing

- Append durable facts to `$AGENT_DIR/memory.md`.
- `propose` Open Questions to `god`, marked financially material.
- Escalate immediately if you find floating-point money arithmetic, divergent
  calculation paths, or unlogged price overrides.

## References

- **IEEE 754 / Martin Fowler, _Money_ pattern (P of EAA)** — the prohibition on
  floating-point currency and the minor-units representation in step 2
  <https://martinfowler.com/eaaCatalog/money.html>
- **EU VAT Directive 2006/112/EC, Articles 73–82 and 226** — taxable amount
  determination and the per-line versus total treatment in step 4
  <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32006L0112>
- **ISO 4217** — currency code and minor-unit exponent reference for step 2
  <https://www.iso.org/iso-4217-currency-codes.html>
- **IEEE 754-2019, roundTiesToEven** — banker's rounding definition in step 5
- **Munder Difflin `PROTOCOL.md`** — memory write-back and `propose` handoff

**Not sourced — added deliberately:** the confidence marking, the `BR-price-`
numbering, and the worked-example verification loop in step 9.
