---
name: constraints
version: 1.0.0
description: |
  Express business invariants as database constraints — CHECK, UNIQUE, FOREIGN
  KEY, NOT NULL, EXCLUDE — so invalid data cannot exist regardless of application
  behaviour. Use when adding tables or columns, when a bug allowed impossible
  data, or when asked "how do I stop this from happening again".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Constraints

A constraint is the only guarantee that survives a bug in the application, a
direct `psql` session, a data import, or a second service written by someone
else. Application-layer validation is a user-experience feature; the constraint
is the actual rule.

Both belong in the system: validate early for good errors, constrain at the
database so it cannot be bypassed.

### CHECK — domain rules

The cheapest correctness win available.

```sql
ALTER TABLE product   ADD CONSTRAINT chk_price_nonneg   CHECK (unit_price >= 0);
ALTER TABLE sale_line ADD CONSTRAINT chk_qty_positive   CHECK (quantity > 0);
ALTER TABLE sale_line ADD CONSTRAINT chk_discount_range CHECK (discount_pct BETWEEN 0 AND 100);
ALTER TABLE stock     ADD CONSTRAINT chk_qty_nonneg     CHECK (quantity >= 0);
ALTER TABLE promotion ADD CONSTRAINT chk_window         CHECK (ends_at > starts_at);
```

`chk_qty_nonneg` on stock is worth singling out: it makes negative stock
impossible at the storage layer, which turns a subtle concurrency bug into a
loud, immediate error. See `concurrency`.

Multi-column checks work and are underused (`ends_at > starts_at`). Checks
cannot reference other tables — for that, use a foreign key or a trigger.

### UNIQUE — identity rules

```sql
-- SKU unique per shop, not globally
ALTER TABLE product ADD CONSTRAINT uq_product_shop_sku UNIQUE (shop_id, sku);
```

**Partial unique indexes** express conditional uniqueness — a common real
requirement that a plain constraint cannot state:

```sql
-- Only one open till session per shop at a time
CREATE UNIQUE INDEX uq_till_open ON till_session (shop_id) WHERE closed_at IS NULL;

-- Soft-deleted rows may reuse a SKU
CREATE UNIQUE INDEX uq_product_sku_live ON product (shop_id, sku) WHERE deleted_at IS NULL;
```

Note `NULL` values do not conflict under a standard unique constraint — several
rows may share `NULL`. Use `NULLS NOT DISTINCT` (PostgreSQL 15+) when that is
wrong for your case.

### FOREIGN KEY — relationship rules

```sql
ALTER TABLE sale_line
  ADD CONSTRAINT fk_sale_line_product
  FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE RESTRICT;
```

Choose the action deliberately:

| Action | Use when |
|---|---|
| `RESTRICT` / `NO ACTION` | The parent must not disappear — products, shops, users |
| `CASCADE` | The child is meaningless alone — sale lines under a sale |
| `SET NULL` | The link is optional — assigned staff member |

`CASCADE` from a product to its sales history would delete financial records.
Default to `RESTRICT` for anything with accounting meaning, and prefer soft
deletion (`deleted_at`) over hard deletes for referenced entities.

**Index the referencing column** — see `indexing`.

### EXCLUDE — no overlaps

Generalised uniqueness, for ranges. The correct tool for scheduling and
non-overlapping validity periods.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE price_period ADD CONSTRAINT excl_price_overlap
  EXCLUDE USING gist (
    product_id WITH =,
    valid_period WITH &&          -- tstzrange
  );
```

This makes two overlapping prices for one product structurally impossible —
something application logic reliably fails to guarantee under concurrency.

### NOT NULL

Default to it. Every nullable column is a case every reader must handle; add
nullability only when "unknown" is a genuine domain state.

### Adding constraints to a live table

A plain `ADD CONSTRAINT ... CHECK` scans the whole table under an `ACCESS
EXCLUSIVE` lock. On a large table that is an outage. Use the two-step form:

```sql
ALTER TABLE sale ADD CONSTRAINT chk_total_nonneg CHECK (total >= 0) NOT VALID;
ALTER TABLE sale VALIDATE CONSTRAINT chk_total_nonneg;   -- weaker lock
```

`NOT VALID` enforces the rule for new and changed rows immediately; `VALIDATE`
then checks existing rows without blocking writes. Same pattern for foreign keys.
See `migrations`.

### Naming and errors

Name every constraint — `chk_`, `uq_`, `fk_`, `excl_`. Constraint names surface
in violation errors, and the application should map them to user-facing messages.
Never expose the raw database error to a client; it discloses schema.

### Checklist

- [ ] Money and quantity columns have non-negative `CHECK`s
- [ ] Percentages and bounded values range-checked
- [ ] Date/period ordering checked
- [ ] Natural keys have unique constraints, tenant-scoped
- [ ] Conditional uniqueness uses partial unique indexes
- [ ] Every reference has a foreign key with a deliberate action
- [ ] No `CASCADE` onto financial history
- [ ] Overlap rules use `EXCLUDE`, not application checks
- [ ] Columns `NOT NULL` unless nullability is meaningful
- [ ] Constraints on live tables added `NOT VALID` then validated
- [ ] All constraints explicitly named and mapped to friendly errors

## References

- **PostgreSQL 16 documentation — Constraints** — `CHECK`, `UNIQUE`, `FOREIGN
  KEY`, `EXCLUDE`, and FK actions
  <https://www.postgresql.org/docs/16/ddl-constraints.html>
- **PostgreSQL 16 documentation — ALTER TABLE** — `NOT VALID` / `VALIDATE
  CONSTRAINT` and lock levels
  <https://www.postgresql.org/docs/16/sql-altertable.html>
- **PostgreSQL 16 documentation — CREATE INDEX** — partial unique indexes
  <https://www.postgresql.org/docs/16/sql-createindex.html>
- **PostgreSQL 16 documentation — Range Types and `btree_gist`** — exclusion
  constraints over ranges <https://www.postgresql.org/docs/16/rangetypes.html>

**Not sourced — written for this framework:** the retail constraint examples
(open till session, price period overlap, SKU reuse after soft delete), the
FK-action guidance for financial records, and the checklist.
