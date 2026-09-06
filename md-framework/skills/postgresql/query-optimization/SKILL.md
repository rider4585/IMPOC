---
name: query-optimization
version: 1.0.0
description: |
  Rewrite slow PostgreSQL queries — eliminate N+1, replace correlated subqueries,
  fix pagination, and reduce rows touched. Use when a query is slow after
  diagnosis, when reviewing data access code, or when asked "how do I make this
  query faster". Diagnose with explain-analyze first; index with indexing.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Query Optimization

Optimise in this order, because each step is cheaper and more durable than the
next:

1. **Touch fewer rows** — better predicates, better indexes
2. **Rewrite the query** — remove N+1, correlated subqueries, unnecessary sorts
3. **Restructure the schema** — denormalise, pre-aggregate
4. **Tune the server** — the last resort, not the first

Always measure with `EXPLAIN (ANALYZE, BUFFERS)` before and after.

### N+1 — the most common and most expensive

One query for a list, then one per row. Usually invisible in code because the ORM
hides it.

```js
// ❌ 1 + N queries
const sales = await Sale.findAll({ where: { shopId } });
for (const s of sales) s.lines = await SaleLine.findAll({ where: { saleId: s.id } });

// ✅ one query
const sales = await Sale.findAll({ where: { shopId }, include: [{ model: SaleLine, as: "lines" }] });
```

```bash
grep -rnB4 -A8 -E "for\s*\(|\.map\(|forEach\(" src/ --include=*.js | grep -E "await.*\.(find|query|select)"
```

Log query counts per request in development — a request issuing 200 queries is
the fastest way to spot this.

### Fetch only what you need

```sql
-- ❌ SELECT * pulls every column, defeats index-only scans
SELECT * FROM product WHERE shop_id = $1;
-- ✅
SELECT id, name, unit_price FROM product WHERE shop_id = $1;
```

`SELECT *` also breaks silently when columns are added, and drags large `text`
and `jsonb` columns across the wire for no reason.

### Keyset pagination

`OFFSET` must count and discard every skipped row — page 1000 reads a million
rows to return twenty.

```sql
-- ❌ degrades linearly with page number
SELECT * FROM sale WHERE shop_id=$1 ORDER BY sold_at DESC OFFSET 20000 LIMIT 20;

-- ✅ constant time at any depth
SELECT * FROM sale
 WHERE shop_id = $1 AND (sold_at, id) < ($2, $3)
 ORDER BY sold_at DESC, id DESC
 LIMIT 20;
```

The tuple comparison needs a matching index on `(shop_id, sold_at DESC, id DESC)`
and a tiebreaker column so ordering is total.

### Correlated subqueries → joins or LATERAL

```sql
-- ❌ runs once per outer row
SELECT p.*, (SELECT sum(quantity) FROM sale_line l WHERE l.product_id = p.id) AS sold
FROM product p WHERE p.shop_id = $1;

-- ✅ one aggregate pass
SELECT p.*, coalesce(l.sold, 0) AS sold
FROM product p
LEFT JOIN (
  SELECT product_id, sum(quantity) AS sold FROM sale_line GROUP BY product_id
) l ON l.product_id = p.id
WHERE p.shop_id = $1;
```

Use `LATERAL` when you genuinely need per-row top-N:

```sql
SELECT p.id, r.*
FROM product p
CROSS JOIN LATERAL (
  SELECT sold_at, quantity FROM sale_line l
   WHERE l.product_id = p.id ORDER BY l.sold_at DESC LIMIT 3
) r;
```

### Predicates that defeat indexes

| Anti-pattern | Why | Instead |
|---|---|---|
| `WHERE date(sold_at) = $1` | Function on the column | `sold_at >= $1 AND sold_at < $1 + 1` |
| `WHERE lower(email) = $1` | Function on the column | Index the expression |
| `WHERE sku LIKE '%abc'` | Leading wildcard | Trigram index, or full-text |
| `WHERE total::text = $1` | Cast on the column | Compare in the column's own type |
| `WHERE col + 0 = $1` | Arithmetic on the column | Move arithmetic to the parameter |

The rule: **keep the column bare on the left**. Any transformation of the indexed
column makes the index unusable unless you indexed that exact expression.

### Aggregation

- Filter before aggregating — `WHERE` runs before `GROUP BY`, `HAVING` after.
  A condition that belongs in `WHERE` but sits in `HAVING` aggregates rows it
  then discards.
- `count(*)` on a large table is a full scan. For approximations use
  `pg_class.reltuples`; for exact live counts, maintain a counter.
- `DISTINCT` often signals a join fanout — fix the join instead of deduplicating
  after.
- `EXISTS` beats `IN (SELECT ...)` for existence checks, and handles `NULL`
  correctly where `NOT IN` does not.

### Bulk operations

```sql
-- ❌ N round trips
INSERT INTO sale_line (...) VALUES (...);   -- repeated

-- ✅ one statement
INSERT INTO sale_line (sale_id, product_id, quantity)
SELECT * FROM unnest($1::bigint[], $2::bigint[], $3::int[]);
```

For very large loads use `COPY`. For bulk updates, join against a `VALUES` list
rather than issuing one statement per row.

### Checklist

- [ ] `EXPLAIN (ANALYZE, BUFFERS)` captured before and after
- [ ] No N+1 — query count per request checked
- [ ] Explicit column lists; no `SELECT *`
- [ ] Deep pagination uses keyset, not `OFFSET`
- [ ] Correlated subqueries rewritten as joins or `LATERAL`
- [ ] Indexed columns appear bare in predicates
- [ ] Filtering happens in `WHERE`, not `HAVING`
- [ ] `EXISTS` used for existence checks
- [ ] Bulk writes batched into single statements
- [ ] Improvement measured, not assumed

## References

- **PostgreSQL 16 documentation — Performance Tips** — query rewriting and
  planner behaviour <https://www.postgresql.org/docs/16/performance-tips.html>
- **PostgreSQL 16 documentation — Using EXPLAIN**
  <https://www.postgresql.org/docs/16/using-explain.html>
- **PostgreSQL 16 documentation — LATERAL subqueries**
  <https://www.postgresql.org/docs/16/queries-table-expressions.html#QUERIES-LATERAL>
- **PostgreSQL 16 documentation — COPY** — bulk loading
  <https://www.postgresql.org/docs/16/sql-copy.html>
- **Markus Winand, _Use The Index, Luke_ — "Paging Through Results"** — keyset
  pagination <https://use-the-index-luke.com/no-offset>

**Not sourced — written for this framework:** the optimisation ordering, the
anti-pattern table, the N+1 detection command, and the retail query examples.
