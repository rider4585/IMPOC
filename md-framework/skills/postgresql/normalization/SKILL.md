---
name: normalization
version: 1.0.0
description: |
  Apply normal forms to eliminate redundancy and update anomalies, and judge when
  controlled denormalisation is justified. Use when modelling a new domain,
  reviewing a schema for redundancy, diagnosing data that disagrees with itself,
  or when asked "is this schema normalised".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Normalization

Normalisation removes redundancy so that each fact is stored once. When a fact
lives in two places, they eventually disagree — and nothing tells you which is
right.

Normalise by default. Denormalise only with a measured reason.

### The forms that matter

**1NF — atomic values.** No repeating groups, no comma-separated lists in a
column.

```sql
-- ❌ unqueryable, unconstrainable
product(id, name, tags text)              -- 'sale,seasonal,clearance'
-- ✅
product(id, name)  +  product_tag(product_id, tag)
```

A PostgreSQL array or `jsonb` column is a deliberate exception, not an
accident — see `jsonb` for when that trade is right.

**2NF — no partial dependency on a composite key.** Every non-key column depends
on the *whole* key.

```sql
-- ❌ product_name depends only on product_id, not the full key
sale_line(sale_id, product_id, quantity, product_name)
-- ✅ name lives with the product
sale_line(sale_id, product_id, quantity)
```

**3NF — no transitive dependency.** Non-key columns depend on the key, not on
each other.

```sql
-- ❌ category_name depends on category_id, not on the product key
product(id, name, category_id, category_name)
-- ✅
product(id, name, category_id)  +  category(id, name)
```

**BCNF** — every determinant is a candidate key. Rarely the binding constraint in
practice; 3NF handles most real schemas.

3NF is the working target. Beyond BCNF, the higher forms seldom change a design
you would otherwise have made.

### The anomalies it prevents

| Anomaly | Symptom |
|---|---|
| Update | Change a category name; some rows still show the old one |
| Insert | Cannot record a supplier until they have a product |
| Delete | Removing the last product erases the category entirely |

If you can construct any of these against a schema, it is not normalised enough.

### When denormalisation is legitimate

Two cases, and they are genuinely different from redundancy:

**1. Historical snapshots — always correct, not a compromise.**

A sale line must store the price and product name *as they were at the time of
sale*. This is not duplication of the product row; it is a distinct fact about a
past event. Reading the current product price to render a historical receipt is a
correctness bug.

```sql
CREATE TABLE sale_line (
  sale_id      bigint NOT NULL REFERENCES sale(id) ON DELETE CASCADE,
  product_id   bigint NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  product_name text          NOT NULL,   -- snapshot at sale time
  unit_price   numeric(12,2) NOT NULL,   -- snapshot at sale time
  quantity     integer       NOT NULL CHECK (quantity > 0)
);
```

The same applies to tax rate, discount applied, and cost price at the moment of
sale — margin reporting depends on the historical cost, not today's.

**2. Measured performance denormalisation.** A counter or rollup maintained
because an aggregate is demonstrably too slow. Requirements:

- Profile first; have the `EXPLAIN ANALYZE` numbers
- Maintain it in the same transaction as the source change, or via a trigger —
  never in application code that can be bypassed
- Provide a reconciliation query that recomputes the truth
- Document it as a deliberate exception

Prefer a materialised view before hand-maintained columns — refresh is explicit
and the derivation stays declarative.

### Reviewing for redundancy

```sql
-- Columns with the same name across tables: candidate duplicated facts
SELECT column_name, count(*) AS tables, string_agg(table_name, ', ')
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name NOT IN ('id','created_at','updated_at','deleted_at','shop_id')
GROUP BY column_name HAVING count(*) > 1
ORDER BY 2 DESC;
```

Review each hit: is it a legitimate snapshot, or the same fact stored twice?

### Checklist

- [ ] No repeating groups or delimited lists in columns
- [ ] Every non-key column depends on the whole key
- [ ] No transitive dependencies between non-key columns
- [ ] Update, insert, and delete anomalies cannot be constructed
- [ ] Each duplicated column is a justified historical snapshot
- [ ] Sale lines snapshot price, name, tax, and cost at transaction time
- [ ] Any performance denormalisation is measured, transactional, and reconcilable
- [ ] Lookup tables used instead of repeated free text

## References

- **E. F. Codd, "A Relational Model of Data for Large Shared Data Banks" (1970)**
  and the subsequent normal form papers — 1NF through BCNF
- **PostgreSQL 16 documentation — DDL and Constraints** — enforcing the
  decomposition <https://www.postgresql.org/docs/16/ddl.html>
- **PostgreSQL 16 documentation — Materialized Views** — preferred alternative to
  hand-maintained rollups
  <https://www.postgresql.org/docs/16/rules-materializedviews.html>
- **C. J. Date, _Database Design and Relational Theory_** — normal forms and
  when higher forms stop mattering

**Not sourced — written for this framework:** the historical-snapshot
justification and `sale_line` example, the denormalisation requirements list, and
the redundancy-detection query.
