---
name: transactions
version: 1.0.0
description: |
  Use PostgreSQL transactions correctly — atomicity boundaries, isolation levels,
  savepoints, and retry handling for serialization failures. Use when writing
  multi-statement operations, when money or stock moves, when choosing an
  isolation level, or when asked "should this be in a transaction". For lock
  mechanics see locking; for race patterns see concurrency.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Transactions

A transaction is the unit in which invariants hold. Between `BEGIN` and `COMMIT`
the database may be inconsistent; outside it, never.

In a POS this is not academic: a sale that records payment but fails to decrement
stock, or decrements stock without recording payment, is a real financial
discrepancy someone has to reconcile by hand.

### Draw the boundary around the invariant

Every operation that must be all-or-nothing goes in one transaction:

```sql
BEGIN;
  INSERT INTO sale (...) RETURNING id;
  INSERT INTO sale_line (...);
  UPDATE stock SET quantity = quantity - $1 WHERE product_id = $2 AND shop_id = $3;
  INSERT INTO stock_movement (...);
  INSERT INTO payment (...);
COMMIT;
```

Rules for the boundary:

- **Keep transactions short.** Every open transaction holds locks and blocks
  vacuum from cleaning up dead rows.
- **Never wait on the outside world inside a transaction.** No payment-gateway
  call, no email, no HTTP request between `BEGIN` and `COMMIT`. Take the external
  call outside and reconcile with an idempotency key.
- **Never hold a transaction open across user interaction.** A cart is not a
  transaction; checkout is.
- **One transaction per request, established at the boundary.** Nested
  service-level transactions that each commit independently defeat the purpose.

### Isolation levels

| Level | Prevents | Still possible |
|---|---|---|
| `READ COMMITTED` (default) | Dirty reads | Non-repeatable reads, phantoms, lost updates |
| `REPEATABLE READ` | + non-repeatable reads, phantoms | Serialization failures on write conflict |
| `SERIALIZABLE` | Everything; equivalent to some serial order | Serialization failures — must retry |

PostgreSQL's `REPEATABLE READ` is snapshot isolation and already prevents
phantoms, which is stronger than the SQL standard requires.

**Choosing:**

- `READ COMMITTED` for ordinary work. Note each *statement* takes a fresh
  snapshot, so two reads in one transaction can differ.
- `REPEATABLE READ` when a transaction reads the same data more than once and
  needs consistency — reports, multi-step calculations.
- `SERIALIZABLE` when correctness depends on a constraint spanning rows that no
  single constraint can express (stock across concurrent sales, non-overlapping
  bookings). It is the simplest correct answer when the alternative is hand-rolled
  locking — provided you implement retry.

### Retry is mandatory above READ COMMITTED

`REPEATABLE READ` and `SERIALIZABLE` abort transactions with SQLSTATE `40001`
(serialization failure) and `40P01` (deadlock). These are **expected**, not
exceptional. Without a retry loop, adopting a higher level converts correctness
into user-visible errors.

```js
const RETRYABLE = new Set(['40001', '40P01']);   // serialization failure, deadlock

async function withRetry(fn, attempts = 3) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      // Sequelize wraps the driver error; the SQLSTATE is on .original
      const code = err?.original?.code ?? err?.parent?.code ?? err?.code;
      if (!RETRYABLE.has(code) || i >= attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 2 ** i * 50 + Math.random() * 50));
    }
  }
}

// usage — the whole transaction is retried, so it re-reads on each attempt
await withRetry(() =>
  sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    async (t) => {
      /* … reads and writes using { transaction: t } … */
    }));
```

The retried function must re-read everything — replaying a computation from stale
values reintroduces the bug the isolation level prevented. Retries also require
the operation to be idempotent from the caller's perspective.

### Savepoints

Partial rollback within a transaction — useful when one step of a batch may fail
acceptably.

```sql
SAVEPOINT sp_line;
  -- attempt something that may fail
ROLLBACK TO SAVEPOINT sp_line;   -- transaction continues
```

Use sparingly. Many savepoints in a long transaction add overhead, and most ORM
"nested transaction" support is savepoints under another name.

### Failure and error handling

- After any error, the transaction is aborted; every subsequent statement fails
  until `ROLLBACK`. Handle the first error rather than continuing.
- Set `statement_timeout` and `idle_in_transaction_session_timeout` so a stuck
  transaction cannot hold locks indefinitely.
- Ensure the connection pool returns connections in a clean state — a leaked open
  transaction blocks vacuum across the whole database.

### Detection

```bash
grep -rnE "BEGIN|transaction\(|\\\$transaction|withTransaction" src/ --include=*.js
grep -rnE "(fetch|axios|sendMail|stripe|http)" src/ --include=*.js | grep -i "transaction"
```

The second command looks for external calls inside transactions — a reliable
source of lock contention and timeouts.

### Checklist

- [ ] Every multi-write invariant is inside one transaction
- [ ] Stock movement, payment, and sale creation are atomic together
- [ ] No external I/O between `BEGIN` and `COMMIT`
- [ ] Transactions do not span user interaction
- [ ] Isolation level chosen deliberately and documented
- [ ] Retry implemented for `40001`/`40P01` where level > `READ COMMITTED`
- [ ] Retried work re-reads rather than replaying stale values
- [ ] `statement_timeout` and idle-in-transaction timeout configured
- [ ] Errors trigger rollback, not continued statements

## References

- **PostgreSQL 16 documentation — Transaction Isolation** — level semantics and
  why `REPEATABLE READ` prevents phantoms
  <https://www.postgresql.org/docs/16/transaction-iso.html>
- **PostgreSQL 16 documentation — SET TRANSACTION / SAVEPOINT**
  <https://www.postgresql.org/docs/16/sql-set-transaction.html>
- **PostgreSQL 16 documentation — Error Codes** — class 40 (`40001`, `40P01`)
  <https://www.postgresql.org/docs/16/errcodes-appendix.html>
- **PostgreSQL wiki — Serializable Snapshot Isolation (SSI)** — retry requirement
  <https://wiki.postgresql.org/wiki/SSI>
- **PostgreSQL 16 documentation — Client Connection Defaults** —
  `statement_timeout`, `idle_in_transaction_session_timeout`
  <https://www.postgresql.org/docs/16/runtime-config-client.html>
- **Sequelize documentation — Transactions** — managed transactions and
  `isolationLevel` <https://sequelize.org/docs/v6/other-topics/transactions/>

**Not sourced — written for this framework:** the POS atomicity example, the
retry helper and its Sequelize error-shape handling, the no-external-I/O rule,
and the detection commands.
