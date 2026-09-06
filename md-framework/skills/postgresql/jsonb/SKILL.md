---
name: jsonb
version: 1.0.0
description: |
  Use PostgreSQL jsonb correctly — when semi-structured data is justified,
  operators and indexing for containment and path queries, and the trade-offs
  against proper columns. Use when modelling variable attributes, storing
  payloads or audit snapshots, or when asked "should this be jsonb".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## JSONB

`jsonb` is powerful and routinely misused. Every field you move into it loses
type checking, constraints, foreign keys, and default statistics — the guarantees
that make a relational database worth using.

**Default to columns. Reach for `jsonb` when you can justify it.**

### `jsonb`, not `json`

`json` stores the literal text and re-parses on every access. `jsonb` stores a
decomposed binary form: faster to query, supports indexing, deduplicates keys,
does not preserve key order or whitespace. Use `jsonb` unless you specifically
need the original text preserved byte-for-byte.

### When it is justified

| Justified | Because |
|---|---|
| Third-party API responses / webhook payloads | Shape is not yours to control |
| Audit snapshots of a record at a point in time | Historical shape must not change with the schema |
| User-defined custom fields per shop | Genuinely open-ended; no fixed set exists |
| Sparse, rarely queried attributes across product types | A column per attribute would be mostly `NULL` |
| Feature flags and preference blobs | Read whole, rarely filtered |

### When it is not

- The keys are known and stable → use columns
- You need a foreign key on a value → use a column
- You need `NOT NULL`, `CHECK`, or `UNIQUE` on it → use a column
- You filter or join on it constantly → use a column
- You are avoiding writing a migration → write the migration

A `jsonb` column whose keys are the same in every row is a schema someone
declined to declare.

### Operators worth knowing

```sql
data -> 'key'            -- → jsonb
data ->> 'key'           -- → text
data #> '{a,b}'          -- → jsonb at path
data #>> '{a,b}'         -- → text at path
data @> '{"status":"paid"}'::jsonb   -- containment  ← the indexable one
data ? 'key'             -- key exists
data || '{"x":1}'::jsonb -- merge (shallow)
data - 'key'             -- delete key
jsonb_set(data, '{a,b}', '"v"')      -- set at path
```

`@>` containment is the operator that GIN indexes accelerate, and it is usually
the right way to filter.

### Indexing

```sql
-- General containment queries — indexes every key and value
CREATE INDEX idx_order_payload ON "order" USING gin (payload);

-- Smaller and faster when you only use @> (not ? / ?| / ?&)
CREATE INDEX idx_order_payload_ops ON "order" USING gin (payload jsonb_path_ops);

-- One hot key: a plain B-tree expression index beats GIN
CREATE INDEX idx_order_status ON "order" ((payload ->> 'status'));
```

Choose by query shape: `jsonb_path_ops` is roughly half the size and faster for
containment alone; a B-tree expression index is best when you filter on a single
known key and also want ordering or range comparison.

`->>` returns `text` — cast explicitly for numeric comparison, and index the same
expression you query:

```sql
CREATE INDEX idx_order_total ON "order" (((payload ->> 'total')::numeric));
```

### Constraining jsonb

You can still enforce rules:

```sql
ALTER TABLE product ADD CONSTRAINT chk_attrs_object
  CHECK (jsonb_typeof(attributes) = 'object');

ALTER TABLE product ADD CONSTRAINT chk_attrs_required
  CHECK (attributes ? 'unit');
```

Do this whenever a key is genuinely required — it recovers some of what you gave
up. If you find yourself writing many such constraints, the fields want to be
columns.

### Expanding to relational form

```sql
-- Rows from an array
SELECT o.id, item ->> 'sku' AS sku, (item ->> 'qty')::int AS qty
FROM "order" o, jsonb_array_elements(o.payload -> 'items') AS item;

-- Key/value pairs
SELECT key, value FROM jsonb_each_text(payload);
```

### Performance notes

- **Updates rewrite the whole value.** A large `jsonb` column updated frequently
  causes significant write amplification and bloat. Keep hot fields in columns.
- Values over ~2 KB are TOASTed — stored out of line and compressed. Fine for
  read-whole payloads, bad for values you filter on constantly.
- The planner has poor selectivity estimates inside `jsonb`; expect misestimates
  and check plans (see `explain-analyze`).
- Never `SELECT *` a table with large payload columns from a list endpoint.

### Checklist

- [ ] `jsonb` chosen, not `json`
- [ ] Use justified — keys genuinely variable, not merely undeclared
- [ ] Stable, queried, or constrained fields promoted to columns
- [ ] GIN index present where containment is queried
- [ ] `jsonb_path_ops` used when only `@>` is needed
- [ ] Expression indexes match the queried expression exactly
- [ ] Casts explicit for numeric comparisons
- [ ] `CHECK` constraints enforce required keys and type
- [ ] Frequently updated fields not buried in a large payload
- [ ] Large payload columns excluded from list queries

## References

- **PostgreSQL 16 documentation — JSON Types** — `json` vs `jsonb`, storage and
  indexing overview <https://www.postgresql.org/docs/16/datatype-json.html>
- **PostgreSQL 16 documentation — JSON Functions and Operators** — full operator
  and function reference
  <https://www.postgresql.org/docs/16/functions-json.html>
- **PostgreSQL 16 documentation — GIN Indexes / `jsonb_path_ops`** — operator
  class trade-offs <https://www.postgresql.org/docs/16/gin-builtin-opclasses.html>
- **PostgreSQL 16 documentation — TOAST** — out-of-line storage thresholds
  <https://www.postgresql.org/docs/16/storage-toast.html>

**Not sourced — written for this framework:** the justified/not-justified tables,
the retail examples, the "undeclared schema" rule, and the checklist.
