# IMPOC Backend Review — Security, Speed, Efficiency (R-27)

**Reviewer:** worker-node-code-review-r27 (Jim, Senior Node.js Backend Engineer)
**Scope:** `backend/` only (Express 5 + Sequelize 6 + PostgreSQL, vanilla JS ESM, Zod, Jest)
**Date:** 2026-09-08
**Method:** Read-only review of `backend/src`, `backend/database`, `backend/config`, `backend/package.json`, `backend/.env.example`. Lenses applied: backend-engineer / code-security-reviewer / performance-engineer briefs + nodejs-backend, performance, secure-code-review, query-composition (N+1 / batching / pagination) skills. Static checks only: direct code reads, `npm audit` (temp-lockfile, no source writes). No servers started, no jest run, no code modified.
**Prior report:** `hive/SECURITY-FINDINGS.md` (2026-09-07, security-only, verdict BLOCK). All application-layer security items re-encountered here are recorded as **DUPLICATE-SEC-<id>** confirmations, not re-derived. This report's value-add is the SPEED and EFFICIENCY layers plus NEW security items.

---

## Verdicts

| Category | Verdict |
|---|---|
| **SECURITY** | **BLOCK** — All 3 Critical / 10 High from the prior security review are still present in this tree (confirmed below). New: 2 findings (one Medium auth/ledger-integrity gap, one Low header disclosure). |
| **SPEED** | **BLOCK** — Multiple unbounded full-table list/report endpoints, N+1 checkout, event-loop blocking in barcode rendering, and 3 overhead DB queries per request. These will fail the documented latency budgets (scan→line <100ms, sale <1s, reports <3s) as data grows. |
| **EFFICIENCY** | **PASS WITH CONDITIONS** — Money/Number coercion (DUPLICATE-SEC-H-7) plus several `0→NULL`/`0→default` coercions, the highest-value concurrency test never runs in CI, and heavy duplication. All fixable without redesign. |
| **OVERALL** | **BLOCK** |

---

## Finding counts

By severity (all NOD findings): **Critical 1 · High 6 · Medium 15 · Low 11**
By category: **SECURITY 2 new (+ 19 confirmed DUPLICATE-SEC) · SPEED 17 · EFFICIENCY 14**

---

## SECURITY (NEW findings)

### NOD-23 — MEDIUM — SECURITY — SALES.UPDATE can re-date / re-attribute a financially settled (completed) sale
- **file:line:** `backend/src/modules/sales/sales.service.js:370-423` (`patchSale`), `:391-393` (`soldAt`), route gate `sales.routes.js:29`
- **Why wrong:** `patchSale` freely mutates `soldAt`, `customerName`, `customerId`, and `notes` on a sale whose status is `completed`/settled. `soldAt` selects the accounting period for the dashboard/report range filters (`reports.service.js:59`), so a holder of `SALES.UPDATE` can backdate or forward-date a completed sale and shift revenue between periods with no record (no `updated_by`/audit column is written). The same pattern exists in `rental-agreement.service.js:572-620`.
- **Impact:** Silent revenue-shift between accounting periods / customer mis-attribution on the money ledger — a record-integrity vector on the money crown-jewel that the prior review did not cover (it covered cancel/refund races, not PATCH re-dating).
- **Fix:** Disallow `soldAt` mutation once status is `completed`/`refunded` (or only allow it via an audited adjustment flow); persist `updatedBy`; validate `soldAt` cannot move outside the current open period for revenue-bearing records.

### NOD-31 — LOW — SECURITY — `X-Powered-By: Express` header left enabled
- **file:line:** `backend/app.js:30-53` (no `app.disable('x-powered-by')`; Express 5 emits the header by default)
- **Why wrong:** Fingerprintable version banner on every response; aids attackers targeting known Express CVEs. Prior hardening list (HN-3) covered helmet but not this.
- **Impact:** Trivial information disclosure / reconnaissance.
- **Fix:** `app.disable('x-powered-by')` (and add helmet while there — DUPLICATE-SEC-HN-3).

---

## SECURITY (confirmed duplicates of the prior review — one-line confirmations, verified in this worktree)

| DUPLICATE-SEC id | Confirmation (verified) |
|---|---|
| CR-1 | `sales.service.js:315-360` (refund) / `238-309` (cancel): status is read then `save()`-d — no CAS (contrast `units.service.js:392-406`); replay unguarded. Expense cancel identical shape. |
| CR-2 | `user-role.service.js` assign/remove + `users.update` wiring: MANAGER can assign ADMIN (prior finding unchanged). |
| CR-3 | `auth.middleware.js:55-62` `jwt.verify` without `algorithms`; session keyed by `payload.sessionId` only, `payload.sub` never bound to `session.userId`; `.env.example:14,15,17` placeholder secrets (`your-long-random-access-secret`, `Admin@12345`). |
| H-1 | No rate limit / lockout on `POST /api/auth/login` (`auth.routes.js:22`); `app.js` mounts none. |
| H-2 | 12 read routes authenticate-only (intake `trip.routes.js`, `stock.routes.js`, `template.routes.js`, `vendor.routes.js`, `units.routes.js:23,27,34`) — no `authorize()`. |
| H-3 | `users.update`/`users.create` target any uuid incl. admins; arbitrary `roleUuid` at create. |
| H-4 | `trip.service.js:213-223` / `stock.service.js:33-43` duplicate `verifyTripAccess` stub (trip-exists only, `user` unused); stock scan lookup by `{uuid}` only. |
| H-5 | `receipts.routes.js:13,16` `REPORTS.VIEW` gate only; `receipts.service.js:82-87,138-143` by enumerable uuid with customer PII block. |
| H-6 | `sales.service.js:83` `where = unitUuid ? {uuid} : {barcode}` — both-undefined drops key → sells first arbitrary unit; rental item/return schemas same (empty-item hole; see NOD-29 test gap). |
| H-7 | `pg-pool-config.js:51-62` `parseInt` on int8 OID 20; money then recomputed in JS `Number` (see NOD-18). |
| H-8 | frontend `localStorage` access token (out of my scope; confirmed unchanged prior). |
| H-9 | `auth.middleware.js:89-110` checks session only, never `user.status`; note `permission.service.js:43` DOES gate status for `authorize`d routes, so H-9 bites the authenticate-only routes. |
| H-10 | `auth.controller.js:21-34` `secure: isProduction` only. |
| M-1 | `trip.validation.js:5-9` money ceiling = int8 max, not `Number.MAX_SAFE_INTEGER`. |
| M-2 | `template.validation.js:11,23,36,54` money accepted as string/float, `.transform((v)=>Number(v))`, no `.int()`/upper bound. |
| M-3 | Idempotency infra (`idempotency.service.js`) wired only for barcode; sale/rental/expense POSTs unprotected. |
| M-4 | `sales.service.js:30-39` / `rental-agreement.service.js:44-53` MAX+1 doc-number race. |
| M-5 | `createdBy` stored (`sales.service.js:148`) but never scopes reads. |
| M-6 | `delivery.validation.js:17` `z.unknown()` arbitrary payload. |
| M-7 | `error.middleware.js:19-24` echoes `error.message` for <500 incl. row details (`stock.service.js:499-505`, `sales.service.js:102-106`). |
| M-8 | Free-form `paymentMethod`/`customerSource` (`sales.validation.js:13-14`). |
| L-1 | Login timing username enumeration (`auth.service.js`). |
| L-2/L-3 | `users.view` exposes staff email/phone; internal `customerId` in DTOs (`sales.service.js:51`). |
| L-6 | `stock.controller.js:141` bare `req.user.id` deref. |
| HN-3 | No helmet / security headers (`app.js`). |
| HN-4 | `.env.example:23` documents `SEED_ADMIN_PASSWORD=Admin@12345`; placeholder DB creds at `:8`. |

---

## SPEED

### NOD-1 — CRITICAL — SPEED — Checkout is an N+1 serial query chain inside one transaction (~6 queries per basket item)
- **file:line:** `sales.service.js:120-179` (create), `:273-288` (cancel); `rental-agreement.service.js:183-267` (create), `:340-485` (return), `:520-560` (cancel); `units.service.js:364-459` (transitionUnit)
- **Why wrong:** Per item the loop runs `resolveSellableUnit` (1 `findOne`) then `transitionUnit` which itself does `Unit.findOne` (`units.service.js:364`), CAS `UPDATE` (`:393`), `UnitStatusEvent.create` (`:434`), and a DTO `findByPk` with 3 includes (`:450`) — 4 queries — all `await`-serialized in `for...of` loops, all inside one transaction. A 10-item basket ≈ 60 sequential round trips; a large stock scan/return many times that.
- **Impact:** Barcode-scan→line and complete-sale latency grow linearly with basket size (violating the <100ms / <1s budgets at moderate basket/terminal sizes); DB connections+unit row-locks are held the whole time.
- **Fix:** Batch-resolve all units with one `Unit.findAll({where:{[Op.or]:[{uuid},{barcode}]}})` before opening the transaction; `SaleLine.bulkCreate`; batch transition under one `UPDATE ... WHERE id IN (...) AND status='in_stock'` + `UnitStatusEvent.bulkCreate` (keep the CAS predicate).

### NOD-2 — HIGH — SPEED — List endpoints are unbounded (no limit/offset/pagination) with deep includes
- **file:line:** `sales.service.js:201-212`; `rental-agreement.service.js:272-287`; `expenses.service.js:48-56`; `stock.service.js:649-681`; `trip.service.js:73-94`; `units.service.js:35-77`; `template.service.js:32-51`; `vendor.service.js:4-11`; `user.service.js:12-35`
- **Why wrong:** Every list `findAll()` hydrates the entire table plus nested `lines`→`unit`, `reversals`, vendor/trip trees, with no `page`/`pageSize`/cursor in the query schemas (e.g. `sales.validation.js` defines no list schema at all). Payload and event-loop cost grow unbounded; the widest (units, 4 deep; stocks with all units) can be multi-hundred-MB responses.
- **Impact:** Main-screen calls degrade to O(all-data) per request; memory/CPU/JSON-serialization block the event loop; no client-side paging possible.
- **Fix:** Mandatory `page`/`pageSize` (keyset cursor on the `createdAt DESC` order), `findAndCountAll`, return `total`, and use `separate: true` or second queries for children so parents page before children load (mirror `units.service.js:579-626` `getUnitStatusEvents`).

### NOD-3 — HIGH — SPEED — Reports aggregate whole tables in JS instead of SQL (some O(N×T))
- **file:line:** `reports.service.js:56-128` (dashboard loads ALL `SaleReversal`/`RentalReversal`, filters in JS), `:326-348` (`rentalRevenueInPeriod` loads ALL `RentalReturn` with 3-level include), `:361-443` (`getTripPnlReport`: all trips + all stocks + all saleLines + all rentalReturns; `:405`/`:416` nested `Object.keys(stockIdsByTrip).find(...includes)` inside the per-line loop → O(T×L)), `:448-515`, `:521-572`, `:578-624` (whole-unit-table scans)
- **Why wrong:** Every report serializes entire analytics tables to the app, materializes ORM instances, then folds in JS. Report range filters are not pushed into the reversal/return queries.
- **Impact:** Dashboard/report latency scales with all-time data; concurrent dashboard loads saturate the pool and memory (violates the <3s report budget).
- **Fix:** Rewrite as SQL aggregate queries (`COUNT`/`SUM`/`GROUP BY`) with the period filter pushed down; load `stockId`→`tripId` mapping in one small query for the P&L joins instead of re-scanning arrays.

### NOD-4 — HIGH — SPEED — Lists materialize every unit row only to produce a count
- **file:line:** `stock.service.js:672-678` + `:705` (`unitsScannedCount`, include `attributes:['id']`, `required:false`); same shape `trip.service.js:49-54`; nested in `vendor.service.js:168-187`
- **Why wrong:** To render a count, the ORM joins the entire units child-set and transfers all unit IDs/rows, then discards them. For a trip/vendor with thousands of scanned units this is a multi-MB join result per parent.
- **Impact:** Quadratic growth (parents × child rows) in response size and query time on intake screens.
- **Fix:** `Unit.count({where:{stockId:...}, group:['stockId']})` (one aggregated query) or a correlated subquery; drop the `units` include from list DTOs.

### NOD-5 — HIGH — SPEED — Trip list ships base64 receipt images + runs a second full-table scan
- **file:line:** `trip.service.js:63` (`TRIP_VENDOR_INCLUDE` selects `receiptImage`), `:73-94` (`listTrips` uses it and also runs `Stock.findAll` over ALL stocks for `buyingSum`)
- **Why wrong:** `receiptImage` is a base64 TEXT (validation allows up to 10 MB, `trip.validation.js:28`); the list endpoint serializes every bill blob into the response for a view that shows metadata only. `listTrips` additionally scans the whole stocks table in a second query to sum buying prices.
- **Impact:** Multi-MB to tens-of-MB payloads on `GET /api/trips`; event-loop-blocking JSON string handling; DB hit on every list load.
- **Fix:** Drop `receiptImage` from the list include (expose only on trip-detail); compute buying sums only for the page's tripIds (or a single `GROUP BY tripId` with the row scan already joined).

### NOD-6 — HIGH — SPEED — Barcode/PDF generation blocks the event loop and holds a DB transaction across the whole render
- **file:line:** `barcode.service.js:123-177` (transaction opened at `:123`, `generateBarcodePdf` inside it at `:154`, commit at `:171`), `barcode.generator.js:153-154` (sync `bwipjs.toBuffer` per label, up to `BARCODE_CONFIG.maxPages` × columns × rows labels), `app-settings.service.js:47-110` (~12 `app_settings` reads per request)
- **Why wrong:** The request path rasterizes up to ~10,000 Code-128 labels synchronously on the event loop while a Postgres transaction + connection are held open for the entire duration. Any concurrent barcode request starves all other API traffic.
- **Impact:** Seconds of event-loop blocking and long-held DB connections under any barcode-sheet request; other POS requests hang.
- **Fix:** Render in a worker-thread pool / off-request job; draw the sequence values first, commit, then render; cache `app_settings` geometry in-process (invalidated on write).

### NOD-7 — HIGH — SPEED — Every authenticated+authorized request issues 3 DB queries before business logic
- **file:line:** `auth.middleware.js:89-94` (`AuthSession.findOne`), `:123-134` (`User.findOne` for `req.user`), `authorization.middleware.js:12-15` → `permission.service.js:7-58` (user → roles → permissions nested)
- **Why wrong:** Three serial round-trips on the hot path for every API call; role memberships and user profiles change rarely. The permission check even refetches the user row again (4 rows worth in the nest).
- **Impact:** Direct throughput divider (~3× baseline query cost) on every request; amplifies all other latency.
- **Fix:** Keep the session liveness check (one query); derive identity from the token claims; cache permission sets per `userUuid` with a short TTL (invalidate on role change), or embed permission claims in the JWT with session-keyed revocation.

### NOD-8 — MEDIUM — SPEED — Wide transaction scopes (reads + long loops held under one tx; per-vendor N+1 in trip create)
- **file:line:** `trip.service.js:104-152` (per-vendor `Vendor.findOne` at `:120` inside loop inside tx), `sales.service.js:120-181`, `rental-agreement.service.js:184-251`
- **Why wrong:** Read-only work (unit resolution, number derivation) runs inside the write transaction, and the tx stays open across the entire serial write loop, holding `units` row locks for the full request duration.
- **Impact:** Concurrent POS checkouts serialize on unit locks; connection-hold time = full request duration; pool exhaustion at modest concurrency.
- **Fix:** Do read-only lookups before `sequelize.transaction()`; open the tx only for writes (which NOD-1 batches to a handful of statements).

### NOD-9 — MEDIUM — SPEED — `transitionUnit` builds a DTO every internal caller throws away
- **file:line:** `units.service.js:449-459`
- **Why wrong:** Every checkout/return/cancel pays a `findByPk` + 3 includes + DTO mapping per unit purely to return a value the sale/rental loops never read (`sales.service.js:169-179`, `rental-agreement.service.js:239,447,529`).
- **Impact:** ~25% of per-unit DB work is waste, inside the already-wide transaction (compounds NOD-1/NOD-8).
- **Fix:** Add an internal light path (skips step 7, returns the `UnitStatusEvent`/id) used by all loops; keep the DTO only on the HTTP `transitionUnitEndpoint`.

### NOD-10 — MEDIUM — SPEED — PATCH endpoints hydrate the full include tree twice for a scalar update
- **file:line:** `sales.service.js:371-377` + `:415-421`; `rental-agreement.service.js:572-579` + `:613-620`
- **Why wrong:** `patchSale` only mutates top-level columns (`customerName`, `soldAt`, `notes`, `customerId`) yet loads every line→unit→reversal, then re-loads the same tree after `update()`; the initial load is only used for existence + id.
- **Impact:** Patch latency ∝ sale/agreement history size instead of O(1); double hydrate + double DTO map per patch.
- **Fix:** Select only needed scalars for the existence check; after the update reuse one lightweight fetch (or assemble the DTO from rows already in hand).

### NOD-11 — MEDIUM — SPEED — Post-commit re-fetch sits inside `try/catch` → a false-failure 500 after commit
- **file:line:** `sales.service.js:181-194`, `:296-304`, `:348-356`; `rental-agreement.service.js:251-262`, `:546-557`
- **Why wrong:** `await transaction.commit()` then a fresh multi-join `findByPk` remains inside the `try` block whose `catch` calls `transaction.rollback()` on an already-committed tx and rethrows → a successful write returns 500 if the re-fetch fails. Wastes a full-tree query too (data already in memory).
- **Impact:** Spurious failed checkouts under transient read errors (duplicate-fetch risk on user retry), plus an extra multi-join query per write endpoint.
- **Fix:** Move the response re-fetch (or drop it, building the DTO from in-memory rows) outside the try/catch.

### NOD-12 — MEDIUM — SPEED — No HTTP response compression
- **file:line:** `app.js:30-53`; `package.json` (no `compression` dep)
- **Why wrong:** All list/report payloads (heavy JSON of repeated UUIDs/strings) are sent uncompressed; Express doesn't gzip by default.
- **Impact:** Multiplied bandwidth/latency on the exact endpoints flagged in NOD-2/NOD-3/NOD-5 on office/LAN connections.
- **Fix:** `app.use(compression())` after `cors`; filter to compress JSON (skip the already-binary PDFs).

### NOD-13 — MEDIUM — SPEED — No caching for near-static configuration and picklists
- **file:line:** `app-settings.service.js:47-110` (comment: "no in-process caching — fresh read on every call"), used at `barcode.service.js:37-38` + ~10 reads in `barcode.generator.js:298-336`; picklist services (`colour/size/damage-grade/payment-method/customer-source .service.js`)
- **Why wrong:** `app_settings` and reference tables are written only by admin endpoints yet are re-queried per request.
- **Impact:** Unnecessary DB traffic on the hottest read paths (barcode sheet gen reads ~12 settings per request).
- **Fix:** Load settings once into an in-process Map at boot, invalidate on settings write; cache picklists with a short TTL (display-only data — nothing gating money/stock, so safe per perf brief).

### NOD-14 — LOW — SPEED — `getVendorHistory` is an unbounded deep eager-load
- **file:line:** `vendor.service.js:127-209` (tripVendors → trips → all stocks → all units + colour/size, no limit, then JS re-sorts)
- **Why wrong:** One vendor GET can materialize the vendor's entire multi-year purchase tree into one response.
- **Impact:** Multi-MB payloads + event-loop sort/map cost on a single endpoint; memory risk on large vendors.
- **Fix:** Paginate units/stocks, project only needed columns, order inside the include, or replace with counts + a drill-down endpoint.

### NOD-15 — LOW — SPEED — Customer list silently truncates (no offset → unreachable rows)
- **file:line:** `customers.service.js:80-99` (`limit: search ? 50 : 20`, no offset/next)
- **Why wrong:** Customers beyond the cap are permanently invisible; leading-wildcard `iLike` scans full table.
- **Impact:** Hidden data loss + full-scan searches on a growing table.
- **Fix:** Return `{items, total, hasMore}` with page/offset; consider `pg_trgm` for wildcard search.

### NOD-16 — LOW — SPEED — Unconditional per-request `console.log` of method + URL
- **file:line:** `app.js:55-58`
- **Why wrong:** Synchronous stdout write on every request; no level, request id, timing, or status; logs query strings/UUIDs of every resource.
- **Impact:** Minor CPU/IO per request; weakens observability (no duration/status) and clutters production logs.
- **Fix:** Replace with structured logging (`morgan`/`pino-http`) including duration and status; suppress in production.

### NOD-17 — LOW — SPEED — Per-item damage-grade lookup inside the return loop
- **file:line:** `rental-agreement.service.js:398` (`await resolveDamageGrade` per return item, in-transaction)
- **Why wrong:** Damage grades are a tiny lookup table; one extra serialized round-trip per returned item.
- **Impact:** Adds latency to the already-long return loop (NOD-1).
- **Fix:** Pre-fetch grades with one `findAll`/`Op.in` into a Map before the loop.

---

## EFFICIENCY / CORRECTNESS / MAINTAINABILITY

### NOD-18 — MEDIUM — EFFICIENCY — Money coerced through JS `Number` and `||`/`transform` defaults (DUPLICATE-SEC-H-7, M-1, M-2)
- **file:line:** `sales.service.js:134` (`totalPaise` reduce via `Number`); `trip.service.js:91` (`Number(row.buyingSum) || 0`), `:154`; `vendor.service.js:224` (`stock.quantity * Number(...)`); `receipts.service.js:90,103,149-168`; `template.validation.js:11,23,36,54` (`.transform(v => Number(v))` on user money)
- **Why wrong:** The DB stores BIGINT paise and DTOs deliberately return them as strings to preserve precision, but the same values are then summed/multiplied as IEEE-754 doubles, silently losing precision above 2^53 and mixing float multiplication into money. `template.validation.js` even coerces user input to Number before writing BIGINT.
- **Impact:** Silent wrong totals/variance/receipts (already the prior H-7/M-1/M-2 findings — confirmed present; this entry adds the exact line-level evidence).
- **Fix:** Aggregate in SQL; keep paise as string/BigInt through validation (`Number.isSafeInteger` guard as in `app-settings.service.js:88`); reject unsafe magnitudes at the zod boundary.

### NOD-19 — MEDIUM — EFFICIENCY — `|| null` on money fields converts a legitimate 0 into NULL
- **file:line:** `stock.service.js:174-176` (`rentPerDayPaise/rentPerDayPaise/depositPaise/overduePerDayPaise || null`) vs the correct `?? null` on the sibling field at `:170`
- **Why wrong:** A zero deposit/rent value is stored as NULL, which downstream `!= null` string-DTO branches and variance math treat differently from a real 0.
- **Impact:** Wrong financial field values persisted silently on RENTAL stock creation.
- **Fix:** Use `?? null` consistently.

### NOD-20 — MEDIUM — EFFICIENCY — Heavy duplication across modules (helpers, include trees, UUID regexes)
- **file:line:** `escapeHtml` duplicated `trip.controller.js:19-29` = `template.controller.js:18-28`; `verifyTripAccess` `stock.service.js:33-43` = `trip.service.js:213-223`; `mapStockDTO` `stock.service.js:560-580` = `trip.service.js:444-466`; `resolveSubType` `stock.service.js:586-611` = `template.service.js:256-281`; `resolveCustomer`/`nextNumber`/unit resolver duplicated `sales.service.js:9-109` = `rental-agreement.service.js:19-111`; full sale include tree written ~5× in `sales.service.js`; UUID regex re-implemented in `trip.controller.js:126`/`vendor.controller.js:73,97`/`stock.controller.js:18-26` when zod already validates.
- **Why wrong:** Same logic maintained in five places drifts (e.g. `createStock` uses `|| null` while `updateStock` uses `?? null`, NOD-19); fixes require edits in many near-identical blocks.
- **Impact:** Regression risk, divergent bugfixes, higher review cost.
- **Fix:** Extract shared `fetchFullSale`/`verifyTripAccess`/`escapeHtml`/`nextNumber` helpers into `src/utils`/a common service; rely on zod for UUID validation.

### NOD-21 — MEDIUM — EFFICIENCY — Oversized service functions
- **file:line:** `rental-agreement.service.js:340-485` (`processRentalReturn` ~145 lines: lookup + money math + grade resolution + per-line writes + completion + DTO), `vendor.service.js:127-209`, `reports.service.js` compound functions
- **Why wrong:** Multiple responsibilities per function make the loop/tx inefficiencies (NOD-1/NOD-8) hard to refactor safely and hard to test in isolation.
- **Impact:** Regression risk on every money/stock change.
- **Fix:** Split per-line processing into helpers; keep completion/bookkeeping separate.

### NOD-22 — MEDIUM — EFFICIENCY — The only unit-state-machine concurrency test never runs in CI
- **file:line:** `jest.config.js:3` (`testMatch: ['**/tests/**/*.test.js']`) excludes `src/modules/units/__tests__/transitionUnit.test.js` (the ONLY CAS/race test: `Promise.all` "one success, one 409") and `database/migrations/__tests__/20260825000006-seed-barcode-geometry.test.js`
- **Why wrong:** The stock/money concurrency guarantee (CAS `UPDATE ... WHERE status=expected`, `units.service.js:392-406`) — the pattern CR-1 must adopt — has zero CI coverage; the suite reports green while the most important race test is silently skipped.
- **Impact:** A regression in the CAS guard or the status-event invariant would go undetected.
- **Fix:** Set `testMatch` (or add a second pattern) to include `**/__tests__/**/*.test.js`; list the concurrency test explicitly in the CI command.

### NOD-24 — MEDIUM — EFFICIENCY — `actorUserId` accepted but never persisted in `updateExpense`; no `updatedBy` anywhere
- **file:line:** `expenses.service.js:79`
- **Why wrong:** Callers pass an actor identity that is thrown away, and the money-adjacent PATCH paths write no audit trail of who changed a record.
- **Impact:** No accountability/audit for money-record edits (consistent with NOD-23).
- **Fix:** Persist `updatedBy` from `actorUserId` (and add the column) or drop the unused param.

### NOD-25 — LOW — EFFICIENCY — Hardcoded business rules instead of configuration
- **file:line:** `rental-agreement.service.js:36-38` (`DEFAULT_RENTAL_DAYS = 3`), `sales.service.js:38` / `rental-agreement.service.js:52` (`S-`/`R-` prefixes, `padStart(4,'0')`)
- **Why wrong:** Business rules buried in code while an `AppSettings` table exists (used by barcode geometry).
- **Impact:** Rule changes require redeploys; numbering format not configurable.
- **Fix:** Read defaults from `AppSettings` with the existing `Number.isSafeInteger` guard.

### NOD-26 — LOW — EFFICIENCY — Transactions opened for single isolated writes / oversized in template flows
- **file:line:** `vendor.service.js:58-117` (`updateVendor` wraps one UPDATE in a tx), `template.service.js:79-147,150-228` (tx spans sequential validation reads + one write)
- **Why wrong:** Unnecessary lock/connection hold time and round-trip overhead for single-statement writes; wider contention windows in template create/update.
- **Impact:** Extra overhead at scale for no atomicity benefit.
- **Fix:** Drop the tx for single-statement writes; do validation reads first and wrap only the final write.

### NOD-27 — LOW — EFFICIENCY — `parseInt(...) || 0` fallbacks mask malformed input
- **file:line:** `sales.service.js:37` (`parseInt(last.saleNumber.replace(/\D/g,''),10) || 0`), `trip.service.js:91` (`Number(row.buyingSum) || 0`), `rental-agreement.service.js:196` (`rentalDays || DEFAULT_RENTAL_DAYS`)
- **Why wrong:** `||` conflates a legitimate 0 (a zero balance, zero rental days edge) with a missing/failed parse; the codebase brief explicitly forbids `||` quantity defaults for this reason.
- **Impact:** Silent wrong defaults on money/stock-adjacent paths; harder to detect data corruption.
- **Fix:** Use `??` / explicit null checks and validate parse success.

### NOD-28 — LOW — EFFICIENCY — Stale test scaffolding: suites mount routers on a local `testApp` under wrong assumptions
- **file:line:** `tests/sales/sales.test.js`, `tests/expenses/expenses.test.js`, `tests/rentals/rentals.test.js`, `tests/reports/reports.test.js` (comments claim routes are "intentionally NOT mounted in app.js (another owner integrates them)") — but `app.js:77-83` mounts all of them
- **Why wrong:** Integration tests bypass the real app wiring and assert on a hand-built app, drifting from production behavior.
- **Impact:** Tests can pass while the real wiring path is broken; misleading coverage signals.
- **Fix:** Mount the real `app` in integration suites (or update the comments), and delete superseded test scaffolding.

### NOD-29 — LOW — EFFICIENCY — Stale documentation
- **file:line:** `TESTING.md`, `TEST_ANALYSIS.md`, `TEST_EXECUTION_REPORT.md`, `tests/CHECKLIST.md` describe an older contract/only auth-users-roles-permissions; `jest.config.js` now picks up 34 suites
- **Why wrong:** Docs claim an outdated suite inventory (119/119 of a smaller set) and give wrong wiring assumptions (NOD-28).
- **Impact:** Misleads onboarding and CI expectations.
- **Fix:** Refresh docs or flag as archived.

---

## (a) Category verdicts — see table at top. Overall: **BLOCK**

## (b) Top-10 SPEED/EFFICIENCY quick-wins (ranked by effort vs impact)

1. **Add response compression** (`app.use(compression())`) — trivial effort, immediate bandwidth/latency win on the oversized list/report payloads (NOD-12).
2. **Kill the count-includes** — replace `include units (attributes:['id']) → .length` with one `COUNT ... GROUP BY` (NOD-4) — small effort, large payload/query win on intake screens.
3. **Drop `receiptImage` from `listTrips`** and sum buying prices only for the page (NOD-5) — small effort, removes multi-MB payloads.
4. **Pagination on the hot list endpoints** (sales, stocks, units, trips, rentals) with `findAndCountAll` + `separate` children (NOD-2) — medium effort, foundational.
5. **Cache `app_settings` + picklists in-process** (NOD-13) — small effort; removes ~12 queries per barcode request.
6. **Push report aggregation into SQL** and push period filters into reversal/return queries (NOD-3) — medium effort, converts O(all-data) dashboard/report calls to set-based aggregates.
7. **Trim auth hot-path to one query** (session liveness) + short-TTL permission cache (NOD-7) — medium effort, multiplies throughput for all traffic.
8. **Batch-resolve sale/rental units** in one `findAll` and `bulkCreate` lines; skip the discarded `transitionUnit` DTO (NOD-1 + NOD-9) — higher effort, fixes the barcode-scan→line and checkout latency budgets.
9. **Move post-commit re-fetches out of try/catch** and reuse in-memory rows (NOD-11) — trivial effort, removes spurious-500 + one query per write.
10. **Offload barcode/PDF rendering off the event loop** and don't hold the tx across the render (NOD-6) — higher effort, removes a seconds-long starvation vector.

## (c) `npm audit` results (backend/)

Run against a lockfile generated in a temp dir from the committed `backend/package.json` (the tree has no committed lockfile / `node_modules`), registry-fresh, 2026-09-08.

| Scope | Critical | High | Moderate | Low | Notes |
|---|---|---|---|---|---|
| `npm audit` (all) | 0 | 0 | **2** | 0 | `uuid` <11.1.1 (via `sequelize`) — GHSA-w5hq-g745-h8pq "missing buffer bounds check in v3/v5/v6 when buf is provided" (CWE-787, CVSS 7.5). Not exercised by any app code path (no uuid v3/v5/v6 calls); hardening only. `fixAvailable` is sequelize 3.30.0 (breaking major) — override/pin `uuid` instead. |
| `npm audit --omit=dev` | 0 | 0 | **2** | 0 | Identical — `sequelize`+`uuid` are production deps. |

Matches the prior security review exactly (0/0/2) — no new supply-chain exposure from the backend dependency set.

## (d) Test-coverage gaps (money / stock / authz)

**Suites that exist (34 executed):** auth, users, user-roles, roles, role-permissions, permissions, barcode (error-classification, idempotency, integration, service), request-keys-constraint, guards/barcode-seq, colours, sizes, damage-grades, customer-sources, customers, product-types, delivery, expenses, payment-methods, receipts, rentals, sales, reports, vendors, intake (inventory-v2, stocks, templates, trips, units), units-transition, plus `src/modules/units/__tests__/transitionUnit.test.js` and `database/migrations/__tests__/seed-barcode-geometry.test.js` (**NOT executed** — see NOD-22).

**Concrete gaps:**
- **Concurrency/stock:** only the CAS race test exists and it is excluded from CI (`transitionUnit.test.js:164-219`). No HTTP-level double-sell (two cashiers, one last unit), double-return, or double-refund/cancel tests. Barcode idempotency concurrency *is* covered (`barcode.idempotency.test.js:63`).
- **Money:** no negative-amount tests (sale total, expense `amountPaise`; `z.number().nonnegative()` exists untested); no `Number.MAX_SAFE_INTEGER`/BIGINT-overflow test (`tests/intake/trips.test.js:819` passes only sub-2^53 values — it proves string serialization, not arithmetic safety); no refunds>sales (negative net) edge; no doc-number duplicate/race test (DUPLICATE-SEC-M-4); no `{}` empty-item test — the both-optional `unitUuid`/`barcode` hole (DUPLICATE-SEC-H-6) is untested.
- **Authorization negatives:** sales — no 401, no wrong-role `create` 403, no 404 unknown-sale-uuid, no duplicate cancel/refund 409; expenses — no 401 at all; reports — only the dashboard has 401/403; `getTripPnlReport`/`getStockLevelsReport`/`getMarginsReport` have zero authz tests; receipts and delivery — no 403 negatives; customers — minimal.

---

## Notes / method
- All findings verified against this worktree's actual files; line numbers were confirmed by direct reads for every Critical/High and most Medium items.
- READ-ONLY: no files modified, staged, or committed; no server started; no `jest` run; only `npm audit` and static reads/greps used.
- DB-side hazards (indexing, `explain analyze`, lock tuning) intentionally left at a high-level note for the postgres specialist, consistent with the task scope; the focus here is Node-side query composition.