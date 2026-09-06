---
name: project-pos-rules
version: 1.0.0
description: |
  Document how an existing point-of-sale system conducts a transaction: cart
  lifecycle, payment handling, split and partial payments, voids, refunds, receipt
  numbering, till reconciliation, and offline behaviour. Produces
  docs/project-knowledge/pos-rules.md. Use when asked "how does checkout work",
  "document the POS rules", "how are refunds handled", or when starting Phase 0
  discovery on a retail system. Required before any change to checkout or payment.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Project POS Rules Discovery

Checkout is where the system takes money. Every rule here is financially
material and most are also audit requirements. Document precisely; guess nothing.

> **Domain skill.** This documents a retail point-of-sale domain. Replace it on a
> branch for a different vertical rather than adapting it.

### Confidence marking (mandatory)

`[verified]` (read in code, cited) · `[inferred]` · `[assumed]`.

**Hard rule:** no rule affecting a payment amount, a void, a refund, or a receipt
number may be implemented against while `[inferred]` or `[assumed]`.

### Method

1. **Map the transaction lifecycle.** Build the complete state machine: draft →
   held → paid → completed → voided / refunded. For each transition record the
   trigger, the required role, and the side effects on stock and cash.

2. **Determine when stock actually moves.** At cart add, at payment, or at
   completion? This is the most consequential fact in the document and it is
   frequently inconsistent between paths. Verify each path separately.

3. **Document payment handling.** Methods accepted, whether split payments across
   methods are supported, how over-tender and change are calculated, and what
   happens when one leg of a split fails. Record whether payment and order
   creation are atomic.

4. **Check idempotency on payment.** What happens if the client retries — a
   double-tap, a network retry, a page refresh at the wrong moment. Find the
   idempotency key, or record its absence as a finding. Duplicate charges are the
   most damaging defect this document can prevent.

5. **Document voids and refunds separately.** They are different operations with
   different rules: a void cancels before settlement, a refund reverses after.
   Record time limits, role requirements, partial refund support, whether stock
   returns, and whether the original transaction remains immutable.

6. **Trace receipt and invoice numbering.** Sequence source, uniqueness guarantee,
   gap policy, and per-till or per-shop scoping. Sequences with gaps or duplicates
   are usually a tax-compliance problem, not just a bug. Check behaviour under
   concurrency.

7. **Document till and shift reconciliation.** Opening float, cash movements,
   declared versus expected, variance handling, and end-of-day close. Record what
   the close locks — whether transactions can still be modified afterwards.

8. **Establish offline behaviour.** Whether the till operates without network,
   what is queued, how conflicts resolve on reconnect, and how sequence numbers
   are allocated offline. If offline is unsupported, record that explicitly — it
   is a frequent false assumption.

9. **Verify the audit trail.** Every void, refund, discount override, and price
   change must be attributable to a person with a timestamp. Record any that are
   not — an unattributable financial action is an internal control failure.

10. **Check payment data handling.** Confirm no card data (PAN, CVV, track data)
    is stored, logged, or included in error reports. Any occurrence is `CRITICAL`
    and escalates immediately.

### Output

Write `docs/project-knowledge/pos-rules.md`:

```markdown
# POS Rules

## 1. Transaction Lifecycle — state machine with triggers, roles, side effects
## 2. Stock Movement Point  — when quantity changes, per path  ⚠️ verify each
## 3. Payments              — methods, splits, change, atomicity
## 4. Idempotency           — key, scope, retry behaviour
## 5. Voids                 — limits, roles, stock effect
## 6. Refunds               — limits, roles, partials, immutability
## 7. Numbering             — sequence, uniqueness, gaps, concurrency
## 8. Till & Shift          — float, variance, close, post-close mutability
## 9. Offline               — supported or not; queue and conflict resolution
## 10. Audit Trail          — attributable actions; gaps flagged
## 11. Payment Data         — PAN/CVV handling  ⚠️ any storage is CRITICAL
## Open Questions
```

Number rules as `BR-pos-NNN`.

### Finishing

- Append durable facts to `$AGENT_DIR/memory.md`.
- `propose` Open Questions to `god`, marked financially material.
- Escalate immediately, without waiting for the document to be finished, if you
  find stored card data, a missing idempotency guard on payment, or an
  unattributable refund path.

## References

- **PCI DSS v4.0, Requirements 3 and 10** — prohibition on storing sensitive
  authentication data (step 10) and the audit trail requirements (step 9)
  <https://www.pcisecuritystandards.org/document_library/>
- **EU VAT Directive 2006/112/EC, Articles 226 and 233** — sequential invoice
  numbering and integrity requirements informing step 6
  <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32006L0112>
- **Stripe API documentation — Idempotent Requests** — the idempotency key model
  described in step 4 <https://docs.stripe.com/api/idempotent_requests>
- **Martin Fowler, _Patterns of Enterprise Application Architecture_** — state
  machine treatment in step 1
- **Munder Difflin `PROTOCOL.md`** — memory write-back and `propose` handoff

**Not sourced — added deliberately:** the confidence marking, the `BR-pos-`
numbering, and the immediate-escalation triggers in *Finishing*.
