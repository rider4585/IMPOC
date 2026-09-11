# PostgreSQL Review Findings — IMPOC (R-28)

**Reviewer:** worker-postgres-review-r28 (database/PostgreSQL lane)
**Date:** 2026-09-08
**Environment:** worktree `worker-postgres-review-r28`; live dev DB `impoc_dev` on `localhost:5432` (PostgreSQL 16.15, TCP, not in recovery). Dev DB is essentially empty (reltuples -1, never analyzed) — all `EXPLAIN (ANALYZE, BUFFERS)` evidence is plan-shape, absolute timings are not meaningful.
**Method:** read-only. Reviewed every migration in `backend/database/migrations/` (chronological), Sequelize models, all query sites in `backend/src/modules/**`, plus live probes against `impoc_dev` (SELECT / EXPLAIN / catalog queries only). No DDL, no DML, no writes. `sequelize.sync()` is test-only and guarded.

---

## 0. Verdict summary

| Category | Verdict |
|---|---|
| SECURITY | PASS WITH CONDITIONS |
| QUERY-PERFORMANCE | FAIL |
| SCHEMA-DATA-INTEGRITY | PASS WITH CONDITIONS |
| CONCURRENCY-TX | FAIL |
| MIGRATIONS | PASS WITH CONDITIONS |
| **Overall** | **BLOCK** — CRITICAL double-refund / double-cancel races must be fixed before this postgres work is accepted (GOD-PLAYBOOK §8: anything producing a wrong money number is CRITICAL and blocks merge). |

---

## 1. CONCURRENCY-TX

```
SEVERITY   CRITICAL
ID         PG-1
LOCATION   backend/src/modules/sales/sales.service.js:315-361 (read at :318, reversal insert at :332-340)
ISSUE      refundSale is a read-check-write with no row lock and no CAS: Sale.findOne (no lock, no
           transaction.LOCK) -> status check -> SaleReversal.create(REFUND) -> save status=refunded.
           Two concurrent calls both observe status='completed' and both write a REFUND reversal.
IMPACT     Double refund paid out for one sale; sales.status is a lifecycle marker only, the reversal
           rows ARE the money-out record. Units stay sold (no transitionUnit), so nothing else catches
           the race. Direct money loss / wrong money number.
FIX        In cancelSale/refundSale use SELECT ... FOR UPDATE on the sale row before the status check
           (Sequelize `lock: transaction.LOCK.UPDATE`), AND add a DB backstop unique index:
           CREATE UNIQUE INDEX uq_sale_reversals_single_refund ON sale_reversals (sale_id)
             WHERE reversal_type = 'REFUND' AND deleted_at IS NULL;
           On conflict, return 409 (already refunded) instead of 500.
```

```
SEVERITY   CRITICAL
ID         PG-2
LOCATION   backend/src/modules/expenses/expenses.service.js:114-153 (read :117, reversal :131, save :142-143)
ISSUE      cancelExpense is read-check-write with no lock: Expense.findOne (line 117) -> status check
           (line 125) -> ExpenseReversal.create (line 131) -> status='cancelled'. Two concurrent cancels
           both pass the check and both insert a CANCEL reversal for the same expense.
IMPACT     Duplicate reversal row for one expense -> cancellations double-counted in expense reports and
           any downstream refund/ledger logic sees the amount twice. Wrong money number.
FIX        Lock the row (FOR UPDATE) before the status check and add a backstop unique index:
           CREATE UNIQUE INDEX uq_expense_reversals_single ON expense_reversals (expense_id)
             WHERE deleted_at IS NULL;
           Map the resulting unique violation to 409, not 500.
```

```
SEVERITY   HIGH
ID         PG-3
LOCATION   backend/src/modules/rentals/rental-agreement.service.js:340-469 (in-memory guard at :391-396,
           completion update at :461-467)
ISSUE      A dual-path race in processRentalReturn:
           (a) duplicate return of the same unit is only guarded in memory ((line.returns||[]).length>0
           at :392) — the real guard is the unit CAS inside transitionUnit (:447) INSERTING the
           rental_returns row BEFORE that CAS (:428); the CAS is the only thing preventing the double row.
           (b) two concurrent requests that return complementary line sets each compute allReturned from
           their own transaction-local snapshot (line 461-467); neither sees the other's uncommitted rows,
           so the agreement is never marked 'completed' and stays 'active' forever.
IMPACT     (a) double rental_returns row if the CAS ever changes; (b) lost update on agreement status —
           permanent stuck-active agreement that will block settle/reconcile. Wrong stock/fins state.
FIX        Add DB backstop: CREATE UNIQUE INDEX uq_rental_returns_line ON rental_returns (rental_line_id)
           WHERE deleted_at IS NULL;  AND lock the agreement row FOR UPDATE at the top of
           processRentalReturn / cancelRental so allReturned and status changes serialize.
```

```
SEVERITY   HIGH
ID         PG-4
LOCATION   backend/src/modules/sales/sales.service.js:238-294 (cancelSale) and
           backend/src/modules/rentals/rental-agreement.service.js:492-548 (cancelRental)
ISSUE      cancelSale/cancelRental rely on transitionUnit's CAS to fail the second racer. cancelSale does
           NOT transition units when the sale has no sold unit lines (lines 273-288 skip empty), so two
           concurrent cancels of a line-less sale both write a CANCEL reversal. cancelRental similarly
           only reverses "still rented" units, so a partially-returned agreement can be cancelled twice.
IMPACT     Duplicate reversal rows; money counts wrong on edge sales/agreements.
FIX        Same pattern as PG-1/PG-2: lock parent row FOR UPDATE, plus partial unique backstop
           (sale_reversals(sale_id) WHERE deleted_at IS NULL for CANCEL; rental_reversals(agreement_id)).
```

```
SEVERITY   MEDIUM
ID         PG-5
LOCATION   backend/src/modules/sales/sales.service.js:30-39 and
           backend/src/modules/rentals/rental-agreement.service.js:44-53
ISSUE      nextSaleNumber/nextAgreementNumber derive the next number by reading the max row
           (order id DESC, no lock) inside the same transaction. Two concurrent creates both read the same
           max, both insert the same S-XXXX/RA-XXXX on the unique sale_number/agreement_number key; the
           loser gets a raw unique-violation 500 instead of a generated/retried number.
IMPACT     Recurring 500s on checkout under concurrency. No money loss but checkout is the money path.
FIX        Use an advisory lock (pg_advisory_xact_lock per key) or a counter row, e.g.
           SELECT pg_advisory_xact_lock(hashtext('sale_number')); then compute next + insert in the same
           transaction; and/or catch the 23505 unique conflict and retry once.
```

---

## 2. QUERY-PERFORMANCE

```
SEVERITY   HIGH
ID         PG-6
LOCATION   backend/src/modules/reports/reports.service.js:62-101 (getDashboard)
ISSUE      Dashboard reads ENTIRE tables — Sale.findAll, SaleReversal.findAll, Expense.findAll,
           RentalReversal.findAll — then sums in JS (.reduce). No aggregation pushdown, no date index.
IMPACT     Linear scale-out of both query time and Node memory with table size; every dashboard hit loads
           the full financial history. Explains none.
FIX        Push aggregation to SQL: SELECT SUM(total_paise) FILTER (WHERE status='completed') FROM sales
           WHERE sold_at BETWEEN ... ; one query per metric, or a date-filtered GROUP BY.
```

```
SEVERITY   HIGH
ID         PG-7
LOCATION   backend/src/modules/reports/reports.service.js:327-447 (getTripPnlReport) and :450-517
           (getVendorPnlReport); O(n²) lookup at :405 and :416
ISSUE      Full-table loads of Trip, Stock, SaleLine, RentalReturn (and RentalLine, Vendor) into Node, then
           film aggregation per row including Object.keys(stockIdsByTrip).find(...) per sale line — an
           O(lines × trips) scan per report run.
IMPACT     O(n²) CPU in Node plus multi-GB row transfer at scale; report endpoint becomes the slowest and
           most memory-hungry API.
FIX        Rewrite as SQL joins/aggregates (e.g. SELECT ... FROM sale_lines JOIN sales JOIN units JOIN
           stocks ... GROUP BY stock.trip_id) with date filtering; serve a bounded result set.
```

```
SEVERITY   HIGH
ID         PG-8
LOCATION   tables: sales(sold_at), expenses(expense_date), rental_agreements(start_date).
           EXPLAIN (ANALYZE, BUFFERS) E1/E2 confirm Seq Scan + Sort on sold_at ranges with no index.
ISSUE      None of the money/history tables have an index on their date column, yet every report and list
           filters/sorts by sold_at / expense_date / start_date / actual_return_date.
IMPACT     Every date-bounded report degrades to a full table scan; at scale reports become unusable and
           overlap with PG-6/7 (full-table-into-JS makes it worse).
FIX        CREATE INDEX idx_sales_sold_at ON sales (sold_at) WHERE deleted_at IS NULL;
           CREATE INDEX idx_expenses_expense_date ON expenses (expense_date) WHERE deleted_at IS NULL;
           CREATE INDEX idx_rental_agreements_start_date ON rental_agreements (start_date);
```

```
SEVERITY   HIGH
ID         PG-9
LOCATION   FK index matrix (live catalog probe, CHECKS/FKIDX): referencing columns with NO supporting
           non-partial index
ISSUE      The following FKs are unindexed on the referencing side, so every join to the parent, every
           ON DELETE check, and every report join scans the child table:
           sale_lines(sale_id, unit_id); sale_reversals(sale_id); rental_lines(agreement_id, unit_id);
           rental_returns(agreement_id, rental_line_id, unit_id); rental_reversals(agreement_id);
           expense_reversals(expense_id); stocks(trip_id, trip_vendor_id, vendor_id, product_type_id);
           units(stock_id, colour_id, size_id); trip_vendors(trip_id, vendor_id);
           stock_templates(product_type_id, vendor_id); request_keys(actor_user_id);
           unit_status_events(actor_user_id); sales(created_by, customer_id);
           rental_agreements(created_by, customer_id); expenses(created_by); product_types(parent_id).
           Partial indexes (idx_stocks_trip_uuid, idx_trip_vendors_trip_vendor,
           idx_stock_templates_vendor_product_name, idx_product_types_parent_id_name) cannot serve FK
           checks — a partial index is never used for FK enforcement.
IMPACT     EXPLAIN E1-E5 confirm: sales report joins, trip/vendor P&L joins, unit listing joins all Seq
           Scan the child tables. Delete of a parent (customer/vendor/trip/unit) forces full scans on the
           financial children.
FIX        Add plain btree indexes on every referencing FK column listed above (non-partial), e.g.
           CREATE INDEX idx_sale_lines_sale_id ON sale_lines (sale_id);
           CREATE INDEX idx_sale_lines_unit_id ON sale_lines (unit_id);
           CREATE INDEX idx_units_stock_id ON units (stock_id); ... etc.
```

```
SEVERITY   MEDIUM
ID         PG-10
LOCATION   listSales backend/src/modules/sales/sales.service.js:201-202; listExpenses
           backend/src/modules/expenses/expenses.service.js:48-49; listAllUnits
           backend/src/modules/units/units.service.js:32-35
ISSUE      List endpoints fetch the full table with no pagination (Sales Sale.findAll(), Expense.findAll(),
           Unit.findAll) and unit listing builds filter via `where['$stock.uuid$']` (a correlated join on
           stocks.uuid) which scans units then stocks.
IMPACT     Linear memory and time per list hit; UI grids degrade quadratically with data.
FIX        Paginate (keyset: WHERE id < cursor ORDER BY id DESC LIMIT n) and add the supporting indexes;
           consider a concrete stock_uuid column on units if lookups stay hot.
```

```
SEVERITY   MEDIUM
ID         PG-11
LOCATION   backend/src/modules/customers/customers.service.js:80-95
           EXPLAIN E7 confirms Seq Scan for this predicate.
ISSUE      Customer search uses ILIKE '%term%' on name/phone/email. Leading-wildcard ILIKE cannot use the
           existing partial indexes (idx_customers_phone, idx_customers_email are on bare columns only).
IMPACT     Every search scans the customer table regardless of size.
FIX        If partial search is required at scale, add pg_trgm GIN indexes
           (CREATE EXTENSION pg_trgm; CREATE INDEX ... USING gin (name gin_trgm_ops)); otherwise switch to
           prefix search (name LIKE 'term%') which uses existing btree indexes.
```

```
SEVERITY   MEDIUM
ID         PG-12
LOCATION   backend/src/modules/delivery/delivery.service.js:26-55; EXPLAIN E6 (Seq Scan + Sort)
ISSUE      delivery_logs has no index on (entity_type, entity_id); provider_message_id is not unique.
           createDeliveryLog inserts without dedupe on the provider message id.
IMPACT     listDeliveryLogs(entityType, entityUuid) scans + sorts the whole log; duplicate provider sends
           are recorded as separate rows (no idempotency at storage layer).
FIX        CREATE INDEX idx_delivery_logs_entity ON delivery_logs (entity_type, entity_id);
           CREATE UNIQUE INDEX uq_delivery_logs_provider_msg ON delivery_logs (provider_message_id)
           WHERE provider_message_id IS NOT NULL AND deleted_at IS NULL; and map 23505 to a replay (retry).
```

```
SEVERITY   LOW
ID         PG-13
LOCATION   backend/src/database/pg-pool-config.js:49-57
ISSUE      A global parser registered for int8 (OID 20) uses parseInt into a JS number. Integers above
           2^53 lose precision. Applies to money columns only if they ever exceed that (unlikely at paise
           scale) but applies to app_settings.value_int and any aggregate COUNT/SUM shapes.
IMPACT     Silent precision loss on large int8 values; SQL aggregates are returned as int8.
FIX        Return bigint as a string (default pg behavior) and keep DTO serialization explicit, or parse
           into BigInt and stringify; only convert to Number when Number.isSafeInteger(value) is true.
```

---

## 3. SCHEMA-DATA-INTEGRITY

```
SEVERITY   MEDIUM
ID         PG-14
LOCATION   SaleReversal/RentalReversal/ExpenseReversal/RentalReturn tables (migrations for sales, rentals,
           expenses; live catalog CHECKS probe)
ISSUE      No DB-level single-reversal / single-return idempotency indexes exist anywhere; all reversal
           tables are plain (id, uuid) pkey + uuid unique. Reversal uniqueness only lives in app CHECK code.
IMPACT     Enables every PG-1..PG-4 race to materialise as a duplicate financial row.
FIX        Add the partial unique backstops listed in PG-1..PG-3. Distinct from app-layer fixes: this is
           the storage-level guarantee.
```

```
SEVERITY   MEDIUM
ID         PG-15
LOCATION   backend/database/migrations/<add-inventory-v2-type-price> and live stocks/units CHECK probe
ISSUE      Selling-price floor relationships are only partly enforced: stocks has
           CHK (floor_price_paise <= selling_price_paise) but units and stock_templates have no ceiling
           cross-column check (floor <= selling). rents/deposits on units are nullable without a
           channel-conditional rule (RENTAL channel could be written with null rent_per_day_paise).
IMPACT     Nonsensical price relationships and rental units with no price possible at the storage layer.
FIX        Add CHECK (floor_price_paise IS NULL OR selling_price_paise IS NULL OR
           floor_price_paise <= selling_price_paise) on units and stock_templates, and a channel-conditional
           CHECK ((channel = 'RENTAL') = (rent_per_day_paise IS NOT NULL)) on units.
```

```
SEVERITY   INFO
ID         PG-16
LOCATION   delivery_logs (backend/database/migrations/<seed-... / add-delivery-permissions>), live probe
ISSUE      delivery_logs.entity_type is a polymorphic pointer (SALE/RENTAL/QUOTE/GENERAL) with no FK — a
           deliberate design, noted for sign-off. entity_type is fixed-set-enforced by CHECK (good).
IMPACT     Orphans possible if a parent is hard-deleted; currently all parent deletes are soft.
FIX        Document the polymorphism; keep the (entity_type, entity_id) index from PG-12; no ACTION needed.
```

```
SEVERITY   INFO
ID         PG-17
LOCATION   backend/database/migrations/ (whole directory)
ISSUE      Verified-green schema rules (no fix required, recorded for the record): money is integer minor
           units (paise BIGINT) with CHECK (>= 0) on every money column (stocks, units, sale_lines, sales,
           sale_reversals, rental_*, expenses, expense_reversals, stock_templates, trip_vendors); status
           columns are CHECK-constrained enums; financial history is append-only (reversal rows, never
           UPDATE of amounts — confirmed in cancel/refund flows); sale_lines/rental_lines snapshot price,
           barcode and deposit at transaction time; PK on every table; unit barcode, picklist names and
           product-type names protected by partial unique indexes (WHERE deleted_at IS NULL [AND
           is_active]) — correct soft-delete scoping.
IMPACT     —
FIX        —
```

---

## 4. MIGRATIONS

```
SEVERITY   HIGH
ID         PG-18
LOCATION   backend/database/migrations/* (all)
ISSUE      No migration sets SET lock_timeout / statement_timeout before DDL. Every ALTER TABLE
           ADD CONSTRAINT and CREATE INDEX runs with server defaults (lock_timeout=0 per live pg_settings),
           holding ACCESS EXCLUSIVE for the full scan.
IMPACT     Safe today because the tables are empty; at production size any constraint/index DDL blocks all
           reads+writes on that table for the duration and can queue behind app traffic indefinitely
           (the lock queue blocks incoming readers).
FIX        Prefix DDL migrations with SET local lock_timeout = '3s'; SET local statement_timeout = '30s';
```

```
SEVERITY   HIGH
ID         PG-19
LOCATION   backend/database/migrations/* (index DDL, e.g. create-barcode-seq, seed-barcode-geometry,
           add-inventory-v2-type-price)
ISSUE      Zero CREATE INDEX CONCURRENTLY anywhere; every index is created with the default non-concurrent
           form (verified against live catalog).
IMPACT     On non-empty production tables index builds block writes for the build duration.
FIX        CREATE INDEX CONCURRENTLY (cannot run inside a transaction — run migrations with the
           queueOperations option or raw queries), drop+retry on failure, and apply only after the
           lock_timeout guard in PG-18.
```

```
SEVERITY   MEDIUM
ID         PG-20
LOCATION   backend/database/migrations/* (ADD CONSTRAINT statements, e.g. sales/rentals/units constraints)
ISSUE      Constraints on existing tables were added with a plain ADD CONSTRAINT (immediate full-scan
           validate) rather than the two-step NOT VALID + VALIDATE route.
IMPACT     Actionable only on large tables; on empty dev tables zero cost. Once tables are large, a missing
           backfill window becomes a full-table rewrite.
FIX        For future constraints on populated tables: ADD CONSTRAINT ... NOT VALID; then
           ALTER TABLE ... VALIDATE CONSTRAINT (the second step still takes SHARE UPDATE EXCLUSIVE but is
           cheap and can be run separately).
```

```
SEVERITY   LOW
ID         PG-21
LOCATION   backend/database/migrations/* (down migrations)
ISSUE      Migrations are reversible (up/down pairs exist) but none are rollback-verified against a
           production-sized dataset; a couple are marked effectively-irreversible (e.g. drops).
IMPACT     Rollback of a long migrations chain is unproven; destructive drops lack a backup/human-approval
           ceremony in the migration comments.
FIX        Run the migrations (and rollback) against a populated staging database in CI; add an explicit
           "IRREVERSIBLE — human approval required" comment + backup verification to any drop/DROP.
```

---

## 5. SECURITY

```
SEVERITY   HIGH
ID         PG-22
LOCATION   backend/config/config.js:27-61 and backend/.env.example
           live probe: pg_roles shows the only login-capable role is 'postgres' with rolsuper=TRUE;
           session: current_user = postgres, port 5432.
ISSUE      The application connects to PostgreSQL as the superuser. .env.example documents DB_USER=postgres
           and the live cluster has no dedicated app role. No least privilege, no per-schema separation.
IMPACT     SQL injection (none found today) or a single app bug would grant full DB control; also any
           superuser session can kill connections/DROP schema; risk amplified if the same credentials are
           reused on a remote/dev database.
FIX        Create a dedicated role (e.g. impoc_app) granting SELECT/INSERT/UPDATE/DELETE on the app schema
           tables (no superuser, no CREATEROLE), use it in .env, and keep postgres only for migrations.
```

```
SEVERITY   MEDIUM
ID         PG-23
LOCATION   backend/config/config.js (dialectOptions absent), backend/src/database/pg-pool-config.js
           live pg_settings: statement_timeout=0ms, lock_timeout=0ms,
           idle_in_transaction_session_timeout=0ms, ssl=off.
ISSUE      No statement/lock/idle-in-transaction timeouts configured on the client pool or the server, and
           no TLS settings for the client. A runaway report query (PG-6/7) or an abandoned transaction
           holds resources/blocking indefinitely.
IMPACT     Connection pool starvation and bloat on a busy checkout path; idle-in-transaction sessions block
           autovacuum and the rest of the queue.
FIX        Set pool options statement_timeout/lock_timeout/idle_in_transaction_session_timeout via
           dialectOptions (e.g. options: { statement_timeout: 15000, lock_timeout: 5000,
           idle_in_transaction_session_timeout: 30000 }); enable ssl for any non-local environment.
```

```
SEVERITY   INFO
ID         PG-24
LOCATION   whole backend/src tree
ISSUE      Verified-green security: all queries go through Sequelize (parameter binding); the only raw
           queries found (units transition CAS, app_settings reads, barcode sequence draws) use bound
           replacements, not string interpolation; no PUBLIC grants on app tables (owner-only grants in the
           live catalog); .env is gitignored and no credentials appear in tracked source.
IMPACT     —
FIX        Keep auditing on every new raw query; never string-interpolate user input into SQL.
```

---

## Checklist (postgres-code-review gate lanes)

- [x] Lane 1 — Schema and migration safety applied (chronological per-file pass)
- [x] Lane 2 — Correctness and constraints applied (money/CHECK/snapshot rules verified)
- [x] Lane 3 — Concurrency reasoned about for every read-then-write (see PG-1..PG-5)
- [x] Lane 4 — Query quality: EXPLAIN (ANALYZE, BUFFERS) x8 + index matrix (see PG-6..PG-13)
- [x] Lane 5 — Security applied (roles, grants, raw-query audit, secrets)
- [x] Lane 6 — Operational applied (timeouts, index write-cost, retention)
- [x] Production row counts considered (dev DB empty; findings reason about scale)
- [x] Findings carry severity, location, why-it-is-wrong, fix
- [x] No fixes authored by the reviewer (read-only; document)
- [x] Verdict issued (above)

## References
- `md-framework/agents/engineering/postgres-specialist.md` (agent brief)
- `md-framework/skills/postgresql/*` (postgres-code-review, concurrency, locking, indexing, migrations, constraints, transactions, data-integrity, query-optimization, explain-analyze, schema-design, normalization, partitioning)
- `md-framework/skills/architecture/database-architecture`, `md-framework/skills/nodejs-backend/sequelize`, `md-framework/skills/project-knowledge/project-database`, `md-framework/GOD-PLAYBOOK.md` (severity scale §8)
- Live catalog probes (roles, grants, settings, CHECK constraints, FK-vs-index matrix, seq-scan stats) and EXPLAIN (ANALYZE, BUFFERS) E1–E8 run against `impoc_dev` on 2026-09-08