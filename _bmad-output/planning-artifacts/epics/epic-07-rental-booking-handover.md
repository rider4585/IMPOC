## Epic 7: Rental Booking & Handover

Staff can book a rental unit for a date range, collect rent and deposit as held money, and hand the unit over — one receipt per group, no money moving at hand-over. Six stories. **Carried in from the dashboard re-sequencing (Raviraj, this run):** Story 7.6 answers Q22 ("what is booked but not yet collected") from `dashboard-questions.md`, moved here from the (now-relocated) owner-dashboard epic for the same reason Epic 4's Story 4.5 carries Q15 — Q22 is operational, the dashboard itself is deliberately last, and Q22 needs nothing the dashboard epic builds: it is a live-table read over `rental_bookings`, a table this epic's own Story 7.1 creates. Story 7.6 follows the `modules/reports/questions/` pattern Story 4.5 established first, earlier in the build. Story 7.1 is schema-only: it stands up `rental_bookings` with AD-7's generated `daterange` column and partial `EXCLUDE USING gist` constraint — the database fact that makes overlapping windows on one unit impossible, not an application-level check — plus AD-21's `group_uuid` and AD-24's tier-two snapshot of the unit's three rental terms. Story 7.2 is the booking gesture itself: `floor(deposit / overduePerDay)` refuses a window that's too long, a retail-channel unit is refused outright, and rent plus deposit are both collected in full and held — recognised as income nowhere in this epic's code (AD-33 leaves that recognition to a later epic's close events). Story 7.3 is the decision Epic 4 carried forward: now that `rental_bookings` exists, `units.service.transitionUnit()` gains AD-8's booked-unit guard, appended to the ordered pre-write check list Epic 4 built for exactly this purpose. Story 7.4 stands up `rental_agreements`, completing `unit_status_events`' deferred `agreement_id` foreign key the same way Story 5.4 completed `sale_line_id`. Story 7.5 is hand-over: one shared code path advances a booking to `HANDED_OVER`, inserts its agreement, and transitions the unit to `rented` — called directly for an already-booked hand-over, and called a second time in the same transaction, immediately after an inline booking insert, for a walk-in — so there is exactly one hand-over code path regardless of which route reached it. The agreement's `group_uuid` is generated fresh at that call, every time, deliberately never copied from the booking's own `group_uuid`, because a three-unit booking group may legitimately be collected across two different hand-over visits. The one receipt this story renders reuses Story 6.2's renderer unchanged — no second renderer is built.

**UPI payment (this run, 2026-08-29, resolving U-17 against `ARCHITECTURE-SPINE.md`'s AD-39 through AD-42).** Story 7.2's booking gesture and Story 7.5's walk-in hand-over branch were both rewritten to close the same defect `epic-05-cart-customer-checkout.md`'s Story 5.5 closed for retail checkout: `paymentMethod` was previously a plain field written straight to `rental_bookings.payment_method` with no QR step. Both stories now call the exact same shared `POST /api/payments/upi-qr` route (AD-42) Story 5.5 builds — `modules/payments/`'s `payment_ref_seq` (AD-39), `buildUpiLink()` (AD-40), and `paiseToUpiAmount()` (AD-41) — rather than a rentals-specific allocation route of its own; this epic invents nothing new in `modules/payments/`, it only calls what Epic 5 already ships. The mechanism is identical to retail checkout's and is stated once in `epic-05-cart-customer-checkout.md`'s own implementation notes rather than restated here: the route allocates a payment reference and assembles a UPI link before any row exists, writing nothing to any table; the QR renders with nothing written to the database while it is displayed; the cashier's *Mark as received* tap then drives the same commit route each story already specifies, now also carrying the drawn `paymentReferenceCode`, or the method switches to cash before that same commit, or the booking/hand-over is cancelled and nothing is left to delete. An already-booked hand-over is unaffected — it collects no payment at this moment at all, exactly as Story 7.5 already specifies; this rewrite touches only the two request paths that actually collect money, `POST /api/rentals/bookings` and the walk-in branch of `POST /api/rentals/handover`.

### Story 7.1: Create `rental_bookings` — generated `daterange`, partial `EXCLUDE` constraint, and the tier-two rental snapshot

As a developer,
I want the `rental_bookings` table in place — its overlap guard a database fact via a generated `daterange` column and a partial `EXCLUDE USING gist` constraint, never an application-level check — carrying the tier-two snapshot of a unit's rental terms and the `group_uuid` a multi-unit booking shares,
So that Story 7.2's booking gesture has a table whose own constraint makes two overlapping bookings on one unit impossible, closing the race no application code can close on its own (AD-1, AD-3, AD-4/AD-5, AD-7, AD-20, AD-21, AD-24).

**Acceptance Criteria:**

**Given** migration `17-add-exchange-window-snapshot` has already run (Story 6.1)
**When** migration `18-create-rental-bookings` runs
**Then** it creates `rental_bookings` with `id`/`uuid` (AD-1); `group_uuid UUID NOT NULL` (AD-21) — indexed, generated in the service with `crypto.randomUUID()` once per booking gesture, never a column `DEFAULT`; `unit_id INTEGER NOT NULL REFERENCES units(id)`; `customer_id INTEGER NOT NULL REFERENCES customers(id)` plus `customer_name_snapshot VARCHAR NOT NULL` and `customer_whatsapp_snapshot VARCHAR NOT NULL`, copied at booking exactly as `sales` copies them (AD-24 tier two); `start_date DATE NOT NULL` and `end_date DATE NOT NULL` under a named `CHECK (end_date >= start_date)`; `rent_per_day_paise BIGINT NOT NULL`, `deposit_paise BIGINT NOT NULL`, `overdue_per_day_paise BIGINT NOT NULL` — AD-24's tier-two copy of the unit's three rental terms, each under a named `CHECK (... > 0)`; `rent_charged_paise BIGINT NOT NULL CHECK (rent_charged_paise > 0)` — the total rent for the whole window, computed once at booking and never re-derived; `payment_method VARCHAR NOT NULL` under the **same** named `CHECK` set `payment-method.js` already declares (Story 5.4) — `UPI`/`CASH` — reused verbatim rather than redeclared; `state VARCHAR NOT NULL DEFAULT 'OPEN'` under a named `CHECK` restricting it to `OPEN`, `HANDED_OVER`, `SETTLED`, `CANCELLED`, `WRITTEN_OFF` (AD-3); `booked_by_user_id INTEGER NOT NULL REFERENCES users(id)`; `cancelled_at TIMESTAMPTZ NULL`, `cancelled_by_user_id INTEGER NULL REFERENCES users(id)`, `deposit_returned_paise BIGINT NULL CHECK (deposit_returned_paise IS NULL OR deposit_returned_paise >= 0)` — AD-27's cancellation-settlement columns, created now even though no story in this epic ever writes them, exactly as Story 4.1 created `unit_status_events.sale_line_id`/`agreement_id` and Story 5.4 created `sales.reverses_sale_id`/`exchange_of_sale_id` ahead of the epics that use them; `deleted_at TIMESTAMPTZ NULL` (AD-4, though AD-5's append-only-ledger tier means it is never written on this table); and `created_at`/`updated_at`
**And** the same migration adds a generated column exactly as AD-7 specifies — `period daterange GENERATED ALWAYS AS (daterange(start_date, end_date, '[]')) STORED` — via raw SQL (`queryInterface.sequelize.query()`), **not** declared on the Sequelize model, and any attempt to `INSERT` a value into it errors
**And** the same migration runs, also as raw SQL because Sequelize 6's `addConstraint` has no exclusion type: `ALTER TABLE rental_bookings ADD CONSTRAINT rental_bookings_no_overlap EXCLUDE USING gist (unit_id WITH =, period WITH &&) WHERE (state IN ('OPEN', 'HANDED_OVER') AND deleted_at IS NULL)` — bounds are `'[]'`, inclusive both ends, because a piece due back on the 17th is out on the 17th (AD-7) — with a matching raw `ALTER TABLE rental_bookings DROP CONSTRAINT rental_bookings_no_overlap` in the migration's `down()`
**And** the migration's own `down()` also drops the `period` column and the table itself, in dependency order, so the migration is cleanly reversible

**Given** the `rental_bookings_no_overlap` constraint above
**When** two `INSERT`s target the same `unit_id` with overlapping `period` values and both `state IN ('OPEN', 'HANDED_OVER')`
**Then** the second commits and the first — or whichever loses the race — raises a Postgres `23P01` exclusion violation, which `withDbErrors` (AD-11) translates centrally, keyed on the constraint name `rental_bookings_no_overlap`, into a 409; the specific wording and the unit/window the 409 names is Story 7.2's concern, since this story ships no route and no service function, only the schema
**And** an automated test proves the same two `INSERT`s succeed cleanly when their `period` values do not overlap, or when one of the two rows carries `state = 'SETTLED'`, `'CANCELLED'`, or `'WRITTEN_OFF'` — a booking that has finished releases its dates, exactly as `unit-state-machine.md`'s "Booking, distinct from status" section states

**Given** `btree_gist` was already enabled alone as migration `01-enable-btree-gist` (Epic 1)
**When** this migration is reviewed
**Then** it adds no second `CREATE EXTENSION` statement — it relies on the extension Epic 1 already made a hard prerequisite of this host (AD-19, AD-20)

**Given** this story's scope
**When** it is reviewed against Story 7.2
**Then** it ships two migrations' worth of DDL in one migration file, one new model (`RentalBooking`, with `period` excluded from its attribute list), and no route, no controller, and no service function — the booking gesture itself, the retail-channel refusal, and the `floor(deposit / overduePerDay)` maximum-period check are all Story 7.2's concern

### Story 7.2: Book rental units — retail-channel refusal, the maximum-period cap, and rent/deposit held as a liability

As a cashier,
I want to book one or more rental units for a customer's date range in a single counter interaction, paying rent for the whole window plus a deposit — both collected now but recognised as income nowhere in this system yet,
So that a customer walks away with a hold on the exact pieces she wants, and the shop's takings figure is never inflated by money it may still have to return or work for (FR16/CAP-17, AD-7, AD-8, AD-10, AD-16, AD-21, AD-22, AD-23, AD-24, AD-29, AD-33, AD-39–AD-42).

**Acceptance Criteria:**

**Given** migration `26-add-payment-ref-seq-and-sales-reference-code` already created the shared `payment_ref_seq` sequence (Story 5.5, `epic-05-cart-customer-checkout.md`, resolving U-16)
**When** migration `27-add-rental-bookings-payment-reference-code` runs
**Then** it adds `rental_bookings.payment_reference_code VARCHAR NULL` (AD-39), set only when `payment_method = UPI` and never a foreign key to `payment_ref_seq` — the sequence itself is not recreated here; this migration only adds the column this table was missing, the same reasoning Story 5.5 already applied to `sales.payment_reference_code`

**Given** a unit whose `channel` is `RETAIL`
**When** `POST /api/rentals/bookings` includes that unit among its lines
**Then** the **whole** request is refused with a 409 naming the unit before any `INSERT` occurs — *"This piece is a retail item and can't be booked"* — mirroring checkout's per-piece floor refusal in shape: named, specific, and evaluated before any write (`unit-state-machine.md`'s cross-channel rule, CAP-17)

**Given** a unit whose `channel` is `RENTAL` but whose current `status` is anything other than `in_stock`
**When** the same request includes it
**Then** the whole request is refused with a 409 naming the unit and its actual current status — `unit-state-machine.md`'s "Only `in_stock` units ... are bookable for a given window" rule, evaluated fresh inside the transaction, never trusted from whatever the client last displayed

**Given** `POST /api/rentals/bookings` is called with `{ requestUuid, customerUuid, paymentMethod, paymentReferenceCode, units: [{ unitUuid, startDate, endDate }, ...] }` — one array entry per saree in the group, matching Flow 5's three-saree wedding booking — `paymentReferenceCode` present only when `paymentMethod` is `UPI` and a QR was drawn and confirmed for this attempt (see the UPI QR flow below), absent whenever the cashier is paid cash or never chose UPI at all
**When** the service processes it
**Then** it generates exactly one `group_uuid` with `crypto.randomUUID()`, inside the transaction, shared by every `rental_bookings` row this one gesture inserts (AD-21) — never a client-supplied group identifier, and never one `group_uuid` per line
**And** for each line, it re-reads that unit's own `rent_per_day_paise`, `deposit_paise`, and `overdue_per_day_paise` inside the transaction (AD-24 tier two) — never trusting a client-supplied rent or deposit figure — and computes `rentalDays = (endDate − startDate) + 1` via the one shared `rentalDays()` helper this story introduces (AD-23), the same function Epic 8's extension, settlement, and utilisation stories will import unchanged rather than each restating the formula

**Given** a unit whose `rentalDays` for the requested window exceeds `floor(deposit_paise / overdue_per_day_paise)`
**When** that line is evaluated
**Then** the whole request is refused with a 409 naming the unit and stating the arithmetic — *"This deposit covers up to N days"* (`EXPERIENCE.md` State Patterns → Window too long) — where N is the computed `floor(deposit_paise / overdue_per_day_paise)` — evaluated **before** the `INSERT` that would otherwise race against Story 7.1's exclusion constraint, so a too-long window is refused on its own arithmetic and never surfaces as a confusing overlap error instead

**Given** every line in the group has passed the retail-channel, in-stock, and maximum-period checks above, so the group's total `rent_charged_paise + deposit_paise` across every line is now known
**When** the cashier picks **UPI** for this booking
**Then** the client calls the shared `POST /api/payments/upi-qr` (AD-42, built by `epic-05-cart-customer-checkout.md`'s Story 5.5, called here unchanged) with `{ requestUuid, amountPaise }` — the same `requestUuid` this booking attempt's commit call below reuses — and `amountPaise` equal to the group's total rent-plus-deposit (AD-41's "CAP-17/18's rent-plus-deposit sum"), previewed client-side exactly as Story 5.5's retail checkout already previews its own total
**And** the QR renders from the response's `upiLink`; nothing is written to any table while it is displayed — no `rental_bookings` row, no `request_keys` row — matching CAP-17's own general-payment-surface flow

**Given** the QR is on screen and a `paymentReferenceCode` has been allocated
**When** the cashier sees payment succeed and taps **Mark as received**
**Then** `POST /api/rentals/bookings` is called with the same `requestUuid` plus `paymentMethod: 'UPI'` and that `paymentReferenceCode`, and the service re-derives the group's `rent_charged_paise`/`deposit_paise` figures itself, from the same unchanged per-unit terms and windows, rather than trusting the previewed `amountPaise` the QR was drawn from — guaranteed to agree by construction, since nothing about the booking can change between the QR rendering and this tap (AD-41)

**Given** the QR is on screen
**When** UPI is unavailable and the cashier switches to cash
**Then** the QR is dismissed and `POST /api/rentals/bookings` is called with the same `requestUuid`, `paymentMethod: 'CASH'`, and no `paymentReferenceCode` — the drawn reference is never sent, never stored, and `payment_ref_seq` simply gaps by one

**Given** the QR is on screen, or no QR was drawn because cash was chosen from the start
**When** the customer decides not to book and the cashier cancels
**Then** no request is sent to `POST /api/rentals/bookings` at all — nothing was written in any branch until commit, so there is no row of any kind to delete

**Given** the maximum-period check has passed for a line
**When** the service inserts that line's `rental_bookings` row
**Then** it sets `rent_charged_paise = rent_per_day_paise × rentalDays` (the amount collected and held for this line), `state = 'OPEN'`, `payment_method` from the request, `payment_reference_code` from the request's `paymentReferenceCode` when present and `NULL` when the booking commits as cash, and the customer/rental-term snapshot fields described in Story 7.1
**And** a `23P01` exclusion violation on `rental_bookings_no_overlap` for this line — another counter booked the same or an overlapping window first — rolls back the **entire** transaction, including every other line already inserted in this same group, and returns a 409 naming the conflicting unit and the window of the booking it collided with, read back via Story 7.1's advisory availability query before the error is thrown (AD-7, AD-11) — matching Flow 5's *"Booked 15–16 Aug"* refusal exactly, and matching checkout's own all-or-nothing rollback shape on a mid-cart failure

**Given** a unit and a candidate window
**When** `GET /api/rentals/units/:unitUuid/availability` is called
**Then** it returns every non-deleted `rental_bookings` row on that unit with `state IN ('OPEN', 'HANDED_OVER')` — `startDate`, `endDate`, and nothing else — in the `{ items, page, pageSize, total }` envelope (AD-26), so the client can render *"Booked 15–16 Aug"* inline as a saree is scanned and let the cashier see which windows remain free without submitting a doomed booking first (`EXPERIENCE.md` Flow 5, step 3); this query is advisory only, per AD-7 — the `rental_bookings_no_overlap` constraint, not this endpoint, is the authority the commit call above re-checks
**And** the route requires only `authenticate` — it is a read every booking screen needs, gated no further than `RENTALS.VIEW`-holding roles already reach through the booking screen itself

**Given** every line has committed
**When** the money is reviewed
**Then** no code path in this story writes to any income table, view, or column — `rent_charged_paise` and `deposit_paise` sit on `rental_bookings` exactly as this story leaves them, both liabilities until a later epic's close event recognises either as income (AD-33); this story neither computes nor exposes `v_rent_held` or `v_deposits_held` — those views belong to Epic 9

**Given** the `requestUuid` on the request, reused unchanged across this attempt's own `POST /api/payments/upi-qr` call when UPI is chosen
**When** the service handles the commit as the `RENTAL_BOOK` gesture (already enumerated by Story 1.4's `gesture-type.js`)
**Then** it inserts the `request_keys` row last, inside the same transaction, `result_kind: 'RENTAL_BOOKING_GROUP'`, `result_uuid` set to this gesture's `group_uuid` (AD-22's insert-last ordering)
**And** a replay of the same `requestUuid` performs no second line insert and no second CAS-style constraint probe, and returns the original committed group — including each booking's `paymentReferenceCode` when the original commit carried one — with 200, never a 409 naming the unit as "already booked" by its own prior attempt; the earlier `POST /api/payments/upi-qr` call needs no idempotency treatment of its own either way, per AD-42

**Given** `PERMISSIONS.RENTALS.BOOK` (AD-29, held by `CASHIER` and `MANAGER`)
**When** `POST /api/rentals/bookings` is authorized
**Then** it requires `authenticate` and `authorize(PERMISSIONS.RENTALS.BOOK)` — no new permission constant is introduced
**And** `POST /api/payments/upi-qr`, called ahead of this route when UPI is chosen, is reached under this same `RENTALS.BOOK` permission — one of AD-29's four money-in verbs the shared route accepts — introducing no new permission constant of its own; Story 5.5 already built the route under `SALES.CREATE`, and this is simply a second verb the same route already accepts

**Given** this story's scope
**When** it is reviewed against Story 7.5
**Then** it calls `transitionUnit()` for **no** unit — a booked unit's `status` stays `in_stock` throughout (`unit-state-machine.md`'s "Booking, distinct from status"), and `unit-status-cause.js` gains no new cause from this story; hand-over, the transition that finally moves a unit to `rented`, is entirely Story 7.5's concern

### Story 7.3: Wire AD-8's booked-unit guard into `transitionUnit()` — the decision Epic 4 deferred here

As a developer,
I want `units.service.transitionUnit()` to refuse any transition out of `in_stock` other than hand-over while an open booking on that unit covers today or later, naming the blocking booking, its window, and the customer's snapshotted name,
So that a cashier can never mark a booked saree damaged, lost, or retired out from under a customer who has already paid to reserve it — closing exactly the gap Epic 4 left open on the promise that this epic would close it the moment `rental_bookings` existed (AD-8).

**Acceptance Criteria:**

**Given** Story 4.1's guard in `units.service.js`, structured as an ordered list of pre-write checks specifically so a later epic could append to it without touching the CAS statement or any existing check
**When** this story is implemented
**Then** it appends exactly one new check to that ordered list — evaluated for any call whose `expectedFrom` is `IN_STOCK` and whose `to` is **not** `RENTED` — and touches no other check already in the list, no line of the CAS `UPDATE` statement, and no line of the event-insert that follows a successful CAS
**And** `transitionUnit({ unitUuid, to: 'RENTED', ... })` — the hand-over path — is never evaluated against this new check at all, matching AD-8's "any transition out of `IN_STOCK` **other than** the hand-over path" wording exactly; the guard's existing `(channel, from, to)` table already carries `in_stock → rented` as a legal, unrelated pair (Story 4.1), so this story adds no new entry to that table and no new cause to `unit-status-cause.js`

**Given** the new check
**When** it runs for a candidate transition on a unit whose `expectedFrom` is `IN_STOCK` and whose `to` is not `RENTED`
**Then** it queries `rental_bookings` directly for that unit — `SELECT ... WHERE unit_id = :id AND state = 'OPEN' AND end_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date AND deleted_at IS NULL ORDER BY start_date ASC LIMIT 1` (AD-6's shop-day boundary, never the server's local clock) — **before** the CAS `UPDATE` is attempted, so a blocked transition never touches `units` or `unit_status_events` at all
**And** this is the **one sanctioned cross-module table read** named in the architecture spine's dependency-direction rule: `units.service.js` imports the `RentalBooking` Sequelize model directly and reads it, and calls no function on `rentals.service.js` — a call into `rentals.service` from here would close a `require` cycle (`rentals.service` already imports `units.service` to call `transitionUnit()` for hand-over) that fails at module load, not at request time, so this shape is not a style preference but the only one that boots

**Given** a matching row is found
**When** the check refuses the transition
**Then** it throws a 409 **before** the CAS statement runs, naming the blocking booking's own reference, its `startDate`–`endDate` window, and its `customer_name_snapshot` — e.g. *"This piece is booked 14–17 Aug for Priya Sharma. Cancel the booking first."* (`EXPERIENCE.md` State Patterns → Blocked by a live booking) — and this story adds no cancellation path of any kind; resolving the block by cancelling the booking is `RENTALS.CANCEL`'s concern, entirely Epic 8's, and `RENTALS.CANCEL` is `MANAGER` and above (AD-29), so this 409 is deliberately what a `CASHIER` sees and cannot clear alone

**Given** an `OPEN` booking on a unit whose `end_date` is **before** today
**When** a transition out of `in_stock` is attempted on that unit and no other `OPEN` booking on it covers today or later
**Then** the transition is **not** blocked — the check's `end_date >= today` condition excludes it, matching AD-8's "covers today or later" wording literally; a stale unresolved booking that was never cancelled or handed over does not silently freeze a unit forever

**Given** two `OPEN` bookings on the same unit with non-overlapping future windows, both with `end_date >= today` (legal per Story 7.1's exclusion constraint, since neither window overlaps the other)
**When** the check runs
**Then** it names the one with the **earliest** `start_date` in its 409 — the `ORDER BY start_date ASC LIMIT 1` above — so the message is deterministic rather than naming whichever row Postgres happens to return first

**Given** two concurrent calls to `transitionUnit()` against the same unit — one attempting `IN_STOCK → RENTED` (hand-over) and one attempting `IN_STOCK → DAMAGED` while a covering `OPEN` booking exists
**When** both execute at once
**Then** an automated test proves the hand-over call is never blocked by this check regardless of ordering, while the damage call is blocked whenever the booking row is visible to it — this story's test suite exercises the guard directly against `units.service.transitionUnit()`, without depending on Story 7.5's hand-over route, since the guard's correctness does not depend on which caller reaches it

### Story 7.4: Create `rental_agreements`, and complete `unit_status_events`' deferred `agreement_id` foreign key

As a developer,
I want the `rental_agreements` table in place — one row per unit per hand-over, at most one open per unit as a database fact — and the foreign key Story 4.1 deliberately left off `unit_status_events.agreement_id`,
So that Story 7.5's hand-over gesture has a table to write to, and Epic 4's second deferred constraint is closed the moment its target exists, exactly as Story 5.4 closed the first (AD-1, AD-4/AD-5, AD-9, AD-20, AD-24).

**Acceptance Criteria:**

**Given** migration `18-create-rental-bookings` has already run (Story 7.1)
**When** migration `19-create-rental-agreements` runs
**Then** it creates `rental_agreements` with `id`/`uuid` (AD-1); `booking_id INTEGER NOT NULL REFERENCES rental_bookings(id)`; `group_uuid UUID NOT NULL` (AD-21) — indexed, generated fresh in the service at each hand-over gesture, **never copied from `rental_bookings.group_uuid`**, because one booking group may legitimately be collected across two different hand-over visits (Story 7.5's concern to generate it; this story only carries the column); `unit_id INTEGER NOT NULL REFERENCES units(id)`; `rent_per_day_paise BIGINT NOT NULL CHECK (rent_per_day_paise > 0)`, `deposit_paise BIGINT NOT NULL CHECK (deposit_paise > 0)`, `overdue_per_day_paise BIGINT NOT NULL CHECK (overdue_per_day_paise > 0)` — copied forward from the booking's own already-snapshotted values at hand-over, never re-read from `units`, since AD-24 names the booking as the tier-two snapshot and an agreement re-reading `units` here would let a unit's rental terms edited between booking and hand-over quietly disagree with what the customer was actually charged; `start_date DATE NOT NULL` and `due_date DATE NOT NULL`, carried from the booking's `start_date`/`end_date` unchanged; `handed_over_at TIMESTAMPTZ NOT NULL DEFAULT now()`; `returned_at TIMESTAMPTZ NULL`; `written_off_at TIMESTAMPTZ NULL`; `damage_grade_id INTEGER NULL REFERENCES damage_grades(id)`; `damage_charged_paise BIGINT NULL CHECK (damage_charged_paise IS NULL OR damage_charged_paise >= 0)`; `overdue_charged_paise BIGINT NULL CHECK (overdue_charged_paise IS NULL OR overdue_charged_paise >= 0)`; `deposit_returned_paise BIGINT NULL CHECK (deposit_returned_paise IS NULL OR deposit_returned_paise >= 0)`; `settlement_method VARCHAR NULL` under the same `payment-method.js` `CHECK` set `rental_bookings.payment_method` already reuses (Story 7.1) — `UPI`/`CASH` — nullable because it is written only at settlement; `reverses_agreement_id INTEGER NULL REFERENCES rental_agreements(id)`; `deleted_at TIMESTAMPTZ NULL` (AD-4); and `created_at`/`updated_at`
**And** every column this story's own hand-over story (7.5) does not write — `returned_at`, `written_off_at`, `damage_grade_id`, `damage_charged_paise`, `overdue_charged_paise`, `deposit_returned_paise`, `settlement_method`, `reverses_agreement_id` — is created now regardless, exactly as Story 7.1 created `rental_bookings`' cancellation columns ahead of Epic 8, so Epic 8 alters no table this epic already owns
**And** `handed_over_at NOT NULL DEFAULT now()` is deliberate, not incidental: no code path in this build ever constructs a `rental_agreements` row ahead of the hand-over moment, so a row without a hand-over timestamp is not merely disallowed by the schema, it is architecturally impossible — no story in this build ever attempts it

**Given** `domain-model.md`'s rule that `unitId` is unique among agreements neither returned nor written off
**When** the same migration runs
**Then** it adds a named partial unique index `rental_agreements_one_open_per_unit` on `rental_agreements(unit_id) WHERE returned_at IS NULL AND written_off_at IS NULL AND deleted_at IS NULL` (AD-9) — a database fact that a unit cannot be out on two hires at once, and that a written-off piece's slot releases the moment a later recovery and a fresh hand-over reuse it
**And** the same migration also runs `ALTER TABLE unit_status_events ADD CONSTRAINT unit_status_events_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES rental_agreements(id)` — the constraint Story 4.1 left off because `rental_agreements` did not exist yet, added now at the first point in the migration sequence where it does, and validating cleanly against every existing `unit_status_events` row (all with `agreement_id IS NULL`) with no data migration and no row rewritten, exactly as Story 5.4 closed `sale_line_id`

**Given** `rental_agreements` carries no actor column of its own — no `handed_over_by_user_id`, no `settled_by_user_id`
**When** this is reviewed against Story 4.1
**Then** that is deliberate, not an oversight: the actor and timestamp for the unit's own `in_stock → rented` transition are already captured on the `unit_status_events` row this agreement's `id` will be attached to via the FK just added, so a second actor column on the agreement itself would duplicate, and could disagree with, that audit trail

**Given** this story's scope
**When** it is reviewed against Story 7.5
**Then** it ships one migration and one new model (`RentalAgreement`) only — no route, no controller, and no service function; the hand-over gesture that inserts the first row into this table is entirely Story 7.5's concern

### Story 7.5: Hand over rental units — one shared code path for a booked hand-over and a walk-in, one receipt per group

As a cashier,
I want to hand over every unit in a booking (or, for a walk-in with no prior booking, book and hand over in the same visit) and get back one receipt for the whole group, with no payment collected at this moment for an already-booked customer,
So that a customer who already paid at booking simply collects her sarees, and a walk-in customer who didn't book ahead can still leave with a paid, handed-over hire in one visit — using the exact same hand-over logic either way (FR17/CAP-18, AD-8, AD-10, AD-21, AD-22, AD-24, AD-29).

**Acceptance Criteria:**

**Given** `units.service.js` after Story 7.4
**When** this story adds `HANDOVER` to `unit-status-cause.js`, alongside `SALE`, `EXCHANGE_RETURN`, and `EXCHANGE_SALE` from earlier epics
**Then** every `transitionUnit()` call this story makes for the `in_stock → rented` transition uses `cause: 'HANDOVER'` — the cause Story 7.3's guard exempts from its own check by destination status (`to === 'RENTED'`), so this story's addition of the cause constant does not itself need to touch that guard

**Given** a new internal function `rentals.service.js` exports as `advanceBookingsToHandedOver({ bookingIds, actorUserId, groupUuid }, { transaction })` — **not** a route, the one function both routes below call
**When** it runs for each `bookingId` in the array, inside the caller's transaction
**Then** it first CASes the booking's own state — `UPDATE rental_bookings SET state = 'HANDED_OVER' WHERE id = :id AND state = 'OPEN' AND deleted_at IS NULL RETURNING id` (AD-8's booking-state CAS) — and a zero-row return rolls back the **entire** transaction, including every other booking already advanced in this same call, and throws a 409 naming that booking and its actual current state
**And**, on a successful CAS, it inserts that booking's `rental_agreements` row **first** — `booking_id`, the shared `groupUuid` parameter (never generated per-row), `unit_id`, and `rent_per_day_paise`/`deposit_paise`/`overdue_per_day_paise`/`start_date`/`due_date` copied from the booking row (Story 7.4) — and only **then** calls `transitionUnit({ unitUuid, to: 'RENTED', cause: 'HANDOVER', reason: null, actorUserId, agreementId: <the just-inserted agreement's id> }, { transaction })`, mirroring Story 5.5's line-then-transition ordering so the resulting `unit_status_events` row's `agreement_id` is populated at insert time, never backfilled onto an append-only row afterward
**And** a `transitionUnit()` CAS failure — the unit was not actually `IN_STOCK` (already separately marked damaged, say) — rolls back the whole transaction, including the just-inserted agreement and every other booking/agreement advanced in this same call, and returns a 409 naming the unit and its real status

**Given** an existing `OPEN` booking group
**When** `POST /api/rentals/handover` is called with `{ requestUuid, bookingUuids: [...] }`
**Then** the service resolves each `bookingUuid` to its row, generates **one fresh** `group_uuid` with `crypto.randomUUID()` for this hand-over gesture (AD-21 — deliberately not the booking's own `group_uuid`, since a three-unit booking may be collected across two visits and each visit's agreements need their own group), and calls `advanceBookingsToHandedOver` once with all the resolved `bookingId`s and that fresh `group_uuid`, inside one transaction (AD-10)
**And** the request carries **no payment field of any kind** — no `paymentMethod`, no amount — because rent and deposit were already collected at booking (Story 7.2); the response and the eventual receipt both state plainly *"No payment due — rent and deposit were collected at booking"* (`EXPERIENCE.md` Flow 6), and no code path in this branch writes to any money column on any table

**Given** a walk-in customer with no prior booking
**When** `POST /api/rentals/handover` is called with `{ requestUuid, customerUuid, paymentMethod, paymentReferenceCode, units: [{ unitUuid, startDate, endDate }, ...] }` instead of `bookingUuids` — `paymentReferenceCode` present only when UPI was chosen and confirmed, exactly as Story 7.2's own booking request now carries it
**Then** the service, inside **one** transaction, first calls the **exact same** per-unit booking-insert routine Story 7.2's service exports internally (retail-channel refusal, `in_stock`-only check, the `floor(deposit / overduePerDay)` maximum-period cap, the tier-two rental-term snapshot, insertion at `state = 'OPEN'` guarded by Story 7.1's exclusion constraint, and now Story 7.2's own `payment_reference_code` write) to insert one `rental_bookings` row per unit, sharing one booking `group_uuid` exactly as an ordinary multi-unit booking does — **then**, still inside that same transaction, immediately calls `advanceBookingsToHandedOver` with the `bookingId`s it just inserted and one freshly generated agreement `group_uuid` — the identical function the booked-hand-over branch above calls, so there is exactly one function in this codebase that performs the booking-state CAS, the agreement insert, and the `transitionUnit` call, regardless of which branch reached it

**Given** a walk-in's units and windows are known before this transaction opens — the cashier has scanned every piece and set every window on the hand-over screen
**When** the cashier picks **UPI**
**Then** the client calls the same shared `POST /api/payments/upi-qr` (AD-42) Story 7.2 already calls, with `{ requestUuid, amountPaise }` — the same `requestUuid` this hand-over commit reuses, and `amountPaise` the previewed rent-plus-deposit total across every unit in this walk-in group — before `POST /api/rentals/handover` is ever called; nothing is written to any table while the QR is on screen
**And** the same three branches Story 7.2 describes follow here: **Mark as received** calls `POST /api/rentals/handover` with the same `requestUuid`, `paymentMethod: 'UPI'`, and the drawn `paymentReferenceCode`, which the shared booking-insert routine above writes onto every `rental_bookings` row this walk-in group creates; switching to cash dismisses the QR and calls the same route with `paymentMethod: 'CASH'` and no reference; cancelling sends no request at all, since nothing was written in any branch until this transaction actually commits — the already-booked branch above is unaffected by any of this, since it collects no payment at this moment at all
**And** a failure in either half — a retail-channel unit, a too-long window, an overlap, or a hand-over CAS loss — rolls back the **entire** transaction, leaving no booking row, no agreement row, and no unit transition behind; a walk-in's failed attempt produces exactly the same clean rollback a booked hand-over's failed attempt does

**Given** the `requestUuid` on either branch's request
**When** the service handles it as the `RENTAL_HANDOVER` gesture (already enumerated by Story 1.4's `gesture-type.js`) — the walk-in branch is **not** additionally recorded as a `RENTAL_BOOK` gesture, since it is one counter interaction from the cashier's perspective and AD-22 keys the idempotency table on the gesture, not on how many tables the gesture happens to touch
**Then** it inserts the `request_keys` row last, inside the same transaction, `result_kind: 'RENTAL_AGREEMENT_GROUP'`, `result_uuid` set to the fresh agreement `group_uuid` (AD-22's insert-last ordering)
**And** a replay of the same `requestUuid` performs no second CAS on any booking or unit and no second agreement insert, and returns the original committed agreement group with 200, never a 409 naming an agreement as "already handed over" by its own prior attempt

**Given** the hand-over has committed, for either branch
**When** the response is returned
**Then** it carries the agreement `group_uuid` and every agreement in it; no receipt is rendered inside the transaction (AD-10) — rendering happens after commit, from committed rows

**Given** a new `modules/rentals/receipt.service.js` exporting `assembleHandoverReceipt(groupUuid)`
**When** `GET /api/rentals/agreements/group/:groupUuid/receipt` is called after a hand-over commits
**Then** it returns Story 6.2's exact domain-agnostic receipt shape — `{ reference, date, customer, lines[], totals, payment, rentalTerms }` — populating `rentalTerms` for the first time in this build (Epic 6 always left it `null`): `reference` is the `groupUuid` itself; `date` is the earliest `handed_over_at` among the group's agreements; `customer` is read from the first agreement's booking's snapshot fields, never joined to the live `customers` table (AD-18, AD-24); each entry in `lines[]` carries one agreement's unit product/colour/size plus its `rentPerDayPaise`, `depositPaise`, `overduePerDayPaise`, `startDate`, and `dueDate`; `totals` sums `rentChargedPaise` and `depositPaise` across every booking in the group; `rentalTerms` carries the fixed footnote text appropriate to the branch that produced this group — *"No payment due — rent and deposit were collected at booking"* for an already-booked hand-over, or the collected rent/deposit total and `paymentMethod` for a walk-in, distinguishable because a walk-in's underlying bookings were created in the same transaction as this same `group_uuid`'s agreements while a booked hand-over's bookings were created earlier
**And** this shape is handed to Story 6.2's **existing** `modules/receipts/receipt-renderer.js` unchanged — no new PDF-rendering code is written by this story, satisfying Epic 6's own note that "Epic 8's rental hand-over receipt only has to supply its own assembler later, never a second renderer" (which this epic, not Epic 8, turns out to be the one that does)
**And** the frontend's existing `{components.receipt-sheet}` (Story 6.2) renders this shape exactly as it renders a sale receipt, with block 7 — the rental-terms footnote — now actually populated instead of rendering nothing, and the same View/Download PDF/Print channels available (Story 6.3's WhatsApp channel works identically, since it only ever consumed Story 6.2's PDF endpoint)

**Given** `PERMISSIONS.RENTALS.HANDOVER` (AD-29, held by `CASHIER` and `MANAGER`)
**When** `POST /api/rentals/handover` is authorized
**Then** it requires `authenticate` and `authorize(PERMISSIONS.RENTALS.HANDOVER)` for both branches — no new permission constant is introduced, and no additional check distinguishes the walk-in branch from the booked branch, since both are the same gesture under the same permission

### Story 7.6: What is booked but not yet collected (Q22) — a live-table read, no dashboard required

As the owner,
I want to see every open booking that hasn't been collected yet — how many, when each is due for collection, and how much rent and deposit I'm already holding on them,
So that I can plan the floor and follow up on a no-show, without waiting for the dashboard epic to exist (FR21/CAP-22, AD-14, AD-33; Q22).

**Acceptance Criteria:**

**Given** `dashboard-questions.md`'s Q22, moved to this epic by Raviraj's decision (this epic's own implementation notes)
**When** `modules/reports/questions/q22-booked-not-collected.question.js` is written
**Then** `summary()` reads `rental_bookings WHERE state = 'OPEN' AND deleted_at IS NULL` directly, returning `{ bookingCount, rentHeldPaise: SUM(rent_charged_paise), depositHeldPaise: SUM(deposit_paise) }` — filtered to `state = 'OPEN'` alone, excluding `HANDED_OVER`, since a handed-over booking has already been collected and belongs to Epic 8's Story 8.6 (Q11), not here; no `from`/`to`, point-in-time, matching AD-14's list
**And** `lines()` returns each `OPEN` booking, paginated, sorted by `start_date` (the collection/hand-over date) ascending, each row's deposit and rent-held figures read straight off that same `rental_bookings` row — `deposit_paise` and `rent_charged_paise` are already columns on the row this query selects, so no join to any view or any other table is needed for either figure, unlike the shape this question was originally drafted against in the (now-relocated) dashboard epic, which would have joined `v_deposits_held`; that view does not exist at this point in the build, and this story does not depend on it existing

**Given** this question's shape once the dashboard epic eventually exists
**When** that epic's own implementation notes are read
**Then** they state plainly that Q22 is already delivered, here, and must not be rebuilt

**Given** `GET /api/reports/rentals/booked-not-collected/summary` and `GET /api/reports/rentals/booked-not-collected/lines`
**When** either is called
**Then** both require `authenticate` and `authorize(PERMISSIONS.RENTALS.VIEW)` (AD-29, already held by `CASHIER`, `MANAGER`, and `ACCOUNTANT` per Story 7.2's own precedent for gating a rental read) — no new permission constant is introduced, and no `requestUuid` is required or accepted, since neither route mutates anything

