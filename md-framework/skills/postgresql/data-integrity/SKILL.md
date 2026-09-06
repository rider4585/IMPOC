---
name: data-integrity
version: 1.0.0
description: |
  Verify and protect the correctness of stored data — orphans, duplicates,
  invariant violations, and reconciliation of derived values against their
  sources. Use when data disagrees with itself, when auditing an unfamiliar
  database, after an incident, or when asked "is our data correct".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Data Integrity

Constraints prevent bad data going in. This skill is about finding the bad data
that is already there — because a system that ran without constraints has some,
and nobody knows how much until they look.

In a retail system, integrity failures show up as money that does not reconcile.
Find them before an accountant does.

### Audit queries

Run these on any unfamiliar database. Each returns rows only when something is
wrong.

**Orphans — references with no parent.** Common where a foreign key was never
declared.

```sql
SELECT 'sale_line → product' AS check_name, count(*) AS violations
FROM sale_line l LEFT JOIN product p ON p.id = l.product_id
WHERE p.id IS NULL
UNION ALL
SELECT 'sale → shop', count(*)
FROM sale s LEFT JOIN shop sh ON sh.id = s.shop_id
WHERE sh.id IS NULL;
```

Find candidate unenforced references first — every `*_id` column with no FK:

```sql
SELECT c.table_name, c.column_name
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.column_name LIKE '%\_id'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage k
    JOIN information_schema.table_constraints t
      ON t.constraint_name = k.constraint_name AND t.constraint_type = 'FOREIGN KEY'
    WHERE k.table_name = c.table_name AND k.column_name = c.column_name)
ORDER BY 1, 2;
```

**Duplicates on values that should be unique.**

```sql
SELECT shop_id, sku, count(*) FROM product
GROUP BY shop_id, sku HAVING count(*) > 1;
```

**Invariant violations — the rules a `CHECK` would have caught.**

```sql
SELECT 'negative stock' AS issue, count(*) FROM stock WHERE quantity < 0
UNION ALL SELECT 'negative price',  count(*) FROM product   WHERE unit_price < 0
UNION ALL SELECT 'zero-qty line',   count(*) FROM sale_line WHERE quantity <= 0
UNION ALL SELECT 'discount > 100',  count(*) FROM sale_line WHERE discount_pct > 100
UNION ALL SELECT 'ends before starts', count(*) FROM promotion WHERE ends_at <= starts_at;
```

**Cross-tenant contamination — the multi-tenant integrity check.**

```sql
-- A sale line whose product belongs to a different shop than its sale
SELECT count(*) FROM sale_line l
JOIN sale s   ON s.id = l.sale_id
JOIN product p ON p.id = l.product_id
WHERE p.shop_id <> s.shop_id;
```

Any row here is both a data defect and evidence of an authorisation gap —
escalate it as a security finding too.

### Reconciliation — derived vs source

Any stored aggregate must be reconcilable against the rows it summarises. If it
cannot be recomputed, it cannot be trusted.

```sql
-- Sale header total vs the sum of its lines
SELECT s.id, s.total, sum(l.quantity * l.unit_price) AS computed
FROM sale s JOIN sale_line l ON l.sale_id = s.id
GROUP BY s.id, s.total
HAVING s.total <> sum(l.quantity * l.unit_price);

-- Stock on hand vs the movement ledger
SELECT st.product_id, st.quantity, coalesce(sum(m.delta), 0) AS ledger
FROM stock st LEFT JOIN stock_movement m ON m.product_id = st.product_id
GROUP BY st.product_id, st.quantity
HAVING st.quantity <> coalesce(sum(m.delta), 0);
```

**Write a reconciliation query for every stored aggregate**, and run them on a
schedule. Drift is normal in systems without them; the point is to detect it in
days rather than at year end.

### Remediation

1. **Quantify first.** Count the violations before deciding anything. Ten rows is
   a data fix; ten thousand is a design problem.
2. **Find the source.** Fix the code path that produced it, or it recurs. Check
   whether the write path still exists.
3. **Correct the data** — in a transaction, with a record of what changed and
   why. For financial rows, prefer a compensating entry over an in-place edit.
4. **Add the constraint** so it cannot recur — `NOT VALID` then `VALIDATE`
   (see `constraints`, `migrations`).
5. **Add the reconciliation query** to a scheduled check.

Never silently correct financial data. Corrections are themselves auditable
events with an actor and a reason.

### Prevention

- Constraints over application validation — see `constraints`
- Derive rather than store, unless measured otherwise — see `normalization`
- Append-only financial history; corrections as new rows
- Foreign keys on every reference
- Scheduled reconciliation with alerting

### Checklist

- [ ] Unenforced `*_id` columns identified
- [ ] Orphan counts measured per relationship
- [ ] Duplicate checks run on every natural key
- [ ] Invariant violations counted (negative money, quantity, out-of-range)
- [ ] Cross-tenant contamination checked
- [ ] Every stored aggregate has a reconciliation query
- [ ] Reconciliation scheduled and alerting
- [ ] Root cause fixed before data corrected
- [ ] Corrections recorded auditably, not silently
- [ ] Constraint added to prevent recurrence

## References

- **PostgreSQL 16 documentation — Constraints** — the enforcement these checks
  substitute for <https://www.postgresql.org/docs/16/ddl-constraints.html>
- **PostgreSQL 16 documentation — `information_schema`** — the metadata queries
  <https://www.postgresql.org/docs/16/information-schema.html>
- **PostgreSQL 16 documentation — ALTER TABLE (`NOT VALID` / `VALIDATE`)** —
  adding constraints to tables with existing violations
  <https://www.postgresql.org/docs/16/sql-altertable.html>

**Not sourced — written for this framework:** all audit and reconciliation
queries, the cross-tenant contamination check and its escalation rule, the
five-step remediation order, and the no-silent-financial-correction rule.
