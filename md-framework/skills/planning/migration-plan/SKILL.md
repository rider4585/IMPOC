---
name: migration-plan
version: 1.0.0
description: |
  Plan a data or system transition end to end — backfill, dual-write, cutover,
  verification, and rollback — so it can run against live data without loss. Use
  when changing a data shape in production, moving between systems, or when asked
  "how do we migrate this". For the DDL and lock mechanics see the migrations
  skill.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Migration Plan

A migration is the riskiest routine thing a team does: it runs once, against real
data, usually while the system is live. `migrations` covers the SQL mechanics —
locks, `CONCURRENTLY`, `NOT VALID`. This covers the **plan around it**.

**The rule:** every migration touching existing data needs a written plan, a
verified backup, and human approval before it runs.

### Never migrate in one step

The safe shape is always the same — expand, migrate, contract — and each step
ships independently:

```
1. EXPAND    Add the new structure. Nothing reads it yet. Fully reversible.
2. BACKFILL  Populate it in batches. Old path still authoritative.
3. DUAL      Write both. Read old. Compare continuously.
4. SWITCH    Read new. Still writing both. This is the reversible cutover point.
5. VERIFY    Watch. Reconcile. Wait long enough to be sure.
6. CONTRACT  Stop writing old. Later, drop it.
```

At every step the system works, and until step 6 you can go back by changing one
flag. A single-step migration has no such point.

**Do not compress steps 4 and 6 into one deploy.** The gap between them is the
entire safety margin.

### Backfill in batches

A single `UPDATE` across millions of rows holds locks, bloats the table, and
cannot be interrupted.

```sql
-- Batched, resumable, interruptible
DO $$
DECLARE n integer;
BEGIN
  LOOP
    UPDATE product SET price_minor = round(unit_price * 100)
     WHERE id IN (SELECT id FROM product WHERE price_minor IS NULL LIMIT 1000);
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
    COMMIT;
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;
```

Requirements: resumable after interruption, idempotent when re-run, monitored for
progress, and throttled so it does not starve the till path.

Run backfills **outside** the migration that adds the column — they have
different failure modes and different durations.

### Verify before, during, and after

Verification is the part most often skipped, and the only thing that turns "it
ran" into "it worked".

```sql
-- Before: what should be true afterwards?
SELECT count(*) FROM product;
SELECT count(*) FROM product WHERE unit_price IS NOT NULL;

-- During dual-write: do the two representations agree?
SELECT count(*) FROM product
 WHERE price_minor IS DISTINCT FROM round(unit_price * 100);   -- must be 0

-- After: totals must reconcile
SELECT sum(unit_price * 100)::bigint, sum(price_minor) FROM product;
```

For financial data, reconcile **totals**, not just row counts. A migration that
preserves every row while changing a sum is worse than one that fails loudly.

Write these queries before the migration runs, and record the before-values.

### Plan the rollback for each step

| Step | Rollback |
|---|---|
| Expand | Drop the new column — no data loss |
| Backfill | Nothing to undo; old path still authoritative |
| Dual-write | Stop writing new |
| Switch | **Flip the read flag back** — the reason step 4 is separate |
| Contract | **Not reversible.** Requires restore from backup |

The switch must be a runtime flag, not a deploy. A rollback that requires a
release is not available at 2 a.m. with a queue forming.

Test the rollback path, not just the forward path. An untested rollback is not a
rollback.

### Cutover timing

- Choose the **lowest-traffic window** — for retail, that is not the weekend.
  Know the actual pattern before scheduling.
- Never migrate during a peak trading period, month-end, or a promotion.
- Have the people who can decide available for the duration.
- Know the maximum acceptable duration in advance, and the abort criteria.

State the abort criteria before starting: what observation stops the migration.
Deciding that mid-incident produces bad decisions.

### Migrating between systems

When replacing a system rather than a column, the same shape applies with a
longer dual-run:

1. Run both systems, new one shadow-writing
2. Compare outputs continuously for a full business cycle — including
   **month-end**, where retail differences surface
3. Move a subset of shops first, not everyone
4. Keep the old system readable long after the switch

Never cut over everything at once, and never delete the old data on the day.

### Communicate

- Tell the human what will happen, when, and what they might notice
- State whether there is downtime, degraded function, or none
- Say what to do if something looks wrong during the window
- Report completion with the verification numbers, not just "done"

### Output

```markdown
# Migration Plan: <name>

## What and why
## Current state → target state
## Steps            — expand / backfill / dual / switch / verify / contract
                      with per-step duration and rollback
## Verification     — queries, with expected results, run before/during/after
## Rollback         — per step, and the last reversible point
## Timing           — window, expected duration, abort criteria
## Risks            — what could go wrong, and the response
## Approval         — human sign-off (required for destructive changes)
## Backup           — taken, verified, restore-tested
```

### Checklist

- [ ] Expand/contract shape used; no single-step migration
- [ ] Switch is a runtime flag, separate from the contract deploy
- [ ] Backfills batched, resumable, idempotent, throttled
- [ ] Backfill run separately from the schema migration
- [ ] Verification queries written before running, with before-values recorded
- [ ] Financial totals reconciled, not just row counts
- [ ] Rollback defined per step, and tested
- [ ] Last reversible point identified explicitly
- [ ] Window chosen against real traffic patterns
- [ ] Abort criteria stated in advance
- [ ] Backup taken and restore-tested
- [ ] Human approval obtained for destructive changes
- [ ] Tested against production-sized data, not an empty schema
- [ ] Completion reported with verification numbers

## References

- **Martin Fowler — Parallel Change (expand/contract)**
  <https://martinfowler.com/bliki/ParallelChange.html>
- **Martin Fowler — Blue-Green Deployment / Feature Toggles** — reversible
  cutover <https://martinfowler.com/bliki/BlueGreenDeployment.html>
- **PostgreSQL 16 documentation — ALTER TABLE, and transaction control in
  `DO` blocks** <https://www.postgresql.org/docs/16/sql-altertable.html>
- **Michael Nygard, _Release It!_** — cutover risk and stability patterns
- **AWS Well-Architected — Reliability Pillar** — backup and restore verification

**Not sourced — written for this framework:** the six-step shape with per-step
rollback, the batched backfill requirements, the financial-total reconciliation
rule, the abort-criteria-in-advance rule, and the retail timing guidance.
