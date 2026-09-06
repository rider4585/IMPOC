---
name: schema-design
version: 1.0.0
description: |
  Design PostgreSQL schemas — table structure, data types, keys, relationships,
  and naming — for correctness first and performance second. Use when adding
  tables, modelling a new domain, reviewing a proposed schema, or when asked
  "how should I structure this data". For normal forms see normalization; for
  enforcement see constraints.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Schema Design

The schema outlives every application built on it. Design it to make invalid
states unrepresentable — a constraint costs one line and prevents a class of bug
permanently, whereas application-layer discipline decays.

### Choose types deliberately

| Need | Use | Not |
|---|---|---|
| Money | `numeric(12,2)` or `bigint` minor units | `float`/`real`/`double` — silent rounding errors |
| Identifier | `bigint GENERATED ALWAYS AS IDENTITY`, or `uuid` | `serial` (legacy), `varchar` ids |
| Timestamp | `timestamptz` | `timestamp` — ambiguous without a zone |
| Date only | `date` | `timestamptz` truncated in queries |
| Text | `text` (with a `CHECK` on length) | `varchar(n)` for arbitrary limits |
| Fixed set | `text` + `CHECK`, or a lookup table | `enum` — altering it is painful |
| Boolean | `boolean` | `char(1)`, `smallint` |
| Quantity | `integer` or `numeric` with a `CHECK` | unconstrained numeric |
| Semi-structured | `jsonb` | `json`, `text` |

**Money is the one that bites.** Floating point cannot represent 0.10 exactly;
in a POS that becomes cent-level drift across thousands of transactions. Either
`numeric` throughout, or integer minor units throughout — decide once, record it,
and never mix.

`text` and `varchar(n)` perform identically in PostgreSQL; `varchar(n)` only adds
a length limit that is awkward to change later. Prefer `text` plus an explicit
`CHECK` when a limit is genuinely a business rule.

### Keys

- **Primary key on every table.** No exceptions — replication, tooling, and
  `UPDATE` safety all depend on it.
- **Surrogate keys** (identity or UUID) for entities; add a **unique constraint**
  on the real-world natural key alongside it (SKU, barcode, email).
- Choose `uuid` when identifiers are generated client-side or must not reveal
  volume; prefer UUIDv7 for index locality. Use `bigint` identity otherwise — it
  is smaller and orders naturally.
- **Foreign keys on every reference.** An unenforced `*_id` column will contain
  orphans; it is only a question of when.

### Relationships

- One-to-many: FK on the many side.
- Many-to-many: an explicit join table with its own PK and both FKs. Give it a
  name from the domain (`sale_line`, not `sale_product`) — join tables usually
  turn out to carry attributes.
- Choose `ON DELETE` deliberately per FK. `CASCADE` on a sale line is right;
  `CASCADE` from a product to its sales history destroys financial records. Use
  `RESTRICT` for anything with accounting meaning.

### Nullability

Default to `NOT NULL`. A nullable column asks every reader to handle a case that
frequently has no defined meaning. Add nullability only when "unknown" is a real
domain state, and write down what it means.

### Immutable financial records

Transactional history must not be edited in place. A completed sale is a fact;
corrections are new rows (a refund, a reversal), never an `UPDATE`. Design for
append-only from the start — retrofitting it after reports disagree is expensive.

### Naming

Pick a convention and hold it. Suggested, matching PostgreSQL's own folding
behaviour:

- `snake_case` throughout; unquoted identifiers fold to lowercase anyway
- Tables singular (`product`) or plural (`products`) — either is fine, but be
  consistent
- FK columns `<referenced_table>_id`
- Booleans `is_`/`has_` prefixed
- Timestamps `created_at`, `updated_at`, `deleted_at`
- Indexes `idx_<table>_<columns>`, constraints `chk_`/`uq_`/`fk_`

### Standard columns

Most tables want `id`, `created_at timestamptz NOT NULL DEFAULT now()`, and
`updated_at`. In a multi-tenant system, add the tenant column (`shop_id`) and
index it — it appears in nearly every predicate and every access-control check.

```sql
CREATE TABLE product (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id     bigint NOT NULL REFERENCES shop(id) ON DELETE RESTRICT,
  sku         text   NOT NULL,
  name        text   NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  unit_price  numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  cost_price  numeric(12,2) CHECK (cost_price >= 0),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_shop_sku UNIQUE (shop_id, sku)
);
```

Note the unique constraint is on `(shop_id, sku)` — SKUs are unique per shop, not
globally. Getting tenant scoping into keys and constraints is what makes
multi-tenancy structural rather than a convention.

### Checklist

- [ ] Every table has a primary key
- [ ] Money is `numeric` or integer minor units — never float
- [ ] Timestamps are `timestamptz`
- [ ] Every reference has a foreign key with a deliberate `ON DELETE`
- [ ] Columns are `NOT NULL` unless "unknown" is meaningful
- [ ] Natural keys have unique constraints, tenant-scoped where applicable
- [ ] `CHECK` constraints express domain rules (non-negative money and quantity)
- [ ] Financial history is append-only
- [ ] Naming convention consistent
- [ ] Tenant column present and indexed on tenant-scoped tables

## References

- **PostgreSQL 16 documentation — Data Types** — type selection and
  `text` vs `varchar` equivalence
  <https://www.postgresql.org/docs/16/datatype.html>
- **PostgreSQL 16 documentation — CREATE TABLE / Identity Columns**
  <https://www.postgresql.org/docs/16/sql-createtable.html>
- **PostgreSQL 16 documentation — Constraints** — FK actions and `CHECK`
  <https://www.postgresql.org/docs/16/ddl-constraints.html>
- **PostgreSQL wiki — Don't Do This** — `timestamp` vs `timestamptz`, `char(n)`,
  `serial`, and enum guidance
  <https://wiki.postgresql.org/wiki/Don%27t_Do_This>
- **RFC 9562** — UUID version 7 and index locality
  <https://datatracker.ietf.org/doc/html/rfc9562>

**Not sourced — written for this framework:** the type table's "not" column, the
append-only financial records rule, the tenant-scoped unique constraint pattern,
and the worked `product` example.
