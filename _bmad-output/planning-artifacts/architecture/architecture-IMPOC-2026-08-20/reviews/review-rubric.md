# Rubric Review — ARCHITECTURE-SPINE.md (IMPOC Core)

- **Target:** `_bmad-output/planning-artifacts/architecture/architecture-IMPOC-2026-08-20/ARCHITECTURE-SPINE.md`
- **Checked against:** `_bmad-output/specs/spec-impoc-core/SPEC.md`, `backend/AGENTS.md`, and four existing source files (`backend/database/migrations/20260807174936-create-users.js`, `backend/database/models/User.js`, `backend/src/middleware/error.middleware.js`, `backend/src/modules/users/user.service.js`)
- **Reviewed:** 2026-08-20
- **Rubric scope only:** AD Rule enforceability vs its Prevents line; brownfield-claim accuracy; CAP coverage; Deferred items that two epics could resolve incompatibly; dimensions this altitude owns left completely silent.

**Verdict:** structurally strong spine — AD-7, AD-8, AD-13, AD-16, AD-17, AD-18 are genuinely load-bearing and mostly falsifiable — but it has one missing entity (the multi-unit rental booking / hand-over group), one self-inflicted race (AD-19's mandated retry against a non-idempotent checkout), and two brownfield claims that do not match the files they cite.

---

## CRITICAL

### C1 — The multi-unit booking and the hand-over "group id" have no structural home (AD-7, AD-10, migrations 15–16, ERD)

CAP-18 requires: *"Handing over three sarees creates three agreements sharing one group id and produces one receipt listing all three."* CAP-17 requires: *"A customer books one or more rental pieces for a date range and pays for the whole booking there and then."*

The spine models rentals as strictly one row per unit and never introduces the grouping entity:

- AD-7: `EXCLUDE USING gist (unit_id WITH =, period WITH &&)` — `rental_bookings` carries a single `unit_id`, so a three-saree booking is three rows.
- ERD: `RENTAL_BOOKING ||--o| RENTAL_AGREEMENT : becomes` — one-to-one, no group node, no booking header.
- Migration `15 create-rental-bookings # FK units, customers, users` and `16 create-rental-agreements # FK rental_bookings, units, damage_grades` — neither lists a group/header column.
- AD-10 nonetheless assumes one exists: *"addressed by the sale or group reference"* and *"A **settlement** is one transaction scoped to one unit's agreement, leaving its group siblings untouched."* The word "group" is used as if defined; it is defined nowhere.

Contrast with the retail side, where the spine is explicit: `sales` is the header and `sale_lines` the children (migrations 13–14). The rental side has the children with no header.

Consequences that two epics will resolve incompatibly:
- **Where the money lives.** CAP-17 collects rent for the whole booking *plus* deposit "at that moment", as one payment. With no header there is no row to hold the booking-level payment, payment method, or reference. One builder puts `rent_paise`/`deposit_paise`/`payment_method` per booking row and sums; another invents `rental_booking_groups`. AD-13's `v_rental_income` breaks differently under each.
- **What "one receipt for the whole hand-over" is addressed by.** AD-10 says the receipt is regenerated "from committed rows, addressed by the sale or group reference" — with no group column, the rentals epic must invent the identifier that AD-10 already assumes.
- **Cancellation scope.** AD-5 permits `open → … cancelled`; whether cancelling cancels one unit or the whole booking is undecidable without the entity.

This is the single largest hole. It should be an AD, not a seed detail: either `rental_bookings` gets a `group_uuid` (with the exclusion constraint unchanged) or a `rental_booking_groups` header table is added at migration 15 with `rental_bookings` becoming its lines.

### C2 — AD-19's mandated client retry makes checkout duplicable, and no AD closes it

AD-19 Rule, consequence 1: *"every scan and checkout call retries with backoff and shows an explicit 'waking up' state rather than an error."*

Nothing in the spine makes `POST /api/sales` (or the booking/hand-over gesture) idempotent. AD-10 guarantees the gesture is atomic; it does not guarantee it happens **once**. The concrete failure: the request commits, the response is lost to the cold-start/pooler timeout, the client retries as instructed, and the second attempt either

- creates a **second sale** (if the units were somehow re-stocked, or for a booking, where AD-7's exclusion is keyed on `unit_id`+`period` and a *different* unit set is not blocked), or
- fails AD-8's compare-and-swap with a 409 naming a unit that *this same customer's own committed sale* took — so a successful sale is reported at the counter as a failure, and the cashier rings it again after "fixing" it.

AD-10 asserts *"no retry loop exists, because every race in this system is closed by AD-7, AD-8, or AD-9"* — that is true for two concurrent *distinct* gestures and false for one gesture replayed. AD-19 introduces exactly that replay and AD-10 does not know about it.

This altitude owns the answer (an idempotency key on the write endpoints, or a client-generated `sale_uuid`/`booking_uuid` supplied on the request and made unique — which also fits AD-1's uuid-on-the-wire rule). It is neither decided, deferred, nor flagged.

---

## HIGH

### H1 — AD-13: `v_rental_income` does not say whether a cancelled booking's rent is income

AD-13's contract line: *"`v_rental_income` | Rent (anchored to the booking's **creation** shop-day), damage charges (anchored to `returned_at`), and forfeited deposits (anchored to the `lost` transition)…"*

The spec constraint is unambiguous that cancellation earns the shop the rent: *"an early return, a late collection, a cancellation, or a no-show all leave the rent as charged."* The view contract never mentions `state`. One builder writes `WHERE state <> 'cancelled'` because "cancelled bookings aren't revenue" and takings drop; another includes them. AD-13 exists precisely to stop money questions diverging, and this is the one place its own contract is silent on a filter. Add the state predicate (or its explicit absence) to the view contract.

### H2 — AD-13's absolute rule is contradicted one line later, and the exempt query is the one CAP-22 names for reconciliation

AD-13 Rule: *"Three plain views are the **only** surface any money question reads."* Then the `v_rental_income` row: *"Deposits *held* are deliberately absent — they are a liability and are queried separately for Q6."*

Q6 is a money question reading raw tables. CAP-22's reconciliation criterion names it explicitly: *"deposits held equals the sum of open agreements' deposits."* The forbidden-source list (*"may not select from `sale_lines`, `expenses`, or `rental_bookings` directly"*) omits `rental_agreements`, so the exemption is technically legal — but the divergence AD-13 was written to prevent (each question independently remembering which rows to exclude) reappears for the deposit/liability side: open, forfeited, refunded-in-part and damaged-against deposits are all `rental_agreements` states, and Q6, Q11/Q12 and settlement will each filter them by hand. Either add a fourth view (`v_deposits_held`) or restate the rule as "the only surface for *income* questions" and name the deposit surface.

### H3 — Deferred "Receipt layout and delivery" is scheduled to be resolved by two different epics

Deferred: *"**Receipt layout and delivery.** … *Revisit at the CAP-15 / CAP-18 stories.*"*

CAP-15 is a sales-epic story; CAP-18 is a rentals-epic story. The deferred item names both as the revisit point, which is the definition of a divergence: the sales epic ships a streamed PDF download, the rentals epic ships a WhatsApp link or a thermal print, and the shop has two receipt idioms. It compounds C1 (the hand-over receipt has no group reference to be addressed by) and it collides with CAP-15's own criterion: *"a reference that reproduces the same receipt later unchanged"* — "unchanged" is unachievable if the layout is a per-epic decision and receipts are re-rendered on demand rather than stored (AD-19.2 forbids storing them). Decide the receipt as one thing here, in one epic, before either.

### H4 — Collection response shape and pagination are completely silent

The Conventions table fixes the envelope (`{ success, data }`) and AD-14 requires every question to ship `lines({ from, to, ...groupKey })` — a drill-down that returns rows. Nothing anywhere says what a list `data` looks like: bare array, or `{ items, total, page }`. At the stated volume (*"order 10⁴ units, 10⁵ sale lines over five years"*, AD-15) a per-unit ledger or a month's sale lines is a real page.

This is an initiative-altitude contract — every module and every one of the 24 question files returns collections — and two epics will pick differently the week they are written. AD-15 also forecloses the usual escape (*"no cache layer, no read replica, no denormalised total, and no summary table"*) without saying how a large drill-down is bounded. Neither decided nor deferred nor flagged.

### H5 — The two-level price snapshot is a spec constraint with no AD

SPEC constraint: *"Prices are snapshotted at two levels: a unit copies its lot's buying, selling, and floor prices (and rental terms) at intake; a sale line or rental agreement copies the transacted price at checkout. Editing a lot or a unit never alters a recorded transaction."*

In the spine this appears only as a naming rule (`snapshots *_snapshot` in Consistency Conventions) and as an aside inside AD-10's sequence diagram (*"INSERT sale_line (transacted + buying price snapshots)"*). It is a load-bearing invariant that spans three modules — intake writes tier 1, sales and rentals write tier 2, and AD-13's `v_net_sale_lines` depends on `net_buying_paise` existing on the line rather than being joined from the unit. Without an AD, the intake epic and the sales epic will disagree about which fields are copied and whether margin reads the snapshot or joins the lot. AD-5 actively makes this worse: it files `units` and `stock_intake_lines` under *"Mutable master data … Ordinary UPDATE and soft delete"*, which is exactly the mutation the snapshot exists to survive, and says nothing about it.

### H6 — CAP-1's "configurable without a code change" has no home

CAP-1 success: *"Every dimension in that layout — barcode width and height, text size, clear space, margins, and the resulting grid — is a configurable value, so the layout is tuned against a physical print without a code change."*

The spine addresses only the barcode *value* width (AD-17: *"Width is configuration, defaulting to 10 digits zero-padded"*) and never the label geometry. `app_settings` exists at migration 03 but is scoped by its own comment to one setting: *"# exchange window (default 7), admin-changeable"*. So the barcode epic will put geometry in a JS constants file (arguably still a code change, failing the criterion) while an admin-settings epic expects it in `app_settings`. Decide: `app_settings` rows, env, or a config module — and say whether `app_settings` is a typed-column table or a key/value store, which is itself undecided and read by two epics (CAP-1 and CAP-23).

### H7 — CAP-12's enforcement points fall into a Deferred dimension

Capability map: *"CAP-12 | `modules/sales/` (cart is client-side state) | AD-8 (no status change on add), AD-3"*.

Two problems. First, "cart is client-side state" is a binding architectural decision made in a parenthetical inside a mapping table, not in any AD — and it is exactly the decision two epics diverge on (a server-side `carts` table is the obvious alternative and would need its own race story). Second, having made it, three of CAP-12's four success criteria — *"Scanning a unit that is not `in_stock` is refused at scan time with its actual status"*, *"scanning a unit whose channel is rental is refused from a retail cart"*, *"the same barcode scanned twice into one cart adds one line, not two"* — land in the client, whose architecture is Deferred (*"Frontend state management and routing … nothing above binds its internal architecture"*). AD-8 is cited as governing CAP-12 but AD-8 governs status *transitions*; "no status change on add" is the absence of an action, which no rule enforces. Same defect for the dedupe rule: nothing states it, so nothing prevents it.

### H8 — AD-14's range predicate bypasses AD-6 for every timestamp anchor

AD-14 Rule: *"ranges are half-open on the shop day: `anchor >= :from AND anchor < :to + 1 day`."*

Four of the six anchors in AD-14's own table are `TIMESTAMPTZ` (`sale.sold_at`, `rental_bookings.created_at`, `rental_agreements.returned_at`, `unit_status_events.occurred_at`). Comparing a `timestamptz` directly against a date parameter resolves the date at the **session** timezone — UTC on the hosted server — which is precisely the 5½-hour error AD-6 exists to prevent: *"Prevents: … the till not reconciling at close — all of which happen silently once the app is hosted on a UTC server."* A sale at 23:00 IST falls in the previous day's takings under the predicate as written, while `expenses.incurred_on` (a `DATE`) does not — so takings and expenses disagree on day boundaries and Q2 till reconciliation fails.

AD-6 states the correct form (`(<col> AT TIME ZONE 'Asia/Kolkata')::date`) but AD-14 restates the predicate in raw form and AD-14 is the one a builder copies. Fix AD-14 to read `(<anchor> AT TIME ZONE :shopTz)::date >= :from AND … < :to + 1`, or declare that every anchor is exposed by the AD-13 views as a pre-computed shop-day column (which the `v_net_sale_lines` contract already hints at: *"Carries the shop-day column"*) and that questions may only use that column.

### H9 — AD-6 claims to prevent "an exchange refused on day 7" but never defines the day count

AD-6 Prevents: *"an overdue unit appearing 5½ hours early or late, an exchange refused on day 7."* Binds: *"CAP-23 (exchange window)."*

The Rule fixes the timezone and the reduction of a timestamp to a shop day, then stops. It never says whether the CAP-23 window is `sold_at + 7 days` as an instant or `(sold_at AT TIME ZONE …)::date + 7` as a shop day, nor whether the boundary is inclusive. A sale at 21:00 on the 1st, presented at 10:00 on the 8th, is inside the window on one reading and outside on the other — the exact case the Prevents line claims to have settled. Note the spine *does* settle the analogous question elsewhere (AD-7: *"Bounds are `'[]'` — inclusive both ends, because a piece due back on the 17th is out on the 17th"*), which is the model to follow. Overdue is likewise stated as strict (`> due_date`); exchange gets nothing.

---

## MEDIUM

### M1 — Brownfield claim is wrong: AD-1 cites an IDENTITY column the repo does not have

AD-1 Rule: *"Every new table carries `id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY` **and** `uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()`, matching `database/migrations/20260807174936-create-users.js`."*

That file does not match. It uses the legacy serial idiom:

```js
id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
},
```

`autoIncrement: true` emits `SERIAL` (an owned sequence + column default), not `GENERATED BY DEFAULT AS IDENTITY`. Two knock-ons: (a) the "matching" claim is false and a builder verifying it will trust the file over the spine, and (b) Sequelize 6's `queryInterface.createTable` has no way to emit IDENTITY, so AD-1 as written silently requires raw DDL or a follow-up `ALTER COLUMN … ADD GENERATED …` in every table migration — an instruction the AD never gives, in a spine that is otherwise careful to flag exactly this (AD-7: *"Sequelize 6 `addConstraint` has no exclusion type, so this is raw `queryInterface.sequelize.query()` DDL"*). Either drop IDENTITY and say "serial, as `users` does", or keep it and state the raw-DDL requirement.

The `uuid` half of the claim **is** accurate: the migration uses `defaultValue: Sequelize.literal('gen_random_uuid()')`.

### M2 — Brownfield claim is wrong: AD-10 cites a rollback guard `user.service.js` does not have

AD-10 Rule: *"Transactions are **unmanaged**, matching `user.service.js` and `auth-session.service.js`: `const t = await sequelize.transaction()`, work inside `try`, `await t.commit()`, and `if (!t.finished) await t.rollback()` in `catch`."*

`backend/src/modules/users/user.service.js` has no such guard:

```js
} catch (error) {
    await transaction.rollback();
    throw error;
}
```

The spine's version is the better rule — the repo's unguarded rollback throws a second, masking error if `commit()` itself failed — but presenting it as "matching" an existing file is inaccurate, and the spine never says the existing services should be brought into line or left alone. Also note `t.finished` is a Sequelize 6 internal property with no documented contract; `t.finished === undefined` is the only "not finished" state, so the guard is really `if (!t.finished)` relying on an undocumented field. Worth stating explicitly rather than by example.

### M3 — AD-3 does not fix the case convention for constrained string values, and the repo and the spec disagree

AD-3 Rule: *"following the `users_status_check` idiom already in the repo. The same allowed set is mirrored as a frozen object in `backend/src/constants/`."*

The idiom claim is accurate — `addConstraint('users', { fields: ['status'], type: 'check', name: 'users_status_check', … })` is exactly what the migration does, and `src/constants/user-status.js` is exactly the mirror. But the existing values are **UPPERCASE** (`'ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'`), while every value the spine writes is lowercase snake (`'in_stock'`, `'open'`, `'handed_over'`, `'sold'`, `'rented'`, `'lost'`). The spec mixes both: CAP-14 says *"Payment method records as UPI or cash"* and the Assumptions section names the expense category `RENTAL_UPKEEP`.

AD-3 binds six value sets and settles the case of none of them. `sale.payment_method` will be `'UPI'`/`'cash'` in one epic and `'upi'`/`'cash'` in another; `expense.category` will be `RENTAL_UPKEEP` or `rental_upkeep`. Because AD-3 makes the CHECK "the backstop" and the constant "what code reads", a mismatch surfaces as a `23514` at runtime — routed by AD-11 to a generic check-constraint message, not to anything that names the real problem. One line in AD-3 fixes it.

### M4 — AD-5 grants `units` "ordinary UPDATE" while AD-8 reserves `units.status` — read alone, AD-5 permits the bypass

AD-5 tier table: *"**Mutable master data** | `customers`, `vendors`, `units`, `stock_intakes`, … | Ordinary UPDATE and soft delete."*

AD-8 says the opposite for one column: *"no other module may write `units.status` directly"* and every transition must be the compare-and-swap. AD-5 is the AD a builder consults to answer "may I update this row?", and its answer for `units` is an unqualified yes. Add the carve-out in the tier row (`units` — mutable **except** `status`, see AD-8) so the two ADs cannot be read apart.

### M5 — AD-10's own sequence diagram violates AD-8's sole-writer rule

AD-8: *"The legal `(channel, from, to)` set from `unit-state-machine.md` lives in one table-driven guard in `units.service.js`; no other module may write `units.status` directly."*

AD-10's diagram, immediately below:

```
participant S as sales.service
S->>DB: UPDATE units SET status='sold' WHERE status='in_stock' RETURNING id
```

The diagram shows `sales.service` issuing the UPDATE against the database. Either the diagram should route through `units.service` (a service calling another module's service, which the dependency section explicitly permits) or AD-8 should be softened to "the guard is centralised; the statement is issued inside the calling gesture's transaction". As drawn, the two ADs disagree about who writes the column, and the sales epic will copy the diagram.

### M6 — AD-11 never says where the translator is invoked, so the centralisation it promises is not enforced

AD-11 Prevents: *"five modules each inventing their own message and status code for the same `23505`."* Rule: *"One translator module maps … Services throw the translated error; `error.middleware.js` shapes it, unchanged."*

The mapping table is central; the **call site** is not specified. "Services throw the translated error" means every service must wrap every write in a try/catch that calls `lib/db-errors.js` — which is precisely the per-service repetition the AD says it prevents, and the first service that forgets returns `Internal server error`. Verified against the real middleware: `backend/src/middleware/error.middleware.js` handles `ZodError` and `error.statusCode`, and nothing else — an untranslated `SequelizeUniqueConstraintError` has no `statusCode`, so it falls to:

```js
return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : 'Internal server error',
});
```

Also unstated: what happens to a constraint name absent from the registry (500? a generic 409?). Either mandate a single wrapper the services call (`withDbErrors(t, fn)`) or accept one branch in the middleware — but "unchanged" plus "centrally" plus "services throw" cannot all three hold.

### M7 — AD-15 says the index set is "exactly" this, and then omits indexes its own questions need

AD-15 Rule: *"The index set is exactly:"* — an admirably falsifiable claim, which makes the gaps binding:

- **No `sales(customer_id)` / `rental_bookings(customer_id)`.** AD-18's upstream flag mandates *"Q21 must match on `sales.customer_id`"*, and Postgres does not index FK columns automatically. AD-15 forecloses adding it later (*"prevents indexes accreting per-question"*).
- **No `unit_status_events(unit_id)`**, although AD-14 lists `unit_status_events` as a row source and the per-unit ledger row of AD-15 covers `sale_lines`, `rental_agreements` and `expenses` but not events — so Q13's ledger seq-scans the one append-only table that grows fastest.
- **No index for `v_rental_income`'s forfeited-deposit leg**, which filters `unit_status_events` by transition type.

Either widen the set or change "exactly" to "at minimum, and additions are reviewed" — the latter weakens the AD, so widening is better.

### M8 — CAP-8 and CAP-9 are mapped to ADs that do not govern them

Capability map: *"CAP-7, CAP-8, CAP-9 | `modules/intake/` + `modules/units/` | AD-8, AD-17, unique `units.barcode`"*.

AD-8 (status CAS), AD-17 (barcode sequence) and the barcode unique index all govern CAP-7 correctly. Neither governs:

- **CAP-8** — *"changing the cloned lot never alters the original or its units"*, which is the snapshot invariant (see H5), not a status or barcode rule.
- **CAP-9** — size-run auto-advance, *"four scans record S, M, L, XL in order and the fifth wraps to S; the auto-advanced size can be overridden on any individual scan without breaking the sequence"*. That is sequencing state with a defined wrap and override behaviour, and the spine never says whether it is client-side (like the cart, H7) or a server-held cursor on the lot. Same defect as CAP-12: a spec success criterion whose enforcement point is unassigned and whose likely home is the Deferred frontend.

### M9 — AD-3's Binds list omits `rental_booking.payment_method`

AD-3 Binds: *"`unit.status`, `unit.channel`, `rental_booking.state`, `sale.payment_method`, `expense.category`, `damage_grade.outcome`."*

CAP-17 collects real money at booking (*"rent for the full window plus the deposit are collected at that moment"*) and the spec constraint *"Payment method is recorded as UPI or cash"* is not scoped to retail. CAP-19 pays a deposit balance back and CAP-23 refunds a cash difference. So there are at least two more constrained value sets the spine does not bind — booking payment method, and the settlement/refund method — and an unbound one becomes free text in the rentals epic.

### M10 — AD-2 pushes all rounding to "display", which is the one place this spine does not bind

AD-2 Rule: *"Ratios … are computed in the read layer as a numerator/denominator pair returned to the client, never stored and never rounded in SQL. Rounding happens once, at display."*

The numerator/denominator contract is a good decision. But "display" is the frontend, and Deferred says *"Frontend state management and routing … nothing above binds its internal architecture."* Nothing states the paise→rupee format, the rounding mode, or the decimal places, so the dashboard epic and the receipt epic will each pick — and CAP-22's *"Numbers reconcile"* is judged by a human reading two screens. One line naming a single formatting helper and a rounding mode (half-up, 2dp, paise/100) costs nothing and closes it.

### M11 — Deferred "Frontend state management and routing" is contradicted by AD-19.1, which does bind frontend behaviour

Deferred: *"The SPA is one React 19 + Vite app with a preserved ZXing decode core; **nothing above binds its internal architecture.**"*

AD-19 consequence 1 binds it directly: *"every scan and checkout call retries with backoff and shows an explicit 'waking up' state rather than an error."* That is a mandated client state machine and retry policy — and per C2 it is the source of the duplicate-write risk. The deferral should be narrowed to routing/state-library choice, and the retry/waking-up contract (plus the health endpoint that AD-16 assumes an external monitor pings, which no AD assigns to the backend) should be listed as binding.

### M12 — AD-17 quietly weakens CAP-2 without flagging it upstream, unlike AD-8 and AD-18

CAP-2 success: *"the sequence never rewinds after a process restart or a database restore."*

AD-17: *"**Restore semantics, stated honestly:** a database restore can rewind the sequence behind labels already on paper. Startup runs `setval(…)` … but cannot know about printed-but-unbound sheets. A reissued value therefore degrades to a refused scan at intake."*

The engineering is right and the honesty is welcome, but it contradicts a literal spec success criterion and is presented as a Rule detail rather than as a defect. The spine has an established, well-used device for exactly this — AD-8 and AD-18 both carry *"> **Conflict with the spec — must be resolved upstream.**"* AD-17 should carry the same marker so CAP-2's wording is amended rather than silently failed at acceptance.

## LOW

- **L1 — AD-9's title does not describe its third index.** *"AD-9 — Double-reversal is blocked by a unique index on the reversal pointer"*, but `agreements_one_open_unit ON rental_agreements(unit_id) WHERE returned_at IS NULL` is not a reversal pointer, and the AD correctly says the double-settlement guard is the CAS, not the index. Retitle to cover both, or split.

- **L2 — No unique index on the sale-level reversal pointer.** AD-9 guards `sale_lines(reverses_sale_line_id)` and `expenses(reverses_expense_id)`; migration 13 lists *"self-FKs reverses / exchange_of"* on `sales` with no equivalent index. Harmless today because AD-13 nets at line level, but asymmetric with AD-9's stated principle that "at most one reversal per row" is a database fact.

- **L3 — `paranoid: true` is presented as an existing convention; no model in the repo uses it.** Conventions: *"`PascalCase` singular in `database/models/`, `underscored: true`, `timestamps: true`, `paranoid: true`."* `backend/database/models/User.js` closes with `{ tableName: 'users', timestamps: true, underscored: true }` — no `paranoid`, and the migration has no `deleted_at`. The repo's actual soft-delete idiom is a status value: `user.service.js`'s `deleteUser` does `await user.update({ status: USER_STATUS.DELETED })`. AD-4 is right to scope existing tables out; the Conventions row should say `paranoid: true` is **new** for new tables, not a continuation. (Note also that `backend/AGENTS.md` claims *"Every table carries timestamps and a soft-delete column"* — that claim is false for `users`; the spine's non-retrofit stance is correct and could say so.)

- **L4 — `uuid` generation side is unspecified for new models.** The migration uses `Sequelize.literal('gen_random_uuid()')` (DB-side) while `User.js` uses `defaultValue: DataTypes.UUIDV4` (app-side). AD-1 fixes the column default; nothing fixes the model, so new models will split. One line in the Conventions "Model naming" row.

- **L5 — The `errors[]` envelope only exists for Zod failures.** Conventions: *"Envelope stays `{ success, data }` / `{ success, message, errors[] }`."* The real middleware emits `errors[]` only in the `ZodError` branch; the `statusCode` branch returns `{ success, message }` with no `errors` key. Clients written against the stated envelope will read `undefined`. Say "`errors[]` on validation failures only".

- **L6 — AD-16's prohibition is enumerated, not categorical.** *"None of `node-cron`, `node-schedule`, `agenda`, `bull`, `bullmq`, `bree`, or `cron` may enter `backend/package.json`."* A builder adding `toad-scheduler` or `croner` complies with the letter. The `setInterval` / `setTimeout` / second-entry-point clauses cover the behaviour, so this is cosmetic — but state the category first and the list as examples.

- **L7 — No non-negativity CHECKs on money.** AD-2 fixes `BIGINT NOT NULL` and migration 10 carries `CHECK floor <= selling` and `CHECK overdue_per_day > rent_per_day`, but nothing forbids a negative price, and AD-16's `floor(deposit_paise / overdue_per_day_paise)` divides by a column no constraint keeps above zero (it is only required to exceed `rent_per_day`, which is itself unbounded below). Cheap to add at AD-2.

- **L8 — Tier unstated for `customer_erasure_audit`.** Migration 19 creates it; AD-5's three-tier table does not list it. Obviously append-only, but AD-5's value is that the tier is never inferred.

- **L9 — Walk-in booking is an insert straight into a non-initial state.** AD-5 permits UPDATE *"only to advance the row toward its terminal state (`open → handed_over → settled|cancelled`)"*, while CAP-18 says *"A walk-in with no prior booking books and takes hand-over in one transaction."* Inserting directly at `handed_over` is legal under the CHECK but is not an "advance"; say so explicitly so a builder does not insert `open` then immediately UPDATE (harmless) or refuse the walk-in (not harmless).

---

## Coverage of the Capability → Architecture Map

Every capability in scope is present. Enumerated against the map: CAP-1, 2 | 3 | 4 | 5, 6 | 7, 8, 9 | 10, 11 | 12 | 13 | 14, 15 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 — that is CAP-1…CAP-15 and CAP-17…CAP-24 with no gaps, and CAP-16 correctly absent (retired 2026-08-20, ID never reused). No spurious rows.

Rows where the named AD does not in fact govern the capability:

| Row | Objection |
| --- | --- |
| `CAP-7, CAP-8, CAP-9` | See M8 — nothing named governs CAP-8's clone-isolation or CAP-9's size-run sequencing. |
| `CAP-12` | See H7 — AD-8 governs transitions, not their absence; the enforcement points are client-side and deferred. |
| `CAP-3 → AD-3, AD-4` | AD-3 is about CHECK-constrained string columns and reaches only `damage_grade.outcome`; the picklists themselves are tables. AD-4 is soft delete, but CAP-3 requires *"deactivating an entry hides it from new use without altering records already made against it"* — deactivation is not deletion. If a builder implements deactivate as `deleted_at` with `paranoid: true`, Sequelize excludes the row from every include, so a unit whose colour was deactivated renders with no colour and Q7/Q13 lose a join. This needs an `is_active` decision, and neither named AD supplies it. *(Promote to MEDIUM if the picklists epic starts before it is answered.)* |
| `CAP-17 → AD-7, AD-10` | Correct as far as it goes, but the money and grouping half of CAP-17 has no governing AD — see C1 and M9. |
| `CAP-5, CAP-6 → AD-2, AD-5, migrations 09–10` | Accurate. CAP-5's variance figure (*"reports the difference between its recorded total paid and the sum of (quantity × buying price)"*) is a derived money figure computed outside `modules/reports/`; AD-12 scopes the reports module to *dashboard* queries so this is legal, but it is the one derived money figure not covered by AD-13's netting views. Worth one sentence. |

Rows that are accurate as stated: CAP-1/2 → AD-17, CAP-4 → AD-1/AD-4, CAP-10/11 → AD-8, CAP-13 → AD-18, CAP-14/15 → AD-8/AD-10/AD-11, CAP-18 → AD-7/AD-8/AD-10, CAP-19 → AD-9/AD-10/AD-6, CAP-20 → AD-6/AD-16, CAP-21 → AD-5/AD-9, CAP-22 → AD-12/13/14/15/16, CAP-23 → AD-8/AD-9/AD-10, CAP-24 → AD-18/AD-5.

## Deferred items — divergence check

| Deferred item | Verdict |
| --- | --- |
| Receipt layout and delivery | **Finding — H3.** Named revisit point is *"the CAP-15 / CAP-18 stories"*: two epics, one decision. |
| Frontend state management and routing | **Finding — H7, M11.** Absorbs CAP-12's dedupe/refusal criteria and CAP-9's size-run sequencing, and is contradicted by AD-19.1's binding retry contract. |
| Authorisation matrix per role | Safe. The constants and grouping are fixed in Conventions and the revisit point is a single file (`seed-new-permissions`); which role gets which permission is data, and a divergence is a seeder edit, not an incompatible structure. |
| Which free hosts | Safe on structure. AD-19 fixes the three code-binding consequences and names the one hard requirement (`CREATE EXTENSION btree_gist`). Add two more hard requirements while it is open: the host's Postgres must carry the IANA tz database for `AT TIME ZONE 'Asia/Kolkata'` (AD-6), and must expose both a transaction-mode pooler and a direct connection string (AD-19.3) — otherwise the migration story changes. |
| Backup and restore procedure | Safe as a divergence risk; couples to M12 (AD-17's honest degradation of CAP-2). |
| Observability | Safe. Status quo is stated (`console.log` request logging, `console.error` in the middleware — both verified in `error.middleware.js`), so epics default to the same thing. |
| Identity document at hand-over | Safe. Carried from the spec's own Open Question with an explicit interim rule: *"hand-over captures nothing beyond the customer record until answered."* That is a deferral done correctly. |

## Dimensions this altitude owns and left completely silent

Neither decided, deferred, nor flagged anywhere in the spine:

1. **Rental booking grouping / booking header** — C1.
2. **Write idempotency for retried gestures** — C2, made necessary by AD-19's own rule.
3. **Collection response shape and pagination** — H4.
4. **Snapshot invariant as a rule** — H5 (present only as a naming convention and a diagram note).
5. **Label-geometry configuration and the shape of `app_settings`** — H6.
6. **Case convention for constrained string values** — M3.
7. **Money display formatting and rounding mode** — M10.
8. **Picklist deactivation (`is_active`) as distinct from soft delete** — coverage table, CAP-3.
9. **Health endpoint ownership.** AD-16 exempts keep-warm pinging (*"an **external** uptime monitor hitting a health endpoint"*) and AD-19 depends on it, but no AD, convention, or module in the source tree owns the endpoint.

## Where the spine is right

One line each; no action needed.

- **AD-7** is the strongest decision in the document: a generated `daterange` under a partial `EXCLUDE … USING gist`, correct `'[]'` bounds with the reason given, the advisory query explicitly demoted (*"The constraint, not that query, is the authority"*), and the Sequelize-6 gap called out.
- **AD-8's** compare-and-swap is the right race guard, and its upstream conflict note is correct: a unique index on `sale_lines(unit_id)` genuinely would make CAP-23 impossible, since an exchange leaves the original line non-reversing.
- **AD-13** correctly identifies the highest-value divergence in the system and closes it structurally rather than by discipline.
- **AD-16** is a model of a checkable prohibition, and its keep-warm carve-out is honest rather than a loophole.
- **AD-18's** binding read rule (*"no receipt, sale view, agreement view, or dashboard figure may join to `customers`"*) is the correct mechanism for CAP-24, and the Q21 upstream conflict is real: matching new-vs-returning on `whatsappNumber` does break under erasure.
- **AD-5's** three tiers resolve the CAP-24-vs-never-UPDATE tension cleanly, and *"A row is 'completed' … from the moment it reaches its terminal state, not from the moment it is inserted"* is exactly the sentence that stops two builders drawing the line differently.
- **AD-3's** brownfield claim is accurate — `users_status_check` is built with `queryInterface.addConstraint(… type: 'check' …)` and mirrored in `src/constants/user-status.js`, precisely as described.
- **AD-11's** claim that `error.middleware.js` shapes the error *unchanged* is accurate — the middleware already keys on `error.statusCode` and `error.message`.
- **AD-20's** ordering is sound: `btree_gist` alone and first, `unit_status_events` last among tables so every nullable FK target exists, views at 20 after all tables, indexes at 21.
- **AD-2, AD-12, AD-19.2/19.3** are all enforceable and grep-checkable as written.
