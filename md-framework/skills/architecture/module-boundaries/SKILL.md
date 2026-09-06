---
name: module-boundaries
version: 1.0.0
description: |
  Draw and defend boundaries between modules — ownership, public surfaces,
  dependency direction, and detecting erosion. Use when adding a module, when two
  areas keep changing together, when imports reach deep into another feature, or
  when asked "where does this code belong".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Module Boundaries

A boundary is a promise: *this is what I own, this is what I expose, everything
else is mine to change.* Boundaries erode quietly — one convenient import at a
time — until every change touches everything.

### What defines a module

A module is a **business capability** with:

| Property | Meaning |
|---|---|
| **Ownership** | The tables it writes, and the rules it enforces |
| **Public surface** | The small set of things others may call |
| **Dependencies** | What it needs, stated explicitly |
| **Reason to change** | One. If there are two, it is two modules. |

```
features/sales/
  index.js          ← the ONLY entry point for other modules
  sale.service.js   ← internal
  sale.repo.js      ← internal
  sale.routes.js
```

**If you cannot state what a module owns in one sentence, the boundary is wrong.**

### Draw boundaries by change, not by type

The test: *what changes together?* Code that always changes together belongs
together, regardless of technical category.

```
❌ by technical type                ✅ by capability
   controllers/                        sales/
   services/                           inventory/
   repositories/                       products/
   models/                             pricing/
```

Type-based grouping means one feature change touches four directories, and no
directory has an owner. Capability grouping means a feature change is usually one
directory — which is the actual goal.

### The public surface should be small

```js
// features/sales/index.js — the contract
export { createSale, voidSale, getSaleById } from './sale.service.js';
export { SaleStatus } from './sale.constants.js';
// everything else stays internal
```

```js
// ❌ reaching past the contract; now every internal file is public API
import { buildSaleQuery } from '../../features/sales/sale.repo.js';

// ✅
import { getSaleById } from '@/features/sales';
```

Exporting everything means you can never change anything. Export what others
genuinely need, and no more.

### Dependency direction

Dependencies must form a directed acyclic graph. A cycle means the two modules
are one module that has been split incorrectly.

```
sales → products      ✅ sales reads product data
products → sales      ❌ now they are one module
```

**Breaking a cycle:** extract the shared concept into a third module both depend
on, invert the dependency with an event or a callback, or accept that they are
one module and merge them.

```bash
# Cheap cycle check between two features
grep -rn "features/products" src/features/sales/ --include=*.js | head
grep -rn "features/sales"    src/features/products/ --include=*.js | head
```

Both non-empty is a cycle.

### Data ownership is the hardest boundary

**Every table has exactly one writing module.** This is where boundaries are most
often violated and where the damage is worst — a table written by three modules
has its invariants enforced in three places, and they will diverge.

| Module | Writes | Reads via contract |
|---|---|---|
| `sales` | `sale`, `sale_line`, `payment` | `product`, `stock` |
| `inventory` | `stock`, `stock_movement` | `product` |
| `products` | `product`, `category` | — |
| `pricing` | `price_period`, `promotion` | `product` |

A sale needs to decrement stock — but `sales` must not `UPDATE stock` directly.
It calls `inventory.adjustStock(...)`, inside the same transaction. The rule
lives with the owner; the caller cannot forget it.

```bash
# Which modules write which tables
grep -rn "Stock\.\(update\|create\|increment\|destroy\)" src/features/ --include=*.js
```

More than one feature directory in the results is a finding.

### Shared code

Shared code needs an owner too. `lib/` should hold genuinely generic utilities —
money formatting, date helpers — with no business rules and no dependencies on
features.

**Business rules must never live in `lib/`.** A tax calculation there is owned by
nobody and coupled to everything.

Apply the **rule of three**: promote to shared on the third use, not the second.
Premature sharing creates coupling that is harder to remove than duplication.

### Detecting erosion

```bash
grep -rn "from '\.\./\.\./" src/features/ --include=*.js --include=*.jsx        # deep imports
grep -rn "features/[a-z]*/[a-z]" src/ --include=*.js | grep -v "features/[a-z]*'"  # past index
find src/lib src/utils -name '*.js' 2>/dev/null | xargs grep -ln "tax\|discount\|margin"
git log --format='%H' -n 200 | while read c; do
  git show --name-only --format= "$c" | grep -oE 'features/[a-z]+' | sort -u | paste -sd, -
done | sort | uniq -c | sort -rn | head
```

The last command shows which modules keep changing **together** in real commits —
the most honest signal that a boundary is wrong. Two modules that always appear
in the same commit are one module.

### When to change a boundary

Move a boundary when the evidence says so, not on taste:

- Two modules change together in most commits → merge, or move the shared part
- One module changes for several unrelated reasons → split
- A module is only ever called by one other → consider merging
- Reviewers report the same violation class three times → the boundary is wrong;
  fix the boundary, not the instances

Boundary changes are architectural — write an ADR (see `adr`).

### Checklist

- [ ] Every module describable in one sentence
- [ ] Modules named by capability, never by technical type
- [ ] Public surface exported through a single entry point
- [ ] No imports reaching past another module's entry point
- [ ] Dependency graph acyclic
- [ ] Exactly one writing module per table
- [ ] Cross-module writes go through the owner's contract
- [ ] `lib/` holds no business rules
- [ ] Sharing follows the rule of three
- [ ] Co-change analysed before proposing a boundary move
- [ ] Boundary changes recorded in an ADR

## References

- **Eric Evans, _Domain-Driven Design_** — bounded contexts and ownership
- **Martin Fowler — Bounded Context / Modular Monolith**
  <https://martinfowler.com/bliki/BoundedContext.html>
- **Robert C. Martin — The Common Closure Principle** — group what changes
  together
- **Kent C. Dodds — Colocation** <https://kentcdodds.com/blog/colocation>
- **Michael Feathers — using version history to reveal coupling** (the co-change
  analysis technique)

**Not sourced — written for this framework:** the data-ownership table with
retail modules, the sales/inventory stock-adjustment contract example, the
detection commands including the git co-change analysis, and the checklist.
