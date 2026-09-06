---
name: concurrency
version: 1.0.0
description: |
  Find and fix race conditions in database access — lost updates, check-then-act,
  double submission, and sequence allocation — using atomic writes, constraints,
  locking, or serializable isolation. Use when two users can act simultaneously,
  when stock or money can go wrong under load, or when asked "is this safe
  concurrently". Builds on transactions and locking.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Concurrency

Race conditions pass every test, work in development, and fail in production
during the busiest hour. They cannot be found by reading a single code path —
you must ask what a second, simultaneous execution would do between any two
statements.

**The question to ask at every read-then-write:** *if another transaction ran
completely between these two statements, would the result still be correct?*

### Pattern 1 — Lost update

The canonical bug. Two sales of the last unit; both read `quantity = 1`, both
write `0`, one unit oversold.

```js
// ❌ read, compute, write — the gap is the bug
const { quantity } = await db.one('SELECT quantity FROM stock WHERE id=$1', [id]);
if (quantity < qty) throw new Error('insufficient');
await db.none('UPDATE stock SET quantity=$1 WHERE id=$2', [quantity - qty, id]);
```

**Fix — make the write atomic and let the database decide:**

```sql
UPDATE stock
   SET quantity = quantity - $1
 WHERE id = $2 AND quantity >= $1
RETURNING quantity;
```

Zero rows returned means insufficient stock. The read, the check, and the write
are one statement, so no gap exists. Back it with
`CHECK (quantity >= 0)` so the invariant holds even if some other code path
forgets — see `constraints`.

Alternatives when the logic will not collapse into one statement: `SELECT ... FOR
UPDATE` to serialise the row, or `SERIALIZABLE` with retry.

### Pattern 2 — Check-then-act on absence

"Does this SKU exist? No — insert it." Two requests both check, both insert,
one fails or duplicates.

**Fix — let the unique constraint arbitrate:**

```sql
INSERT INTO product (shop_id, sku, name) VALUES ($1,$2,$3)
ON CONFLICT (shop_id, sku) DO NOTHING
RETURNING id;
```

`FOR UPDATE` cannot help here — you cannot lock a row that does not exist. A
unique constraint (or `SERIALIZABLE`) is the only correct answer.

### Pattern 3 — Double submission

A double-tapped Pay button, a network retry, a page refresh. Two identical
charges.

**Fix — idempotency key, enforced by a unique constraint:**

```sql
CREATE UNIQUE INDEX uq_payment_idem ON payment (idempotency_key);
```

Insert the key as part of the same transaction as the effect. A second attempt
violates the constraint and returns the original result rather than charging
again. Application-side "have I seen this?" checks are themselves check-then-act
races.

### Pattern 4 — Sequence allocation

Receipt and invoice numbers must be gapless and unique per shop — a legal
requirement in many jurisdictions.

`SEQUENCE` is fast but **leaves gaps** on rollback, and is not per-tenant. When
gapless is genuinely required, serialise the allocation:

```sql
SELECT pg_advisory_xact_lock(hashtext('receipt:' || $1));  -- per shop
UPDATE shop_counter SET next_receipt = next_receipt + 1
 WHERE shop_id = $1
RETURNING next_receipt - 1;
```

This deliberately serialises one shop's checkouts — correct, and the throughput
cost is acceptable at retail volume. Do not use a plain sequence and hope.

### Pattern 5 — Read-modify-write on aggregates

Recomputing a total in application code and writing it back loses concurrent
updates. Prefer atomic SQL (`SET total = total + $1`), or derive the aggregate on
read rather than storing it.

### Choosing a defence

| Situation | Use |
|---|---|
| Increment/decrement a value | Atomic `UPDATE ... SET col = col ± n WHERE ...` |
| Guard a threshold | Atomic update with the predicate + `CHECK` constraint |
| Uniqueness on insert | Unique constraint + `ON CONFLICT` |
| Prevent duplicate effect | Idempotency key + unique constraint |
| Multi-row invariant | `SERIALIZABLE` + retry |
| Serialise a process | Advisory transaction lock |
| Read informs a dependent write | `SELECT ... FOR UPDATE` |
| Work queue | `FOR UPDATE SKIP LOCKED` |

Prefer defences higher in this list: they are cheaper and cannot be forgotten by
the next caller.

### Detection

```bash
# Read-then-write in application code
grep -rnB2 -A6 -E "SELECT.*(quantity|stock|balance|total|count)" src/ --include=*.js | grep -A6 -i "update"
# Non-atomic assignment of a computed value
grep -rnE "SET\s+(quantity|stock|balance|total)\s*=\s*\$" src/ --include=*.js
# Existence check before insert
grep -rnB3 -A6 -E "find(First|Unique|One)\(" src/ --include=*.js | grep -A6 -E "create\(|insert"
```

### Testing

Unit tests will not find these. Write a concurrency test that runs N operations
simultaneously and asserts the invariant:

```js
await Promise.all(Array.from({ length: 20 }, () => sellOneUnit(productId)));
expect(await stockOf(productId)).toBe(0);          // never negative
expect(await successfulSaleCount()).toBe(10);      // exactly the stock that existed
```

### Checklist

- [ ] Every read-then-write examined for an interleaving execution
- [ ] Stock and balance changes are atomic single statements
- [ ] Threshold guards are in the `WHERE` clause, not application `if`s
- [ ] Backing `CHECK` constraints prevent invalid state regardless of path
- [ ] Uniqueness enforced by constraint, not by prior existence check
- [ ] Payment and other side-effecting operations have idempotency keys
- [ ] Gapless sequences serialised deliberately
- [ ] Retry implemented where `SERIALIZABLE` is used
- [ ] Concurrency tests exist for stock and payment paths

## References

- **PostgreSQL 16 documentation — Transaction Isolation** — lost update, the
  read-committed update rule, and serialization failures
  <https://www.postgresql.org/docs/16/transaction-iso.html>
- **PostgreSQL 16 documentation — Explicit Locking** — `FOR UPDATE`, advisory
  locks, `SKIP LOCKED` <https://www.postgresql.org/docs/16/explicit-locking.html>
- **PostgreSQL 16 documentation — INSERT ... ON CONFLICT**
  <https://www.postgresql.org/docs/16/sql-insert.html#SQL-ON-CONFLICT>
- **PostgreSQL 16 documentation — Sequence Manipulation Functions** — gap
  behaviour on rollback
  <https://www.postgresql.org/docs/16/functions-sequence.html>
- **Stripe API documentation — Idempotent Requests** — the idempotency key model
  <https://docs.stripe.com/api/idempotent_requests>

**Not sourced — written for this framework:** the five retail race patterns, the
per-shop gapless receipt allocation, the defence-selection table, the detection
commands, and the concurrency test example.
