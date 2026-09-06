---
name: project-inventory-rules
version: 1.0.0
description: |
  Document how an existing system moves and values stock: movement types, the
  events that change quantity, costing method, negative-stock policy, reservations,
  and stock-take reconciliation. Produces
  docs/project-knowledge/inventory-rules.md. Use when asked "how does stock work",
  "document inventory rules", "why is the stock count wrong", or when starting
  Phase 0 discovery on an inventory or warehouse system. Required before any
  change to stock logic.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Project Inventory Rules Discovery

Stock quantity is money. A rule you record incorrectly here becomes a shrinkage
figure nobody can explain. Treat every finding as financially material.

> **Domain skill.** This documents a stock-keeping domain. On a project in a
> different vertical, replace this skill on its own branch rather than bending it.

### Confidence marking (mandatory)

`[verified]` (read in code, cited) · `[inferred]` · `[assumed]`.

**Hard rule:** no rule that changes a stock quantity may be implemented against
while marked `[inferred]` or `[assumed]`. Route it to Open Questions and stop.

### Method

1. **Find the quantity of record.** Is stock a stored column, or derived by
   summing a movement ledger? This single fact determines everything else.
   ```bash
   grep -rnE "(quantity|qty|stock|on_hand|available)" src/ --include=*.js | head -40
   ```
   A stored column with no ledger cannot be audited — record that as a finding.

2. **Enumerate every movement type.** Purchase receipt, sale, return, transfer,
   adjustment, write-off, damage, expiry, production, sample. For each: what
   triggers it, the sign of the change, and whether it requires approval.

3. **Find every write path.** Any code that changes quantity, including paths
   nobody thinks of — imports, admin screens, seed scripts, scheduled jobs,
   webhook handlers. An unlisted write path is an unexplained discrepancy later.

4. **Determine the costing method.** Weighted average, FIFO, LIFO, or standard
   cost. Then verify it in code rather than trusting the field name — cost
   recalculation on receipt is where this is actually decided. Record how cost
   updates when stock is received at a different price.

5. **Establish the negative stock policy.** Can quantity go below zero? Find the
   guard, or find its absence. Then check whether the guard holds under
   concurrency — two simultaneous sales of the last unit is the canonical failure.
   Record the locking or constraint that prevents it, or record that nothing does.

6. **Document reservations.** Whether stock is held between cart and payment,
   for how long, and what releases it. Orphaned reservations are a common cause of
   phantom out-of-stock.

7. **Record the units and conversions.** Base unit, purchase unit, sale unit, and
   any pack-size conversion. Rounding on conversion is a real source of drift.

8. **Find batch, expiry, and serial tracking.** If present: how batches are
   selected on sale (FEFO?), what happens at expiry, and whether serials are
   enforced unique.

9. **Document stock-take reconciliation.** How a physical count is entered, how
   variance is recorded, and whether the adjustment is attributable to a person.
   An unattributable adjustment is an internal control failure — flag it.

### Output

Write `docs/project-knowledge/inventory-rules.md`:

```markdown
# Inventory Rules

## 1. Quantity of Record  — stored column vs derived ledger; auditability
## 2. Movement Types      — type, trigger, sign, approval required
## 3. Write Paths         — every code path that changes quantity  ⚠️ completeness matters
## 4. Costing             — method, and how cost updates on receipt
## 5. Negative Stock      — policy, guard, concurrency behaviour
## 6. Reservations        — hold, duration, release
## 7. Units               — base/purchase/sale units, conversion rounding
## 8. Batch & Expiry      — selection strategy, expiry handling, serials
## 9. Stock Take          — count entry, variance, attribution
## Open Questions
```

Number rules as `BR-stock-NNN` so other documents can cite them.

### Finishing

- Append durable facts to `$AGENT_DIR/memory.md`.
- `propose` Open Questions to `god`, marked as financially material.
- Report — do not fix — any unattributable adjustment path or missing concurrency
  guard. Those are findings for the security and architecture lanes.

## References

- **IAS 2 / IFRS — Inventories** — the recognised cost formulas (FIFO, weighted
  average) and the prohibition on LIFO under IFRS, informing step 4
  <https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/>
- **APICS / ASCM Dictionary** — standard movement-type and reservation terminology
  used in steps 2 and 6
- **GS1 General Specifications** — batch/lot and serial identification concepts in
  step 8 <https://www.gs1.org/standards/barcodes-epcrfid-id-keys/gs1-general-specifications>
- **PostgreSQL 16 documentation — Explicit Locking / Transaction Isolation** —
  the concurrency check in step 5
  <https://www.postgresql.org/docs/16/explicit-locking.html>
- **Munder Difflin `PROTOCOL.md`** — memory write-back and `propose` handoff

**Not sourced — added deliberately:** the confidence marking, the `BR-stock-`
numbering, and the rule blocking implementation against unconfirmed stock rules.
