## Epic 12: Owner Dashboard

The owner can open one dashboard, see all three rental money buckets kept visibly apart, and get an answer, with drill-down, to every one of the 27 dashboard questions in `dashboard-questions.md`. This epic is the final epic in the build, shipping after Epic 11's deployment work — **re-sequenced here, and moved to this position, by Raviraj's own decision (this run):** the dashboard should be designed once the shop has actually been run and he knows what is worth showing on it, not designed speculatively alongside the rest of the build. It was previously the second half of an "Expenses & Owner Dashboard" epic; **Epic 9** now covers expenses alone, and this epic inherits everything dashboard-related that epic used to carry — the six read-side views, the AD-15 index set, the reports module pattern, the dashboard shell, and the question-group stories. When this move first happened, those stories kept their original numbers (Stories 9.3–9.11, plus a new Story 9.12 added later to complete Epic 10's Story 10.3 split) rather than being renumbered into this epic's own sequence, per that run's own instruction that a story which moves keeps its number, for traceability back to the old "Expenses & Owner Dashboard" epic.

**Renumbered by this pass:** that traceability decision aged badly — this epic reads as though it still belongs to Epic 9, and a build command naming "Story 9.7" gives no clue which epic it's actually in. This pass renumbers all ten inherited/added stories to **12.1–12.10**, in their existing order, with no other change to their content. The mapping, kept here so the history isn't lost:

| Old number | New number |
| --- | --- |
| 9.3 | 12.1 |
| 9.4 | 12.2 |
| 9.5 | 12.3 |
| 9.6 | 12.4 |
| 9.7 | 12.5 |
| 9.8 | 12.6 |
| 9.9 | 12.7 |
| 9.10 | 12.8 |
| 9.11 | 12.9 |
| 9.12 | 12.10 |

Every cross-reference to these stories elsewhere in this document, in `epics.md`, and in every other epic file that cited one of them by number, has been updated to the new number as part of this same pass.

**Five of the 27 questions are not here, and must not be rebuilt here.** `dashboard-questions.md` includes five questions that are operational rather than analytical — a staff member needs an answer to run the shop day to day, not once a month reviewing figures — and the architecture already established all five as plain reads over live tables, entirely independent of this epic's six views. Deferring all 27 to this final epic would have left Raviraj unable to run the business between now and whenever this epic ships, so this run moved those five out, each to the epic that already owns the table it reads, at no infrastructure cost:

| Question | Delivered by | Reads directly |
| --- | --- | --- |
| Q15 — what is in the workshop | Epic 4, Story 4.5 | `units`, `unit_status_events`, `expenses` |
| Q22 — what is booked but not yet collected | Epic 7, Story 7.6 | `rental_bookings` |
| Q11 — what is out on rent right now | Epic 8, Story 8.6 | `rental_agreements` |
| Q12 — overdue and what it has eaten | Epic 8, Story 8.4 (shipped before this run; unchanged) | `rental_agreements` |
| Q26 — deposit-exhausted, needs a decision | Epic 8, Story 8.4 (shipped before this run; unchanged) | `rental_agreements` |

This epic's own Story 12.7 (Rental) wires all five into the dashboard's card registry — pointing each card at the pre-existing route its delivering epic already ships — but ships no `.question.js` file, no migration, and no route for any of the five. A reviewer who finds one has found a duplicate this epic's own scope forbids. See Story 12.7's own acceptance criteria for the five routes' exact paths, and see Epic 4's, Epic 7's, and Epic 8's own implementation notes for why each question sits where it does.

**This epic's own migration numbering now follows the Requirements Inventory's binding order exactly — a discrepancy the pre-re-sequencing build carried is resolved by this move, not merely re-explained.** Before this run, the old "Expenses & Owner Dashboard" epic's views/indexes/preferences migrations (slots 22–24) shipped *before* Epic 10's `customer_erasure_audit` (slot 25), even though the Requirements Inventory's own prose lists `customer erasure audit → report views → report indexes → user preferences`, in that order — a mismatch each epic's implementation notes had to explain away as "the prose describes dependency order, not a literal reservation of migration numbers." With the dashboard moved to the very end of the build, Epic 10 now genuinely ships before this epic, so the actual build order finally matches the Requirements Inventory's prose without needing that caveat. The three migrations this epic ships are, in order: **slot 23** creates the six AD-13 views (Story 12.1, following directly on Epic 10's Story 10.1 at slot 22); **slot 24** adds the AD-15 index set (Story 12.2); **slot 25** creates `user_preferences` (Story 12.4) — matching `ARCHITECTURE-SPINE.md`'s AD-37 text exactly, rather than the "one slot later than AD-37 names" caveat the pre-re-sequencing build required.

**This epic also takes `user_preferences` and AD-37's pinned-card persistence in full**, inherited unchanged as part of Story 12.4 (the dashboard shell), which this epic ships as its own story rather than splitting the table from the shell that reads and writes it.

**This epic ships against an already-deployed shop, deliberately.** Epic 11 (deployment) now precedes this epic rather than closing the build, per this run's re-sequencing — the shop is live, taking sales and rentals, before the dashboard exists. Epic 11's Story 11.9 (proving AD-16's no-scheduler rule) runs its guard test against the codebase as it stood at the end of Epic 11 and notes explicitly that the same repo-wide guard runs again, unchanged, against every later commit including this epic's; no story in this epic needs to add a second AD-16 guard, only to note, once, that this epic's own views and question files pass the one Epic 11 already wrote.

**One dependency this epic inherits rather than resolves:** Epic 1's frontend-foundation story (login, not yet written as of this run) will call `/auth/login` and expect AD-37's `preferences` field in the response envelope, per Story 12.4's own acceptance criteria below. Because `user_preferences` does not exist until this epic (slot 25, the very end of the build), that field is simply absent from every login response until this epic ships — Epic 1's own implementation notes now carry this as a flag for whoever writes that story next, and nothing in this epic resolves it; Story 12.4 below is unchanged from how it originally read against the old epic ordering, since defaulting to `{}` when no row exists was already its stated behaviour and continues to be exactly correct for the entire span between Epic 1 shipping and this epic shipping, not only for a user who has never customised anything.

**Story 10.3, split by this run:** Epic 10's Story 10.3 originally set out to prove that no historical *or* reporting read joins live to `customers`, auditing both in one story. The reporting half — the six views this epic builds and the 22 dashboard questions this epic answers directly (the 27 minus the five above) — could not be verified in Epic 10, because none of it existed yet. This epic's own **Story 12.10** is that reporting half, split out rather than left as an unstated gap; Epic 10's Story 10.3 now covers only the historical half, which was fully verifiable when Epic 10 shipped, and its own implementation notes say so.

No story in this epic's inherited batch one (Stories 12.1–12.3) answers a dashboard question. That was deliberate, not an omission, in the epic this content was written for and remains so here: every dashboard-owned question reads through the six views batch one creates (AD-12, AD-13), so building the views before any question existed meant batch two would never touch a live table directly and never have occasion to get netting wrong.

**A pre-existing brownfield permission is knowingly left alone**, exactly as Epic 9's own note states for `EXPENSES.UPDATE` — this epic introduces no comparable dormant permission of its own; `PERMISSIONS.REPORTS.VIEW` is pre-existing throughout, per `ARCHITECTURE-SPINE.md`'s role matrix.

### Story 12.1: The six read-side views — one migration, all the netting the dashboard will ever need

As a developer,
I want every dashboard question to read money and event figures from one of six plain views that already net out reversals and already carry a pre-computed shop-day column,
So that batch two can write 27 questions without any one of them re-deriving the netting rule or the timezone reduction, and without a single one of them getting it wrong (FR21/CAP-22, AD-6, AD-12, AD-13, AD-14, AD-33, AD-34).

**Acceptance Criteria:**

**Given** migration `22-create-customer-erasure-audit` has already run (Story 10.1, Epic 10)
**When** migration `23-create-report-views` runs
**Then** it creates exactly six views — `v_net_sale_lines`, `v_net_expenses`, `v_rental_income`, `v_deposits_held`, `v_rent_held`, `v_unit_status_events` — and nothing else; every `CREATE VIEW`, never `CREATE MATERIALIZED VIEW` (AD-12's own prohibition, checkable by `grep -ri "materialized" backend/database/migrations/23-create-report-views.js` returning nothing)
**And** an automated test asserts exactly those six view names exist in `information_schema.views` and that `information_schema.matviews` is empty for this schema, so a reviewer does not have to re-read the migration file to confirm AD-12 held

**Given** `sale_lines.transacted_price_paise` and `sale_lines.buying_price_paise` are already signed at the base-table level — Story 5.4 named both as AD-2's closed exemption precisely because a reversing line (Epic 6) writes them **negative directly**, not because a downstream view sign-flips them
**When** `v_net_sale_lines` is defined
**Then** it is a plain `SELECT` over `sale_lines sl JOIN sales s ON s.id = sl.sale_id WHERE sl.deleted_at IS NULL AND s.deleted_at IS NULL`, carrying `sl.transacted_price_paise AS net_price_paise` and `sl.buying_price_paise AS net_buying_paise` **unchanged** — no `CASE`, no sign flip, no `ABS()` — because the base table already carries the correct sign on every row, reversing and original alike, and `SUM(net_price_paise)` over both a sale line and its later reversal already nets to zero by construction (AD-13's "reversed originals still present so they cancel")
**And** it carries `sl.unit_id`, `s.customer_id`, `s.sold_by_user_id`, and `(s.sold_at AT TIME ZONE 'Asia/Kolkata')::date AS shop_day` (AD-14) — this is the one view in the six where "netted" means "already signed on the row," a contrast worth stating explicitly because `v_net_expenses` below nets the opposite way, and a builder who assumes all six views net identically will get one of them wrong

**Given** `expenses.amount_paise` carries `CHECK (amount_paise >= 0)` with no exemption (Story 9.1) — a reversing expense row is **not** negative, unlike a reversing sale line
**When** `v_net_expenses` is defined
**Then** netting cannot be "sum the signed rows" — it is instead "exclude both members of a reversed pair entirely," so the view reads: `SELECT e.* , e.incurred_on AS shop_day FROM expenses e WHERE e.deleted_at IS NULL AND e.reverses_expense_id IS NULL AND NOT EXISTS (SELECT 1 FROM expenses r WHERE r.reverses_expense_id = e.id AND r.deleted_at IS NULL)` — the `reverses_expense_id IS NULL` clause drops every reversing row itself, and the `NOT EXISTS` clause drops every row that some other row has reversed, so a corrected expense contributes **zero rows**, not two rows that sum to zero
**And** this is stated as its own acceptance criterion, not folded into a general "views net reversals" line, because it is the one place in this build where two structurally different netting techniques sit one AD apart and a builder who copies `v_net_sale_lines`'s sign-based approach onto `v_net_expenses` produces a view that compiles, returns plausible-looking rows, and silently double-counts every corrected expense — the DB `CHECK` would not catch it, since neither row it selects violates `amount_paise >= 0`
**And** it carries `e.unit_id` (nullable) for Q13/Q23's per-unit ledger and `e.category` for the expense-category breakdown questions

**Given** AD-33's three anchors for rent — `returned_at` (settled), `cancelled_at` (cancelled), `written_off_at` (written off) — two of which live on `rental_agreements` and one of which lives on `rental_bookings` alone, since a cancelled booking never produces an agreement row (AD-27)
**When** `v_rental_income` is defined
**Then** it is a three-legged `UNION ALL`, one leg per terminal state, **never an outer join** — an outer join would require one FROM-table to carry every anchor, and no such table exists, which is exactly why the three legs are named as legs and not conditions in a single query:

  ```sql
  CREATE VIEW v_rental_income AS
  -- Leg 1: settled (returned clean, or returned and settled with damage/overdue)
  SELECT ra.uuid AS agreement_uuid, rb.unit_id, rb.customer_id, k.kind, k.amount_paise,
         (ra.returned_at AT TIME ZONE 'Asia/Kolkata')::date AS shop_day
    FROM rental_agreements ra
    JOIN rental_bookings rb ON rb.id = ra.booking_id
    CROSS JOIN LATERAL (VALUES
      ('rent', rb.rent_charged_paise),
      ('overdue', ra.overdue_charged_paise),
      ('damage', ra.damage_charged_paise)
    ) AS k(kind, amount_paise)
   WHERE ra.returned_at IS NOT NULL AND ra.deleted_at IS NULL AND rb.deleted_at IS NULL
     AND (k.kind = 'rent' OR k.amount_paise > 0)

  UNION ALL
  -- Leg 2: cancelled before hand-over (rent forfeited; deposit is not this view's concern)
  SELECT NULL, rb.unit_id, rb.customer_id, 'rent', rb.rent_charged_paise,
         (rb.cancelled_at AT TIME ZONE 'Asia/Kolkata')::date
    FROM rental_bookings rb
   WHERE rb.state = 'CANCELLED' AND rb.deleted_at IS NULL

  UNION ALL
  -- Leg 3: written off (rent + the whole deposit, one anchor for both, AD-34)
  SELECT ra.uuid, rb.unit_id, rb.customer_id, k.kind, k.amount_paise,
         (ra.written_off_at AT TIME ZONE 'Asia/Kolkata')::date
    FROM rental_agreements ra
    JOIN rental_bookings rb ON rb.id = ra.booking_id
    CROSS JOIN LATERAL (VALUES
      ('rent', rb.rent_charged_paise),
      ('forfeited_deposit', rb.deposit_paise)
    ) AS k(kind, amount_paise)
   WHERE ra.written_off_at IS NOT NULL AND ra.deleted_at IS NULL AND rb.deleted_at IS NULL;
  ```

**And** Leg 1's `overdue`/`damage` rows are filtered to `amount_paise > 0` so a clean return with nothing deducted emits only its `rent` row, never zero-amount `overdue`/`damage` rows a drill-down would have to explain; `rent` is unconditional because every settled agreement recognises rent regardless of condition
**And** Leg 1 emits **no** `forfeited_deposit` kind — a settled agreement always has `deposit_returned_paise` computed and the deposit already left `v_deposits_held` as returned cash, not as income
**And** Leg 3 emits **no** separate `overdue` row — this is the exact mistake `dashboard-questions.md`'s binding rules name as "the likeliest mistake on this path": the overdue is what consumed the deposit, and the whole deposit is already recognised as `forfeited_deposit`, so a third row would count the same rupees twice; `ra.overdue_charged_paise` is left `NULL` on a written-off agreement by Story 8.2, and Leg 3 does not reference that column at all, structurally rather than by a filter that could be forgotten
**And** Leg 3's `forfeited_deposit` amount is `rb.deposit_paise` — **`rental_bookings`' own column, never `ra.deposit_paise`** — because AD-13's "one deposit liability source" rule holds for recognition exactly as it holds for the held figure: `rb.deposit_paise` is the same column `v_deposits_held` reads for this row while it was still `HANDED_OVER`, so the liability that leaves `v_deposits_held` and the income that lands in `v_rental_income` are provably the same number; `ra.deposit_paise` is settlement-arithmetic only (AD-13) and reading it here would be a second, independently-wrong source for the same figure
**And** Leg 2 carries no `kind = 'forfeited_deposit'` or `kind = 'damage'` row — a cancelled booking's deposit is returned in full as cash, never income, and no damage can be assessed on a piece that was never handed over

**Given** the domain model's "two rows, never one netted figure" rule for a damage charge and the `RENTAL_UPKEEP` expense it funds
**When** `v_rental_income`'s `damage` kind and `v_net_expenses`' `RENTAL_UPKEEP` category are both read against the same `unit_id`
**Then** neither view references the other, and no view in this migration nets one against the other — Q13's per-unit ledger (batch two) is the one place both are read together, and it reads two views, never a join that cancels them into one line

**Given** AD-13's literal SQL for the two held buckets, sourced from `rental_bookings` alone
**When** `v_deposits_held` and `v_rent_held` are defined
**Then** both are `SELECT rb.id, rb.uuid, rb.unit_id, rb.customer_id, rb.deposit_paise, rb.id AS booking_id FROM rental_bookings rb WHERE rb.state IN ('OPEN','HANDED_OVER') AND rb.deleted_at IS NULL` and the identical query over `rb.rent_charged_paise` respectively — same source table, same predicate, different money column, deliberately (AD-13: "so the two move together and a builder cannot get one right and the other wrong") — and **neither ever joins to `rental_agreements`**, since every `HANDED_OVER` booking already has an open agreement and a join would double-count the entire rented floor

**Given** AD-13's rule that `v_unit_status_events` carries signed `shrinkage_paise` and a boolean `is_recovery`, and Epic 4's own note that a `LOST → RETIRED` recovery — one row, `cause = 'RECOVERY'` — must net to **zero**, not to a full positive recovery credit
**When** `v_unit_status_events` is defined
**Then** `shrinkage_paise` is **additive over two independent legs**, not a single mutually-exclusive `CASE`, because a `LOST → RETIRED` recovery row satisfies both legs' conditions at once and must net them against each other rather than picking one:

  ```sql
  CREATE VIEW v_unit_status_events AS
  SELECT use.id, use.uuid, use.unit_id, use.from_status, use.to_status, use.cause, use.reason, use.actor_user_id,
         (CASE WHEN use.cause = 'RECOVERY' THEN u.buying_price_paise ELSE 0 END)
       + (CASE WHEN use.to_status IN ('DAMAGED','LOST','RETIRED') THEN -u.buying_price_paise ELSE 0 END)
         AS shrinkage_paise,
         (use.cause = 'RECOVERY') AS is_recovery,
         (use.occurred_at AT TIME ZONE 'Asia/Kolkata')::date AS shop_day
    FROM unit_status_events use
    JOIN units u ON u.id = use.unit_id
   WHERE use.deleted_at IS NULL;
  ```

**And** the two `CASE` legs are read as: the first credits `+buying_price_paise` whenever the row is a recovery, regardless of destination; the second charges `-buying_price_paise` whenever the destination is a loss status, regardless of cause — a `LOST → IN_STOCK` or `LOST → IN_MAINTENANCE` recovery hits only the first leg (`+bp`, correct, the piece is back on the books); an ordinary `STAFF_MARKED_LOST`/`STAFF_MARKED_DAMAGED`/`BEYOND_REPAIR` transition hits only the second leg (`-bp`, correct, standard shrinkage); a `LOST → RETIRED` recovery hits **both** legs (`+bp` and `-bp`, netting to `0`), which is Epic 4's own stated requirement stated here as the concrete formula that satisfies it, rather than as a special case Q10's `SUM(shrinkage_paise)` has to know about — Q10 needs no awareness of this row at all, because the row's own signed value is already zero
**And** `is_recovery` is `true` on that same `LOST → RETIRED` row even though its `shrinkage_paise` is `0` — Q27 (batch two, "recoveries as their own line") reads `is_recovery`, not the sign of `shrinkage_paise`, precisely so a net-zero recovery still shows as its own visible line rather than disappearing from a report that filters on nonzero shrinkage
**And** `u.buying_price_paise` is read live via the join rather than snapshotted onto the event row, which is safe because AD-5 freezes that column the instant a unit first leaves `IN_STOCK` — every unit this view joins to has already left `IN_STOCK` by the time any status event exists for it, so the value the join reads today is provably the same value the transition saw when it happened

**Given** this migration's `down()`
**When** it runs (local development only, per AD-20 — never against a hosted database)
**Then** it drops the six views in reverse dependency order, none of which depend on each other, so any order is in fact safe, stated only because a reviewer would otherwise look for one

### Story 12.2: The AD-15 index set — one migration, exactly the fixed list, nothing accreted

As a developer,
I want every index AD-15 names created in one migration, and nothing else added ad hoc as questions get written,
So that the dashboard runs in milliseconds at one shop's scale without a single index arriving unreviewed alongside a batch-two question file (FR21/CAP-22, AD-14, AD-15).

**Acceptance Criteria:**

**Given** migration `23-create-report-views` has already run (Story 12.1)
**When** migration `24-create-report-indexes` runs
**Then** it creates every index AD-15's table names that does not already exist, and creates **nothing** AD-15 does not name — an automated test enumerates AD-15's table (as a fixed, hard-coded list in the test file) and asserts the live schema carries exactly those indexes, so a later PR that adds a per-question index without amending AD-15 first fails this test rather than silently accreting, exactly the failure mode AD-15's own rule exists to prevent

**Given** five entries in AD-15's table are already satisfied by earlier epics and need no DDL here
**When** this migration is reviewed against AD-15's "exactly" claim
**Then** it adds no new statement for: the GiST index AD-7's `EXCLUDE USING gist` constraint already created on `rental_bookings` (Story 7.1); the unique index on `request_keys(gesture_type, request_uuid)` AD-22 already created (Story 1.4); the unique index on `units(barcode)` already created as a column-level `UNIQUE` constraint when `units` was created (Story 3.3); and the indexes on `rental_bookings(group_uuid)` and `rental_agreements(group_uuid)`, both already created alongside their tables (Stories 7.1 and 7.4, each stating "indexed" in the same breath as the column itself) — this migration's own header comment names these five explicitly as "already satisfied, no DDL," so a reviewer checking this migration against AD-15's table line by line does not have to go spelunking through five other epics' files to confirm nothing is missing

**Given** the five expression indexes AD-15 names for the range questions
**When** this migration runs
**Then** it creates `CREATE INDEX ON sales ((sold_at AT TIME ZONE 'Asia/Kolkata')::date)`, and the identical form over `rental_agreements.returned_at`, `rental_agreements.written_off_at`, `rental_bookings.cancelled_at`, and `unit_status_events.occurred_at` — five expression indexes, exactly AD-14's five `TIMESTAMPTZ` anchors, no more and no fewer; `rental_bookings.created_at` is **not** among them, named here as a negative to check against, per AD-14's own explicit statement that it stopped being an anchor under AD-33 and a builder who finds it indexed anywhere in this build has found a regression

**Given** the two plain-`DATE` anchors that need no timezone conversion
**When** this migration runs
**Then** it creates a plain b-tree index on `expenses.incurred_on` and on `stock_intakes.purchased_on` — `stock_intakes` is AD-14's one raw-table exception (no view exists for it, and none is needed), so this is the only index in this migration that serves a table Story 12.1 built no view over

**Given** the remaining entries in AD-15's table, all genuinely new
**When** this migration runs
**Then** it creates: a partial index `units(status) WHERE deleted_at IS NULL`; `units(stock_intake_line_id)`; `sale_lines(unit_id)`; `rental_agreements(unit_id)`; `expenses(unit_id)`; `sales(sold_by_user_id)`; `stock_intakes(vendor_id)`; `sales(customer_id)` — named explicitly in AD-15 because Postgres never indexes an FK column automatically; `unit_status_events(unit_id)`; `rental_bookings(state)`; and a partial index `rental_agreements(due_date) WHERE returned_at IS NULL AND written_off_at IS NULL`
**And** that last one is called out on its own: Story 8.4's Q12 (overdue) and Q26 (deposit-exhaustion) queries have been running an unindexed scan over `rental_agreements` since Epic 8 shipped — acceptable at one shop's data volume, per AD-15's own framing that the whole set exists "for correctness of plan shape, not throughput" — and this migration is what finally adds the index, closing that gap without touching a single line of Story 8.4's code; the predicate matches `agreements_one_open_unit` (Story 7.4's AD-9 index) exactly, which is why AD-15 states it that way rather than restating the two columns independently

**Given** this migration's `down()`
**When** it runs (local development only, AD-20)
**Then** it drops only the indexes this migration created — none of the five "already satisfied" entries, since this migration never created them and dropping them here would remove a constraint another epic's migration owns

### Story 12.3: The reports module pattern — hand-written SQL only, and the boundary a test enforces

As a developer,
I want the shape every one of the 27 dashboard questions must follow fixed and checked by an automated test before any of them is written,
So that batch two's 27 files are mechanically prevented from importing a Sequelize model, calling a write-side service, or shipping a `summary()` that paginates or a `lines()` that doesn't (FR21/CAP-22, NFR17, NFR18, AD-12, AD-26).

**Acceptance Criteria:**

**Given** `modules/reports/questions/` already exists by the time this epic starts, holding five files written before this epic's views existed — `q15-in-workshop.question.js` (Story 4.5, Epic 4, the actual first work in `modules/reports/` this build ever needed, per this epic's own re-sequencing under Raviraj's decision), `q22-booked-not-collected.question.js` (Story 7.6, Epic 7), `overdue.question.js` and `deposit-exhausted.question.js` (Story 8.4, Epic 8, Q12/Q26), and `q11-out-on-rent.question.js` (Story 8.6, Epic 8)
**When** this story is scoped
**Then** it adds no migration and touches none of those five existing files — each was written against live tables directly, remains correct as written (each delivering epic's own note that its question does not depend on the AD-13 views), and none is retrofitted to read through `v_deposits_held`, `v_net_expenses`, `v_unit_status_events` or any other view this epic adds, matching AD-4's and AD-10's non-retrofit stance; a later pass may re-point one or more of the five at a view for consistency with its dashboard sibling, exactly as Story 8.4 itself flagged as optional for Q26, but nothing in this story requires it and nothing in this story's own automated test fails because of it

**Given** two new shared modules, `modules/reports/pagination.js` and `modules/reports/report-query.js`
**When** either is reviewed
**Then** `pagination.js` exports one function, `paginate({ page, pageSize })`, returning `{ limit, offset, page, pageSize }` with `pageSize` defaulted to 50 and clamped to a maximum of 200 (AD-26) — the one place that default and that cap are written, so 27 question files reference this function instead of each hard-coding `50`/`200` and one eventually drifting; `report-query.js` exports `runQuery(sql, replacements)`, a thin wrapper over `sequelize.query(sql, { type: QueryTypes.SELECT, replacements })` and nothing else — no query builder, no ORM call — existing purely so every question file imports one shared entry point rather than each calling `sequelize.query` directly, which makes the boundary test below able to assert a single import site rather than pattern-matching raw SQL calls scattered across 27 files

**Given** every current and future file matching `modules/reports/questions/*.question.js`
**When** a new automated test, `tests/reports/module-boundary.test.js`, runs
**Then** it asserts, for each such file: it imports nothing from `database/models/` (no Sequelize model, per AD-12's "imports no Sequelize model") and nothing from any other module's `*.service.js` (no write-side service call, per AD-12's "calls no write-side service") — `modules/reports/pagination.js` and `modules/reports/report-query.js` are the only intra-repo imports permitted beyond the file's own SQL string; it exports both a `summary` function and a `lines` function, neither `undefined`; and every `CREATE MATERIALIZED VIEW` string does not appear anywhere under `backend/database/migrations/` — restated here even though Story 12.1's own test already covers it, because this test is the one batch two's contributors are most likely to run first, and finding the prohibition in two places costs nothing
**And** this test runs today, against all five of Stories 4.5, 7.6, 8.4 and 8.6's existing files, and passes — proving the pattern it enforces was already true before this story existed, not a new rule the existing files happen to violate

**Given** AD-26's envelope shape
**When** the boundary test inspects a `lines` export
**Then** it does not — and cannot — verify the function's runtime return shape by static analysis alone, so this AC states the convention as a code-review checklist item rather than claiming the test enforces it mechanically: every `lines({ from, to, ...groupKey, page, pageSize })` must call `pagination.js`'s `paginate()` and return `{ items, page, pageSize, total }`; every `summary({ from, to })` accepts no `page`/`pageSize` and returns a bare figure object, never wrapped in the envelope — a total is one row, and AD-26 says so explicitly
**And** batch two's first question file is the first place this convention is exercised end-to-end; this story ships no question and therefore proves the shape only against the five pre-existing files above, which predate the envelope's own shared helper and are not required to adopt it (the non-retrofit note above)

**Given** this story's scope
**When** it is reviewed against CAP-22 and the 27 questions
**Then** nothing here answers a single one of them — no `q1.js` through `q27.js` exists after this story, no route under `/api/reports/` beyond the ten the five pre-existing files already expose (two each) is added, and no permission constant is introduced; this story's entire deliverable is the shared scaffolding and the test that keeps batch two honest against it, which is why it is written last in this batch, after the views and indexes it assumes already exist

### Story 12.4: The dashboard shell — three money buckets, one date-range control, preferences that survive a reload

As the owner,
I want the dashboard to open with my pinned cards already in place, the three rental money buckets kept visibly apart, and one date-range control that governs every range-scoped card on the page,
So that reading the shop's numbers is a five-minute settled routine rather than something I re-configure every time I open the screen or switch device (FR21/CAP-22, AD-2, AD-5, AD-14, AD-26, AD-33, AD-37; UX-DR5, UX-DR11, UX-DR12, UX-DR16).

**Acceptance Criteria:**

**Given** migration `24-create-report-indexes` has already run (Story 12.2)
**When** migration `25-create-user-preferences` runs
**Then** it creates `user_preferences` exactly to AD-37's shape: `user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE` — no separate `uuid` column, AD-1's one deliberate departure, because this row is never listed or looked up by its own key, only ever reached as "the signed-in user's row"; `preferences JSONB NOT NULL DEFAULT '{}'`; `deleted_at TIMESTAMPTZ NULL` (AD-4's uniformity, though nothing plausibly re-creates this row for the same user); `created_at`/`updated_at`
**And** this is slot **25**, the next open slot after Story 12.2's 24 — matching `ARCHITECTURE-SPINE.md`'s AD-37 text exactly now that this epic's re-sequencing (Raviraj, this run) has put it directly after the report indexes with nothing else intervening, per this epic's own intro note above, which this AC does not repeat in full
**And** the model is registered `paranoid: true`, tier **mutable master data** (AD-5) — ordinary `UPDATE`, no correction-as-reversing-row rule, because a preference is convenience UI state, not a business record
**And** no row is created at signup — the table starts empty and stays empty for any user who never customises anything

**Given** a new module, `modules/preferences/` (`preferences.routes.js`, `.controller.js`, `.service.js`), separate from `modules/reports/` because a per-user UI setting is not a dashboard query
**When** `PUT /api/preferences` is called with `{ preferences: {...} }` — an arbitrary JSON object, unvalidated server-side by design (AD-37: "the client owns the schema of its own preferences")
**Then** the service resolves the caller to their own `users.id` from `req.auth.userUuid` — **never** accepting a user id from the body or params, so a cashier can no more write another user's preferences than read them — and performs `INSERT INTO user_preferences (user_id, preferences) VALUES (:id, :prefs) ON CONFLICT (user_id) DO UPDATE SET preferences = :prefs, updated_at = now()`, a full replace of the document, not a merge
**And** this route requires only `authenticate` — no new permission constant, per AD-37's own statement that setting your own pinned cards or date range "carries no authority question," unlike every `RENTALS.*` verb AD-29 gates
**And** `PUT /api/preferences` is **not** added to AD-22's enumerated gesture set and carries no `requestUuid` — a network retry safely re-sends the identical document to the identical upsert with no risk of duplication, unlike a counter gesture that inserts a new ledger row each time; a reviewer checking this route against `gesture-type.js`'s fixed list will correctly find nothing added there

**Given** `auth.controller.js`'s two existing handlers, `login` and `getCurrentUser` (the `/auth/me` route a page reload or tab reattach actually calls with an existing access token) — both written by Epic 1's frontend-foundation story, which shipped long before this epic and, per that epic's own implementation notes (this run's flag), returns no `preferences` field at all until this epic's migration exists
**When** either responds, from this epic onward
**Then** both gain a `preferences` field in their `data` envelope, sourced from the same accessor reading `user_preferences` for the authenticated user, defaulting to `{}` when no row exists — **both**, not `login` alone: an automated test calls `/auth/me` with a token from a session that never touched `/auth/login` in this test run and asserts `data.preferences` is present, specifically to catch the bug this story exists to prevent — wiring preferences into `login` only would leave every reload silently reset to default, because the client calls `/auth/me` on every page refresh and `login` runs exactly once per session
**And** a second test sets a preference via `PUT /api/preferences`, then calls `GET /auth/me` with a fresh request (simulating a reload) and asserts the same document comes back — proving the round trip through the actual reload path, not just through `login`

**Given** `{components.dashboard-card}` and `{components.drill-sheet}` as the two shared primitives every card in this epic is built from (`EXPERIENCE.md`)
**When** this story ships the frontend shell
**Then** it creates `frontend/src/modules/dashboard/` holding `DashboardCard.jsx` (one figure, a drill affordance, pinned/unpinned state, and — when the card's descriptor says so — a fixed "right now" label in place of range-subscription, per UX-DR11's "point-in-time cards explicitly labelled as such"), `DrillSheet.jsx` (bottom sheet on phone, side panel from `tablet`, always paged through `platform/envelope.js`, header restating the summary figure it opened from, per `EXPERIENCE.md`'s Drill sheet row), and `cardRegistry.js`
**And** `cardRegistry.js` discovers cards via `import.meta.glob('./cards/*.card.js', { eager: true })` rather than a hand-maintained list — every later story in this batch adds question cards by dropping a new file matching that glob, never by editing this file, so no two stories in this batch ever touch the same shared source file and a merge conflict between them is structurally impossible
**And** each `*.card.js` file exports `{ id, questionNumber, title, group, pointInTime, SummaryCard, DrillBody }`, where `group` is one of exactly five string values matching `dashboard-questions.md`'s own section titles verbatim (`'Takings and profit'`, `'Inventory'`, `'Rental'`, `'Vendor and lot'`, `'Floor behaviour'`) — an automated test enumerates those five and asserts every discovered card's `group` is one of them, so a typo'd group string fails the test rather than silently forming a sixth, unlabelled section
**And** this story ships **zero** files under `cards/` — the registry is real and functions, but empty, because no question exists yet; this is not a future-dependency violation, because nothing in this story calls into a card that does not yet exist — the *Add cards* library screen and the pinned-card grid both render correctly against zero entries (an empty-state message, not an error), and Stories 12.5–12.9 populate the glob purely by adding files, never by editing anything this story wrote

**Given** UX-DR5's money-bucket row — three `{components.dashboard-card}` instances, EARNED / DEPOSITS HELD / RENT HELD, laid out side by side on `tablet`+ and stacked on phone, with no combined figure ever rendered across them (AD-33)
**When** this story ships `MoneyBucketRow.jsx`
**Then** it renders exactly three fixed, non-pinnable, non-reorderable card slots — always present on the dashboard regardless of the pinned-card set — reading their data from three fixed registry ids, `'q1-rental-earned'`, `'q6'`, `'q25'`, via the same `DashboardCard` component every pinned card uses
**And** because none of those three ids exist in the registry until Story 12.5 ships them, this story's `MoneyBucketRow` renders each slot's defined empty state (title and group label visible, figure showing a loading skeleton that never resolves) rather than throwing — deferring the real wiring to Story 12.5 explicitly, the same way Story 12.4 defers question cards generally, and for the identical reason: no story in this batch may depend on a question a later story ships
**And** an automated component test asserts `MoneyBucketRow` renders exactly three `DashboardCard` nodes and **no** fourth node anywhere in its subtree that displays a number — not a visual check, a DOM assertion, so a future edit that adds a "combined rental total" convenience figure fails this test immediately rather than shipping unnoticed. This is the concrete, checkable form of "there is structurally nowhere for a fourth figure to be computed" (`EXPERIENCE.md`)

**Given** UX-DR12's date-range control — presets *Today* / *This week* / *This month* / *Custom*, default *Today*, one control governing every range card on the page
**When** this story ships `DateRangeControl.jsx` and its backend counterpart
**Then** the control holds one piece of state, a `{ preset, from, to }` value (`from`/`to` populated only when `preset === 'CUSTOM'`), defaulting to `{ preset: 'TODAY' }` on first load and overridden by `preferences.defaultDateRange` when that key is present in the document `/auth/me` returned — every range-scoped `DashboardCard` on the page reads this **one** piece of state via context, never fetching its own copy of it, so switching the preset re-triggers every range card's fetch and no card can drift onto a different range than the one showing in the control
**And** the server, not the browser clock, resolves *Today*/*This week*/*This month* into concrete `shop_day` boundaries (NFR9: no day-boundary computation from the server's local clock or a client `Date()`) — this story adds `modules/reports/date-range.js`, exporting `resolveDateRange({ preset, from, to })`, which for `TODAY` runs `SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date AS today` and sets `from = to = today`; for `THIS_WEEK` and `THIS_MONTH` runs the equivalent `date_trunc('week', ...)`/`date_trunc('month', ...)` against the same shop-local `now()` for `from`, with `to` the shop-local today; and for `CUSTOM` validates the client-supplied `from <= to` and passes both through literally, both plain `YYYY-MM-DD` values with no time or zone component, matching the wire-date convention already fixed in the Consistency Conventions table
**And** every range-scoped question's route (built by Stories 12.5–12.9) calls this **one** helper before calling its own `summary()`/`lines()` — centralising preset resolution the same way `pagination.js` centralised the envelope default in Story 12.3, so 22 question files reference one function instead of 22 reimplementing "what is this week" and one of them eventually drifting on the ISO-week-vs-Sunday-week question
**And** a point-in-time question's route never calls `resolveDateRange` at all and accepts no `preset`/`from`/`to` query parameter — matching Story 8.4's existing Q12/Q26 routes exactly, which already take none

**Given** `PERMISSIONS.REPORTS.VIEW` — pre-existing, per `ARCHITECTURE-SPINE.md`'s role matrix already seeded to `ADMIN`, `MANAGER`, and `ACCOUNTANT`
**When** the dashboard page and every route this batch adds under `/api/reports/dashboard/*` are authorized
**Then** each requires `authenticate` and `authorize(PERMISSIONS.REPORTS.VIEW)` — no new permission constant is introduced by this story or by any question story in this batch — and the dashboard's navigation entry is absent, not disabled, for a signed-in user who does not hold it (`CASHIER` and `INVENTORY_MANAGER`, per the same matrix), per UX-DR16's permission-driven navigation rule
**And** `PUT /api/preferences` is the one route in this story's scope that requires only `authenticate`, stated again here for contrast, since a reviewer scanning this story's routes for a missing `authorize()` call should find exactly one deliberate exception, not a gap

### Story 12.5: Takings and profit — Q1, Q2, Q3, Q4, Q5, Q6, Q25

As the owner,
I want to see what the shop took in, what it spent, whether it made money, the margin on what actually sold, and — kept separate from all of that — how much deposit and rent money I'm currently holding that isn't earned yet,
So that a month's numbers reconcile the way the shop's own accounting rules say they should, not the way a naive sum would suggest (FR21/CAP-22, AD-2, AD-12, AD-13, AD-14, AD-26, AD-33; Q1–Q6, Q25).

**Acceptance Criteria:**

**Given** the shared contract every question in this batch follows (Story 12.3's module pattern, this epic's Rules)
**When** any of this story's seven questions is reviewed
**Then** each ships as `modules/reports/questions/q<n>-<slug>.question.js` exporting `summary()` and `lines()`, mounted at `GET /api/reports/dashboard/q<n>/summary` and `GET /api/reports/dashboard/q<n>/lines`, both requiring `authenticate` and `authorize(PERMISSIONS.REPORTS.VIEW)`; `lines()` accepts and honours `page`/`pageSize` through `pagination.js` and returns the `{ items, page, pageSize, total }` envelope (AD-26), `summary()` never paginates; every range-scoped question (all seven here except Q6 and Q25) takes its `{ from, to }` from Story 12.4's `resolveDateRange()`, never from a raw client timestamp; every rupee figure is returned as integer paise, formatted client-side only, through `platform/money.js`; any ratio this story returns is a `{ numerator, denominator }` pair, never pre-divided or rounded in SQL (AD-2); and every summary figure this story renders is drillable — no card in this story ships a `SummaryCard` without a matching `DrillBody`

**Given** Q1's "what did the shop take in" and AD-13's `v_net_sale_lines`/`v_rental_income`
**When** `q1-takings.question.js` runs
**Then** `summary({ from, to })` returns `{ retailPaise, rentPaise, overduePaise, damagePaise, forfeitedDepositPaise, totalPaise }`: `retailPaise` is `SUM(net_price_paise)` from `v_net_sale_lines WHERE shop_day BETWEEN :from AND :to`; the four rental figures are `SUM(amount_paise) FILTER (WHERE kind = 'rent'|'overdue'|'damage'|'forfeited_deposit')` from `v_rental_income WHERE shop_day BETWEEN :from AND :to`; `totalPaise` is the sum of all five — every rental figure already anchored to its own close event's shop day by the view (AD-14), never to booking creation, and every reversing sale line already netted by the view's sign, so a reversed sale contributes nothing here without this file doing any netting of its own
**And** `lines({ from, to, page, pageSize })` returns one row per contributing transaction — retail rows from `v_net_sale_lines` (each carrying `unit_id`, `net_price_paise`, `shop_day`) unioned with rental rows from `v_rental_income` (each carrying `unit_id`, `kind`, `amount_paise`, `shop_day`), both filtered to the same range, newest `shop_day` first, paginated as one combined, sortable list — this is the union the shell's "he taps it, the drill sheet opens... the rows add to the number he tapped" (Flow 7) describes for Q4, which is built from this same shape

**Given** Q1's total also being the source for `MoneyBucketRow`'s EARNED slot
**When** this story ships
**Then** it adds `frontend/src/modules/dashboard/cards/q1-rental-earned.card.js` with `id: 'q1-rental-earned'`, `pointInTime: false`, reading the **same** `q1` summary response and displaying `rentPaise + overduePaise + damagePaise + forfeitedDepositPaise` (never `totalPaise`, which also includes retail) — this is the file Story 12.4 named by id and deferred; adding it here, and nothing else, is what makes `MoneyBucketRow`'s EARNED slot resolve to a real figure for the first time, closing the loop Story 12.4 explicitly left open
**And** the ordinary Q1 dashboard card (`q1-takings.card.js`, a second, separate file, `group: 'Takings and profit'`) shows the full five-way split and is independently pinnable — `MoneyBucketRow`'s EARNED slot and the pinnable Q1 card are two different cards reading one shared endpoint, not the same card shown twice

**Given** Q2's "cash vs UPI" till-reconciliation figure, and its explicit statement in `dashboard-questions.md`'s own Rules that "Q1 and Q2 will not match on any given day, and that is correct"
**When** `q2-cash-till.question.js` runs
**Then** its retail component reads `v_net_sale_lines vnsl JOIN sales s ON s.id = vnsl.sale_id`, grouped by `s.payment_method`, `SUM(vnsl.net_price_paise)` — re-joining `sales` for a column the view does not itself carry is permitted, since AD-13's direct-read ban names `sale_lines`, not `sales`, and the reversal/exchange netting Q2 needs is already done by the view before this join ever runs, so no separate "cash exchange refunds" subtraction is written — the reversing and new lines an exchange writes already cancel to the true net cash difference inside `net_price_paise`, by the same construction AD-13 states for every other netted figure
**And** its rental cash-in component reads `rental_bookings.created_at`, `payment_method`, `rent_charged_paise`, `deposit_paise` **directly** — the **one** deliberate, narrow exception in this batch to reading rental money through a view, because cash for a booking moves at the moment the booking is made (AD-33: "rent and deposit are both still collected in full at booking"), no AD-13 view exposes `created_at` at all, and AD-14's rule that `created_at` "is not an anchor and must not be one" is scoped to *income recognition* — the failure that rule prevents is rent being counted as earned on the wrong day, and Q2 is expressly not an income figure ("Q1 is income; Q2 is the till"), so anchoring its cash-in figure to the day the cash physically entered the drawer is not that mistake; it is the one case that rule's own stated purpose does not cover. A reviewer who greps the codebase for `rental_bookings.created_at` and finds it used only here, nowhere else, has found this documented exception, not a regression
**And** its rental cash-out component reads `rental_agreements.deposit_returned_paise` (dated `returned_at`, a valid AD-14 anchor) and `rental_bookings.deposit_returned_paise` (dated `cancelled_at`, likewise valid) directly, netted against the booking's own `payment_method` — neither column is exposed by any AD-13 view, and reading them introduces no double-counting risk, because AD-9's one-open-agreement and terminal-freeze rules already make each row's value final and written exactly once
**And** `summary({ from, to })` returns `{ cashPaise, upiPaise }`, each the sum of retail-in, rental-in, minus deposit-returns-out, for that method, over the range; `lines()` returns one row per contributing movement (retail sale, booking created, deposit returned), each carrying its `kind`, `paymentMethod`, `amountPaise` (deposit returns as negative, everything else positive, signed for display only — never written back anywhere), and `shop_day`

**Given** Q3's "what did the shop spend" and Q4's "did the shop make money"
**When** `q3-spend.question.js` and `q4-net-position.question.js` run
**Then** Q3's `summary({ from, to })` returns `{ byCategory: [{ category, amountPaise }], stockPurchasesPaise, totalPaise }` — the category breakdown from `SUM(amount_paise) GROUP BY category` over `v_net_expenses WHERE shop_day BETWEEN :from AND :to` (already reversal-netted per Story 12.1), and `stockPurchasesPaise` from `SUM(total_paid_paise)` over `stock_intakes WHERE purchased_on BETWEEN :from AND :to` — the one raw-table read AD-14 itself names as the exception, needing no view; `lines()` unions expense rows (`v_net_expenses`) and trip rows (`stock_intakes`), paginated together, newest-first
**And** Q4 ships **no SQL of its own** — its `summary({ from, to })` calls Q1's and Q3's `summary()` internally and returns `{ takingsPaise: q1.totalPaise, spendPaise: q3.totalPaise, netPaise: q1.totalPaise - q3.totalPaise }`, and its `lines()` returns the same two unioned line sets Q1 and Q3 already build, tagged `kind: 'in' | 'out'` — reusing rather than re-deriving, the same discipline Story 12.1 required of the views themselves, so Q4 cannot silently diverge from what Q1 and Q3 already computed
**And** an automated test asserts Q4's `netPaise` for a fixed fixture equals `q1.totalPaise - q3.totalPaise` computed independently by the test, catching the one arithmetic mistake this file could plausibly make

**Given** Q5's "what did the shop actually earn on what it sold" — realised gross margin, rupees and percent
**When** `q5-realised-margin.question.js` runs
**Then** `summary({ from, to })` returns `{ marginPaise, marginRatio: { numerator, denominator } }` — `marginPaise` is `SUM(net_price_paise - net_buying_paise)` over `v_net_sale_lines WHERE shop_day BETWEEN :from AND :to`; `marginRatio` is `{ numerator: marginPaise, denominator: SUM(net_price_paise) }` over the same rows, returned **unrounded and undivided** — the client's `platform/money.js` ratio formatter (Story 5.1) turns it into a percentage at display, once, per AD-2's "rounded once at that final step and never at an intermediate one"
**And** `lines()` returns one row per sale line in range, carrying `unitId`, `netPricePaise`, `netBuyingPaise`, and the per-line margin, so the owner can see which specific pieces are dragging the percentage down, not just the aggregate

**Given** Q6 (deposits held) and Q25 (rent held) — AD-33's other two buckets, point-in-time, identical shape over the other money column
**When** `q6-deposits-held.question.js` and `q25-rent-held.question.js` run
**Then** both accept **no** `from`/`to` and never call `resolveDateRange` — a request that supplies either parameter has it silently ignored, not rejected, matching Q12/Q26's existing precedent of simply not reading such a parameter; Q6's `summary()` is `{ totalPaise: SUM(deposit_paise), bookingCount: COUNT(*) }` over `v_deposits_held` with no `WHERE` beyond the view's own; Q25's is `{ totalPaise: SUM(rent_charged_paise), bookingCount: COUNT(*) }` over `v_rent_held` — exactly `v_deposits_held`'s predicate over the other column, as AD-13 requires; both `lines()` return one row per held booking, `unitId`, `customerId`, the money column, and the booking reference, **no** `shop_day` column on either row (there is nothing to range-filter), paginated
**And** both cards' descriptors set `pointInTime: true`, and `DashboardCard.jsx` (Story 12.4) renders their fixed "right now" label instead of subscribing to `DateRangeControl`'s state — an automated test mounts both cards under a `DateRangeControl` whose preset changes and asserts neither card re-fetches, the concrete form of AD-14's "a balance is only ever now"
**And** neither figure is ever added to Q1's or Q4's total anywhere in this file or in `MoneyBucketRow` — the same structural absence Story 12.4 already tests for the row itself

### Story 12.6: Inventory — Q7, Q8, Q9, Q10, Q27

As the owner,
I want to see what's on the floor right now, what isn't moving, what sells fastest, what I'm losing to breakage and theft net of anything recovered, and what actually came back after a write-off,
So that I can act on slow stock, catch shrinkage as it happens, and see a recovered piece as the genuine event it is rather than as an invisible correction to a shrinkage number (FR21/CAP-22, AD-2, AD-13, AD-14, AD-26, AD-35; Q7–Q10, Q27).

**Acceptance Criteria:**

**Given** this story's shared contract (identical to Story 12.5's opening AC — route pattern, permission, envelope, ratio shape, drillability)
**When** any of this story's five questions is reviewed
**Then** each follows it exactly, with one shape difference: Q7 is point-in-time (no `from`/`to`); Q8, Q9, Q10, Q27 are range-scoped (Q8 by an implicit "as of now" aging window rather than a `shop_day` filter, detailed below)

**Given** Q7's "what is on the floor right now" — unit count and capital tied up, by product type and channel
**When** `q7-on-the-floor.question.js` runs
**Then** `summary()` reads `units WHERE status IN ('IN_STOCK','IN_MAINTENANCE') AND deleted_at IS NULL` (the partial index Story 12.2 added serves this predicate directly), grouped by `product_type_id` and `channel`, returning `{ byGroup: [{ productTypeId, channel, unitCount, capitalPaise }], totalUnitCount, totalCapitalPaise }` — `capitalPaise` is `SUM(buying_price_paise)`; `reserved` is not read as a status anywhere in this query, per `dashboard-questions.md`'s own note that a unit with a future booking is still on the floor — this story adds no join to `rental_bookings` to exclude one
**And** `lines()` returns one row per unit in that set, paginated, carrying `barcode`, `productTypeId`, `channel`, `buyingPricePaise`, and days since `stock_intakes.purchased_on`

**Given** Q8's "what is not moving" — aging buckets at 30/60/90 days
**When** `q8-aging.question.js` runs
**Then** `summary()` reads `units u JOIN stock_intake_lines sil ON sil.id = u.stock_intake_line_id JOIN stock_intakes si ON si.id = sil.stock_intake_id WHERE u.status = 'IN_STOCK' AND u.deleted_at IS NULL`, bucketing `(now() AT TIME ZONE 'Asia/Kolkata')::date - si.purchased_on` into `>= 30`, `>= 60`, `>= 90` days (a unit past 90 also counts toward 30 and 60 — the buckets are cumulative thresholds, not disjoint ranges, matching how "units in stock more than 30 / 60 / 90 days" reads), returning `{ over30: { count, capitalPaise }, over60: {...}, over90: {...} }`
**And** this question takes **no** `from`/`to` either, despite not being on the point-in-time list — "as of now" aging is inherently a snapshot of the current floor, not a range of transactions; this is stated explicitly because a builder skimming the point-in-time list (Q6, 7, 11, 12, 15, 22, 25, 26) and not finding Q8 on it could reasonably assume it takes a range, and it does not
**And** `lines({ page, pageSize, bucket })` accepts `bucket` (`'30'|'60'|'90'`) as its one `groupKey` and returns the matching units, paginated, each row listing lot, product type, and vendor (joined through `stock_intakes.vendor_id`, the index Story 12.2 added)

**Given** Q9's "what sells fastest" — median days from intake to sale, by product type and lot
**When** `q9-sell-through-speed.question.js` runs
**Then** `summary({ from, to })` reads `v_net_sale_lines vnsl JOIN units u ON u.id = vnsl.unit_id JOIN stock_intake_lines sil ON sil.id = u.stock_intake_line_id JOIN stock_intakes si ON si.id = sil.stock_intake_id WHERE vnsl.shop_day BETWEEN :from AND :to`, computing `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (s.sold_at::date - si.purchased_on))` grouped by `product_type_id` and separately by `stock_intake_line_id` — median in Postgres, not client-side, since the raw day-count values never need to leave the database to compute it — returning `{ byProductType: [{ productTypeId, medianDays }], byLot: [{ stockIntakeLineId, medianDays }] }`
**And** `net_price_paise` being negative on a reversing line would corrupt a "days to sell" figure that has nothing to do with price — this file filters reversing lines out explicitly (`vnsl.net_price_paise > 0` — a reversing line's negative price is exactly what marks it as one, since a genuine sale line is never `0` or negative), the one question in this batch that needs to exclude a reversal rather than let it net to zero automatically, stated here because it is the least obvious of the five

**Given** Q10's "what am I losing to breakage and theft" and Q27's "what came back after I wrote it off" — the shared `v_unit_status_events` view, read two different ways
**When** `q10-shrinkage.question.js` runs
**Then** `summary({ from, to })` is `SUM(shrinkage_paise)` and `COUNT(*)` over `v_unit_status_events WHERE shop_day BETWEEN :from AND :to` — no `WHERE` on `is_recovery` or `to_status`, because the view's signed `shrinkage_paise` already nets a `LOST → RETIRED` recovery to zero and a plain sum over every row in range is the whole answer, exactly as Story 12.1's own view contract states; `lines()` returns every row in range, paginated, carrying `unitId`, `fromStatus`, `toStatus`, `cause`, `shrinkagePaise`, `isRecovery` — a `LOST → RETIRED` recovery row appears here with `shrinkagePaise: 0`, visible rather than hidden, matching "a `LOST → RETIRED` recovery is one row doing both and nets to zero"
**And** `q27-recoveries.question.js`'s `summary({ from, to })` is `COUNT(*)` and `SUM(u.buying_price_paise)` over `v_unit_status_events use JOIN units u ON u.id = use.unit_id WHERE use.is_recovery AND use.shop_day BETWEEN :from AND :to` — **valued at `u.buying_price_paise`, never at `shrinkage_paise`**, because the same `LOST → RETIRED` row that nets to zero in Q10 is a real piece walking back through the door and must not report as ₹0 here; `lines()` returns each recovering row, paginated, carrying `unitId`, `toStatus`, `reason`, `actorUserId`, and the buying-price figure, so the owner can see who recovered each piece and why
**And** an automated test fixtures a `LOST → RETIRED` recovery and asserts Q10's summed `shrinkagePaise` for that unit is `0` while Q27's `count` includes it and its valued figure is the unit's full `buyingPricePaise` — the one behaviour this batch is most likely to get backwards, stated as its own test rather than trusted to a code review, mirroring Story 12.1's own AC5 for the view underneath it

### Story 12.7: Rental — Q13, Q14, Q23, and wiring Q11, Q12, Q15, Q22, Q26 into the card registry

As the owner,
I want to see which rental pieces earn their keep, how hard the rental stock is working, and the final return on a piece that's retired or written off — alongside, on the same dashboard, the five operational rental and workshop questions this build already answers elsewhere,
So that I can tell which rental pieces are worth re-buying and which are dead weight, without a single one of these figures double-counting money `v_rental_income` already recognised elsewhere, and without this epic rebuilding a single question it doesn't own (FR21/CAP-22, AD-2, AD-13, AD-14, AD-26, AD-33; Q13, Q14, Q23).

**Acceptance Criteria:**

**Given** Raviraj's decision (this run) to move the dashboard to the end of the build and, with it, to carry five operational questions — Q11, Q15, Q22 as new stories, Q12 and Q26 as already-shipped ones — out to the epics that can answer them without this epic's view layer
**When** this story is scoped
**Then** it ships **no** file, migration, or route for any of the five: Q11 (Epic 8's Story 8.6), Q12 (Epic 8's Story 8.4, unchanged), Q15 (Epic 4's Story 4.5), Q22 (Epic 7's Story 7.6), and Q26 (Epic 8's Story 8.4, unchanged) are all already delivered, each as its own hand-written live-table read, and **none of the five is rebuilt here** — a reviewer who finds a `q11-*.question.js`, `q15-*.question.js`, or `q22-*.question.js` file anywhere under this epic's own contribution to `modules/reports/questions/` has found a duplicate this story's own scope forbids
**And** this story's **only** contribution to any of the five is frontend: it adds `q11-out-on-rent.card.js`, `q12-overdue.card.js`, `q15-in-workshop.card.js`, `q22-booked-not-collected.card.js`, and `q26-deposit-exhausted.card.js` to the registry, each pointing its `SummaryCard`/`DrillBody` at the pre-existing route its own delivering epic already ships — `/api/reports/inventory/workshop/*` (Q15), `/api/reports/rentals/out-on-rent/*` (Q11), `/api/reports/rentals/booked-not-collected/*` (Q22), `/api/reports/rentals/overdue/*` (Q12), `/api/reports/rentals/deposit-exhausted/*` (Q26) — rather than the `/api/reports/dashboard/q<n>/*` pattern every other card in this batch uses; the path inconsistency across all five is inherited from four different epics, not introduced here, and is named explicitly so a reviewer does not mistake it for a mistake this story made
**And** every other question below follows this batch's shared contract exactly (route pattern, permission, envelope, ratio shape, drillability), as Story 12.5's opening AC states

**Given** Q13's "which rental pieces earn their keep" — per-unit cumulative rental income, damage, upkeep, and payback ratio
**When** `q13-per-unit-ledger.question.js` runs
**Then** `summary({ from, to })` reads `v_rental_income WHERE unit_id = :unitId AND kind IN ('rent','damage') AND shop_day BETWEEN :from AND :to` summed as `incomePaise`, separately reads `v_net_expenses WHERE unit_id = :unitId AND category = 'RENTAL_UPKEEP' AND shop_day BETWEEN :from AND :to` summed as `upkeepPaise`, and returns `{ unitId, incomePaise, upkeepPaise, netPaise: incomePaise - upkeepPaise, paybackRatio: { numerator: netPaise, denominator: u.buyingPricePaise } }` — **two views, read separately, never joined into one row** to net them together, matching Story 12.1's own explicit statement that "Q13's per-unit ledger... reads two views, never a join that cancels them into one line"; `overdue` is deliberately excluded from `incomePaise` here — `dashboard-questions.md`'s own formula for Q13 names only rent and damage charges, not overdue, unlike Q1 and Q23 which both include it
**And** this question is called once per unit for a detail screen and once in aggregate for the dashboard card — the card's `summary()` (no `unitId`) returns the top and bottom N units by `paybackRatio` across the whole rental fleet for the range, and `lines({ from, to, page, pageSize })` returns every unit with any rental activity in range, sorted by `netPaise` descending, each row carrying the same fields as the per-unit shape

**Given** Q14's "how hard is the rental stock working" — utilisation, days booked ÷ days owned
**When** `q14-utilisation.question.js` runs
**Then** `summary({ from, to })` computes, per unit, `daysBooked` as `SUM(rb.period range length)` over `rental_bookings rb WHERE rb.unit_id = u.id AND rb.state IN ('HANDED_OVER','SETTLED','WRITTEN_OFF') AND rb.start_date <= :to AND rb.end_date >= :from` (a booking overlapping the range, clipped to it — `LEAST(rb.end_date, :to) - GREATEST(rb.start_date, :from) + 1`, AD-23's inclusive day-count formula applied to the clipped window) against `daysOwned` as `:to - si.purchased_on + 1` (or `:to - :from + 1` if intake predates the range — capped at the range width, since utilisation "since I've owned it" and utilisation "within the range I'm looking at" would otherwise silently mean two different things), returning `{ utilisationRatio: { numerator: daysBooked, denominator: daysOwned } }` per unit and averaged per product type
**And** a `CANCELLED` booking contributes no days — it never reached `HANDED_OVER`, so the piece was never physically out, matching the state list above naming exactly the three states in which a unit left the shop

**Given** Q23's "what did a retired piece finally earn" — final ROI per unit retired or written off in range
**When** `q23-retired-roi.question.js` runs
**Then** the range filter is a two-legged `UNION ALL` over the unit's **terminal event**, never a single anchor: Leg 1, a unit reaching `RETIRED` via return-and-settlement — `v_unit_status_events WHERE to_status = 'RETIRED' AND shop_day BETWEEN :from AND :to` (this leg's anchor is `returned_at`'s own shop day, reached through the view exactly as `dashboard-questions.md` states, "a unit reaching `lost` is not itself the anchor," read here as its converse: a unit reaching `retired` **is**); Leg 2, a unit written off — `rental_agreements WHERE written_off_at IS NOT NULL AND (written_off_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN :from AND :to`, joined to its unit — a booking is either returned-and-eventually-retired or written off, never both, so the two legs never double-count the same unit
**And** for each unit in either leg, the money is read lifetime, not range-clipped: `SUM(amount_paise)` over `v_rental_income WHERE unit_id = :unitId` across all kinds (`rent`, `overdue`, `damage`, `forfeited_deposit` — **all four**, unlike Q13's rent-and-damage-only shape, matching `dashboard-questions.md`'s explicit "lifetime rent + overdue + damage charges + any forfeited deposit"), minus lifetime `SUM(amount_paise)` over `v_net_expenses WHERE unit_id = :unitId AND category = 'RENTAL_UPKEEP'`, against `u.buying_price_paise`, returned as `{ unitId, netEarnedPaise, roiRatio: { numerator: netEarnedPaise, denominator: buyingPricePaise } }`
**And** a written-off unit's `forfeited_deposit` row is already anchored to the same `written_off_at` shop day that put it in Leg 2, so it is picked up once by the lifetime sum with no further filtering needed — restated here because it is the one figure in this question that could plausibly be miscounted twice, once by the range leg and once by the lifetime sum, if a builder filtered the lifetime sum to the range as well instead of leaving it lifetime

### Story 12.8: Vendor and lot — Q16, Q17, Q18

As the owner,
I want to see which vendor's stock actually sells, what I've paid each vendor, and whether my trip records add up,
So that I know which vendor to keep buying from and which trip's paperwork needs a second look (FR21/CAP-22, AD-2, AD-13, AD-14, AD-26; Q16, Q17, Q18).

**Acceptance Criteria:**

**Given** this story's shared contract (Story 12.5's opening AC, unchanged)
**When** any of this story's three questions is reviewed
**Then** each follows it exactly; all three are range-scoped, none is point-in-time

**Given** Q16's "which vendor's stock actually sells" — sell-through % and realised margin, per vendor and per lot
**When** `q16-vendor-sellthrough.question.js` runs
**Then** `summary({ from, to })` reads `stock_intake_lines sil JOIN stock_intakes si ON si.id = sil.stock_intake_id JOIN units u ON u.stock_intake_line_id = sil.id LEFT JOIN v_net_sale_lines vnsl ON vnsl.unit_id = u.id AND vnsl.shop_day BETWEEN :from AND :to`, grouped by `si.vendor_id` and separately by `sil.id`, returning `{ byVendor: [{ vendorId, sellThroughRatio: { numerator: soldCount, denominator: intakenCount }, realisedMarginPaise }], byLot: [...same shape...] }` — `soldCount` is `COUNT(DISTINCT u.id) FILTER (WHERE vnsl.unit_id IS NOT NULL AND vnsl.net_price_paise > 0)` (a reversed-then-never-resold unit does not count as sold, matching Q9's same reversal-exclusion reasoning), `intakenCount` is `COUNT(DISTINCT u.id)` over every unit from that lot regardless of sale, and `realisedMarginPaise` is `SUM(vnsl.net_price_paise - vnsl.net_buying_paise)` over the joined rows in range — the `LEFT JOIN` is required precisely because sell-through's denominator (units intaken) must include units never sold at all, which an inner join to `v_net_sale_lines` would silently drop from the count
**And** `lines({ from, to, groupKey: 'vendor'|'lot', page, pageSize })` returns each unit in the selected vendor's or lot's set, paginated, flagged sold/unsold and carrying its margin where sold

**Given** Q17's "what have I paid each vendor" — total paid per vendor, per-trip breakdown
**When** `q17-vendor-paid.question.js` runs
**Then** `summary({ from, to })` reads `stock_intakes WHERE purchased_on BETWEEN :from AND :to` grouped by `vendor_id`, `SUM(total_paid_paise)` — the same raw-table exception Q3 already used, since `stock_intakes.purchased_on` is AD-14's other named exception and no AD-13 view exists for it; `lines({ from, to, groupKey: vendorId, page, pageSize })` returns one row per trip for that vendor in range, carrying `billReference`, `totalPaidPaise`, `purchasedOn`

**Given** Q18's "do my trip records add up" — variance between recorded total paid and Σ(lot quantity × buying price)
**When** `q18-trip-variance.question.js` runs
**Then** `summary({ from, to })` reads `stock_intakes si JOIN stock_intake_lines sil ON sil.stock_intake_id = si.id WHERE si.purchased_on BETWEEN :from AND :to`, grouped by `si.id`, computing `SUM(sil.quantity * sil.buying_price_paise)` as `expectedPaise` per trip and comparing to `si.total_paid_paise`, returning `{ trips: [{ stockIntakeId, totalPaidPaise, expectedPaise, variancePaise: totalPaidPaise - expectedPaise }] }`, and a top-level `{ tripsWithVarianceCount }` counting trips where `variancePaise <> 0` — this is the one summary shape in this batch that is itself a list rather than a single figure, because "do my records add up" has no single number that answers it; `lines()` returns the same `trips` array, paginated, which is also this question's own drill — a trip with variance is the row the owner opens, and there is nothing beneath a trip to drill into further that this question adds (the lot-level detail behind a given trip's variance is Q16's `lines({ groupKey: 'lot' })`, not duplicated here)

### Story 12.9: Floor behaviour — Q19, Q24, Q20, Q21

As the owner,
I want to see whether staff are discounting away the margin, how much is coming back through exchanges, who is actually selling, and whether the shop is bringing in new faces or living off regulars,
So that I can coach a cashier who is pricing too close to the floor and tell a genuinely new customer from someone erasure detached from their own history (FR21/CAP-22, AD-2, AD-13, AD-14, AD-18, AD-26; Q19, Q20, Q21, Q24).

**Acceptance Criteria:**

**Given** this story's shared contract (Story 12.5's opening AC, unchanged)
**When** any of this story's four questions is reviewed
**Then** each follows it exactly; all four are range-scoped, none is point-in-time

**Given** Q19's "are we discounting away the margin" — average discount off selling price, count within 5% of floor, by cashier and product type
**When** `q19-discount-floor.question.js` runs
**Then** `summary({ from, to })` reads `v_net_sale_lines vnsl JOIN units u ON u.id = vnsl.unit_id WHERE vnsl.shop_day BETWEEN :from AND :to AND vnsl.net_price_paise > 0` (reversing lines excluded — a negative "discount" on a reversal is not a pricing decision, the same reasoning Q9 and Q16 already state), grouped by `sold_by_user_id` and separately by `product_type_id`, computing `AVG(u.selling_price_paise - vnsl.net_price_paise)` as `avgDiscountPaise` and `COUNT(*) FILTER (WHERE vnsl.net_price_paise <= u.floor_price_paise * 1.05)` as `nearFloorCount`
**And** `lines({ from, to, groupKey: cashierId|productTypeId, page, pageSize })` returns each qualifying sale line, carrying `sellingPricePaise`, `transactedPricePaise` (i.e. `net_price_paise`), `floorPricePaise`, and the computed discount — the near-floor rows are visually distinguishable client-side by comparing the two figures directly, not by a server-side boolean flag this file would otherwise have to invent

**Given** Q24's "how much is coming back" — exchange count and net difference, by cashier and product type
**When** `q24-exchanges.question.js` runs
**Then** `summary({ from, to })` reads `sales WHERE exchange_of_sale_id IS NOT NULL AND deleted_at IS NULL AND (sold_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN :from AND :to`, grouped by `sold_by_user_id` and separately by the outgoing line's `product_type_id` (joined through `sale_lines`/`units`), returning `{ exchangeCount, netDifferencePaise: SUM(exchange_difference_paise) }` per group — reading `sales` directly is permitted here for the identical reason Q2's retail component reads it: AD-13's direct-read ban names `sale_lines`, not `sales`, and `exchange_difference_paise` is the one figure that exists only on `sales` itself, carried as AD-2's second closed sign exemption, already correctly signed collect-vs-refund
**And** `lines()` returns each exchange in range, paginated, carrying both the reversed line and the new line's unit references and the signed difference — "how much is coming back" answered as the actual pieces, not just the net rupees

**Given** Q20's "who is selling" — sales count and value per cashier
**When** `q20-cashier-sales.question.js` runs
**Then** `summary({ from, to })` reads `v_net_sale_lines WHERE shop_day BETWEEN :from AND :to`, grouped by `sold_by_user_id`, `COUNT(DISTINCT sale_id)` and `SUM(net_price_paise)` — `v_net_sale_lines` already carries `sold_by_user_id` directly (Story 12.1), so the index Story 12.2 added on `sales(sold_by_user_id)` serves the view's own underlying scan rather than a further join this file would otherwise need; `lines()` returns each cashier's sales, paginated, sorted by value descending

**Given** Q21's "new faces or regulars" — new vs returning customer counts and average basket value, matched on `sales.customer_id` and never on `whatsapp_number`
**When** `q21-new-vs-returning.question.js` runs
**Then** `summary({ from, to })` first computes, per `customer_id`, that customer's **first-ever** `sold_at` shop day across all of `sales` (unbounded by the selected range — a customer's "first sale" is a lifetime fact, not something the range can move) via `MIN(shop_day) OVER (PARTITION BY customer_id)` read through `v_net_sale_lines`, then classifies each sale **within** the range as `new` (its shop day equals that customer's first-sale shop day) or `returning` (it does not), returning `{ newCustomerCount, returningCustomerCount, newAvgBasketPaise, returningAvgBasketPaise }` — `newAvgBasketPaise`/`returningAvgBasketPaise` computed from `SUM(net_price_paise)` per `sale_id` first (a basket is one sale, summed across its lines), then averaged across the sales in each class
**And** every join and grouping key in this file is `customer_id` — **never** `whatsapp_number`, matching AD-18's binding correction and `dashboard-questions.md`'s own explicit statement that matching on the number "detaches an erased customer's history and merges the next person to reuse the number into it"; an automated test seeds a customer, records a sale, erases the customer through the **real** `POST /api/customers/:uuid/erase` route (Story 10.2, Epic 10) — this epic's re-sequencing to the end of the build, under Raviraj's decision, means Epic 10 has already shipped by the time this story is written, so this test needs no stub of the erasure route the way an earlier draft of this question, written before the re-sequencing, would have needed one — reassigns the same `whatsapp_number` to a second, distinct customer with its own `customer_id`, records a second sale under the new customer, and asserts Q21 reports **two** distinct customers — one new, one new — never folding the second sale into the first customer's history, which a `whatsapp_number` join would have done
**And** `lines()` returns each sale in range tagged `new`/`returning`, paginated, carrying `customerId` and the basket value — no customer name or number is read from `customers` for this listing at all, per AD-18's binding rule that "no historical read may join to `customers` for name/number"; a name shown here, if any, is `sale.customer_name_snapshot`, the same snapshot the receipt uses

### Story 12.10: Prove the reporting half of AD-18's read rule — the half Story 10.3 couldn't check because these views didn't exist yet

As a developer,
I want the six AD-13 views and every dashboard question this epic builds checked against AD-18's "no historical or reporting read may join live to `customers`" rule, and the dashboard's own figures proven unchanged by an erasure,
So that the property Epic 10's Story 10.3 verified for every read path that existed at the time is completed for the reporting read side once that side finally exists (FR21/CAP-22, AD-12, AD-13, AD-18, AD-24; Q21).

**Acceptance Criteria:**

**Given** Epic 10's Story 10.3, which audited every historical and reporting read path that existed when Epic 10 shipped — receipts, sale reads, hand-over receipt, settlement slip, and the five operational dashboard questions carried into Epics 4, 7, and 8 by this run's re-sequencing (Q11, Q12, Q15, Q22, Q26) — and stated explicitly that the six AD-13 views and the remaining 22 dashboard questions could not be audited then, because neither existed until this epic
**When** this story is scoped
**Then** it is that story's other half, not a re-audit of ground Story 10.3 already covered: this story's audit covers, by name and one at a time, the six views Story 12.1 creates (`v_net_sale_lines`, `v_net_expenses`, `v_rental_income`, `v_deposits_held`, `v_rent_held`, `v_unit_status_events`) and every `*.question.js` file this epic's own Stories 12.5–12.9 add under `modules/reports/questions/` — **not** the five files Story 12.7 wires into the card registry without building, since Story 10.3 already covers those
**And** the audit's result is recorded in this story's own completion notes as a list of every path checked, matching the form Story 10.3 already established, so a later reader can tell "checked and clean" from "not looked at" for the reporting side exactly as they can for the historical side

**Given** any view or question file in that list found to join live to `customers` for a name or a number
**When** the audit finds it
**Then** it is a defect this story fixes, exactly as Story 10.3 commits to for its own half — repointed at the transaction row's own `customer_name_snapshot`/`customer_whatsapp_snapshot` (AD-24), with the fix landing inside this story, accompanied by a test proving that path's output is unchanged by an erasure

**Given** the repo-level guard test Story 10.3 already added — failing the build if any file under `backend/src/modules/reports/` references the `customers` table or the `Customer` model at all
**When** this epic's own views and question files are checked against it
**Then** that guard, being a pattern match over `backend/src/modules/reports/` rather than an enumerated file list, already covers every file this epic adds the moment they exist — this story adds **no second guard test**, and instead runs Story 10.3's existing guard against this epic's now-complete `modules/reports/` tree as this story's own proof that it holds, recording the run in this story's completion notes rather than duplicating the assertion

**Given** a shop day with completed retail sales and closed rental agreements for a customer who is then erased
**When** every range-scoped dashboard figure for that past day is recomputed after the erasure
**Then** each one reconciles **to the paise** with the figure computed before it — takings, profit, the three money buckets, per-cashier and per-product-type breakdowns alike — and an automated test asserts the two result sets are equal, which is AD-18's stated failure mode ("a takings figure that changes the day a customer is erased") tested directly rather than reasoned about; this is the one assertion in Story 10.3's original scope that could not have run in Epic 10 under any circumstance, dashboard or no re-sequencing, because it requires the dashboard's own range-scoped figures to exist, and it is this story's own reason to exist independent of the guard-test technicality above

**Given** Q21's own erasure test (Story 12.9), which — thanks to this epic's re-sequencing to the end of the build — already exercises the real `POST /api/customers/:uuid/erase` route rather than a stub
**When** this story's audit reaches Q21
**Then** it adds no further assertion beyond confirming, once more, that the erased customer's own earlier sale is still counted under their surviving `customer_id` with the name on any drill-down coming from `sales.customer_name_snapshot` — the same property Story 10.3 states as its own closing assertion for its half, restated here because Q21 is the one question in either half that reads `customers`-adjacent data by construction and deserves to be named explicitly in both audits rather than assumed covered by one
