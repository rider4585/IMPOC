## Epic 4: Unit Lifecycle, Recovery & Loss Management

Staff can move a unit through damaged/lost/retired/maintenance transitions and recover a lost item without corrupting stock value or money.

**Frontend added this run (Stories 4.6-4.10), continuing the frontend restructure that began with Epic 1's Stories 1.10-1.17, Epic 2's Stories 2.5-2.8, and Epic 3's Stories 3.7-3.12:** the Units list and unit detail screen - which also stands up the shared `{components.status-pill}` component UX-DR3 names, the first screen in this build to render a unit's status at all - mark damaged/lost, resolve out of maintenance, recover a lost unit (`MANAGER`/`ADMIN` only, mandatory reason, explicit no-money-moves statement), and the Workshop list answering Q15, wired so a unit resolved out of maintenance from the unit detail screen drops off the workshop list on its next fetch rather than sitting there as an orphaned report. Every screen imports Epic 1's `platform/money.js`, `platform/envelope.js`, and `platform/wakingRequest.js` rather than reimplementing any of the three; every list is paginated per AD-26; every action's visibility is driven by the same permission constants its backend route checks, never a role-name test. **This epic's acceptance bar, matching Epic 1's own:** after Story 4.10, Raviraj can look up any unit, act on its lifecycle, recover a lost piece properly gated to management, and see the workshop queue - all from the app, none of it API-only. This epic stands up `units.service.transitionUnit()` — the sole writer of `units.status`, `units.channel`, the three rental snapshot columns, and `unit_status_events` (AD-8) — as its own story, since every later epic that moves a unit (cart refusal, checkout, exchange, hand-over, return, write-off, recovery) calls into it rather than writing `units.status` directly. **Carried in from the dashboard re-sequencing (Raviraj, this run):** Story 4.5 answers Q15 ("what is in the workshop") from `dashboard-questions.md`. Q15 was originally written as one of the 27 questions inside the (now-relocated) owner-dashboard epic, but the owner decided the dashboard itself should move to the very end of the build, after deployment, so it can be designed once the shop has actually been run — while Q15 is operational, not analytical, and the shop cannot be run without it. The architecture's read side (AD-12/AD-13's six plain views, the reports module scaffolding Story 12.3 builds) does not exist yet at this point in the build, so Story 4.5 is written, like Epic 8's pre-existing Story 8.4 (Q12/Q26), as a hand-written query directly over live tables — it answers Q15 in full at no infrastructure cost and needs nothing from the eventual dashboard epic. Story 4.5 is in fact the **first** `modules/reports/questions/` file this build creates, ahead of Story 8.4 in build order (Epic 4 precedes Epic 8); Story 8.4's own text, unchanged by this run, still says it is "the first work in `modules/reports/` this build has needed" — that sentence is now a known stale claim, left as Epic 8's own concern to correct when that epic's stories are next touched, exactly as this epic once carried forward a note for Epic 7 to correct. **Resolved dependency on Epic 3:** Story 3.3 (Epic 3) already inserts into `unit_status_events` as part of unit creation, which means that table must exist by Epic 3's migration 12 (`units`) — earlier than the Requirements Inventory's migration-order note implies (it lists "unit status events" after `rental_bookings`/`rental_agreements`). This epic resolves the tension rather than building against a table that doesn't exist yet: Story 4.1's migration creates `unit_status_events` immediately after `units` (migration 13), with its `sale_line_id`/`agreement_id` columns present but unconstrained by an FK until Epic 5 and Epic 7/8 each add their own FK constraint once `sale_lines`/`rental_agreements` exist — the later position in the Requirements Inventory's note describes when those FK constraints become addable, not when the table itself is created. **Resolved dependency on Epic 7:** AD-8's booked-unit guard needs `rental_bookings`, which Epic 7 creates. Rather than shipping a guard here that queries a table that doesn't exist, `transitionUnit()`'s guard is built as an ordered list of pre-write checks that Epic 7 extends with the booked-unit predicate once both the table and the check can be built together — there is never a period where a live booking exists and this guard silently misses it, because no booking can exist before Epic 7 ships. This decision is recorded here and must be carried into Epic 7's own implementation notes when that epic's stories are written. Recovery (Story 4.4) is `ADMIN`/`MANAGER`-only via the new `INVENTORY.RECOVER_LOST` permission (AD-29), takes a mandatory reason that is never defaulted, restores stock value, and reverses no money (AD-35) — one arc, applying identically to a retail piece and a rental one. A `LOST → RETIRED` recovery is written as one `unit_status_events` row, never two, so its shrinkage nets to zero while the recovery itself still shows as its own line later on the dashboard (Epic 9); this epic stores no derived shrinkage or recovery-value column of its own, leaving both to be computed at read time from `units.buying_price_paise` and this event's own `from_status`/`to_status`/`cause`, exactly as AD-13 and AD-35 require.

### Story 4.1: Create unit_status_events and stand up units.service.transitionUnit() as the sole writer

As a developer,
I want a single exported `transitionUnit()` function that is the only code path allowed to change a unit's status, channel, rental snapshots, and `unit_status_events` history,
So that every later epic that moves a unit shares one atomic compare-and-swap and one audit trail instead of each writing `units.status` directly (FR10/CAP-10, AD-8, NFR6).

**Acceptance Criteria:**

**Given** migration `12-create-units` has already run
**When** migration `13-create-unit-status-events` runs
**Then** it creates `unit_status_events` with `id`/`uuid` (AD-1), `unit_id INTEGER NOT NULL REFERENCES units(id)`, `from_status VARCHAR NULL` and `to_status VARCHAR NOT NULL`, each under the same status `CHECK` set as `units.status` (AD-3), `cause VARCHAR NOT NULL` under a named `CHECK` restricting it to a fixed set, `reason TEXT NULL`, `actor_user_id INTEGER NOT NULL REFERENCES users(id)`, `occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `sale_line_id INTEGER NULL` and `agreement_id INTEGER NULL` with no FK constraint yet — the referenced tables don't exist until Epic 5 and Epic 7/8 — plus a named `CHECK (sale_line_id IS NULL OR agreement_id IS NULL)`, `deleted_at TIMESTAMPTZ NULL` (AD-4, though AD-5's append-only-ledger tier means this column is never written on this table), and `created_at`/`updated_at`
**And** a named `CHECK (cause <> 'RECOVERY' OR reason IS NOT NULL)` exists as the database backstop behind the service-level mandatory-reason rule (AD-35)
**And** this table is created here — immediately after `units` — rather than at the later position "unit status events" holds in the Requirements Inventory's migration-order note, because Story 3.3 already inserts into it as part of unit creation; that note's later position describes when the optional `sale_line_id`/`agreement_id` FK constraints become addable, not when the table itself is created

**Given** a new `unit-status-cause.js` constants module
**When** it is inspected
**Then** it enumerates every cause this build issues a transition under — `INTAKE` (already used by Story 3.3), `STAFF_MARKED_DAMAGED`, `STAFF_MARKED_LOST`, `MAINTENANCE_COMPLETE`, `BEYOND_REPAIR`, `RECOVERY` — even though this epic's own stories call only five of them; later epics add their own causes (sale, exchange, hand-over, return, write-off) to this same module rather than inventing a second one

**Given** `units.service.js`'s new `transitionUnit({ unitUuid, to, reason, actorUserId, cause }, { transaction })`
**When** it is called
**Then** it resolves `unitUuid` to the unit's internal `id` and current `channel`, looks up the legal `expectedFrom` status for `(channel, cause, to)` in one table-driven guard object covering the **complete** `(channel, from, to)` set from `unit-state-machine.md` for both channels — not only the transitions this epic's own stories call — and executes exactly one statement: `UPDATE units SET status = :to WHERE id = :id AND status = :expectedFrom AND deleted_at IS NULL RETURNING id`
**And** on a non-zero return, in the same transaction, it inserts one `unit_status_events` row carrying `fromStatus`, `toStatus`, `reason`, `actorUserId`, `cause`, and (when supplied) `saleLineId`/`agreementId` — the unit's new status and its audit row commit together or neither does
**And** on a zero-row return, it re-reads the unit's actual current status and throws a 409 naming the barcode and that real status, per CAP-10's "current status named in the error"

**Given** the guard table
**When** it is inspected
**Then** it carries `LOST → IN_STOCK`, `LOST → IN_MAINTENANCE` and `LOST → RETIRED` for both channels as reachable **only** under `cause: 'RECOVERY'` — a call naming one of those three `(from, to)` pairs under any other cause is refused by the guard before any `UPDATE` is attempted, independent of the unit's actual current status

**Given** the guard table is inspected for transitions this epic does not itself call — `in_stock → sold`, `in_stock → rented`, `sold → in_stock`, `rented → in_stock`/`in_maintenance`/`retired`/`lost`
**When** it is reviewed
**Then** those `(channel, from, to)` pairs are present and legal in the guard, ready for Epic 5 through Epic 8 to call — AD-8 specifies **one** table-driven guard for the whole state machine, built once here rather than grown piecemeal by every later epic that needs a new pair added

**Given** AD-8's booked-unit guard — refusing a transition out of `in_stock` other than hand-over while an open booking on the unit covers today or later, naming the blocking booking, its window, and the customer's snapshotted name
**When** `transitionUnit()` is built by this story
**Then** that predicate is **not implemented here** — it requires reading `rental_bookings`, which does not exist until Epic 7. The guard's checks run as an ordered list of pre-write predicates so Epic 7 can append the booked-unit predicate to that list without touching the CAS statement or any check this story adds. Epic 7 is the epic that both creates `rental_bookings` and wires this predicate in, so there is never a point where a live booking exists and this guard fails to see it

**Given** two concurrent calls to `transitionUnit()` against the same unit, each naming a different legal transition from the unit's current status
**When** both execute at once
**Then** an automated test proves exactly one `UPDATE` returns a row and commits its event; the other returns zero rows, is told the unit's now-different real status, and rolls back

**Given** the codebase after this story
**When** it is searched for `UPDATE units SET status` and `INSERT INTO unit_status_events`
**Then** no module other than `units.service.js` contains either statement — an automated test (or, if a code-search test proves impractical, a documented manual check) confirms it, and Story 3.3's creation-time insert continues to route through `units.service.js` exactly as it already does, unchanged by this story

**Given** a unit exists
**When** `GET /api/units/:uuid` is called
**Then** it returns the unit's `uuid`, `barcode`, `status`, `channel`, colour/size (as their `uuid`s), and its price/rental snapshots — never an internal `id` (AD-1)

**Given** a unit has one or more `unit_status_events` rows
**When** `GET /api/units/:uuid/status-events` is called
**Then** it returns them newest-first in the `{ items, page, pageSize, total }` envelope (AD-26), each item carrying `fromStatus`, `toStatus`, `cause`, `reason`, `occurredAt`, and the acting user's name — never the actor's internal `id`

**Given** a barcode
**When** `GET /api/units/by-barcode/:barcode` is called
**Then** it returns the matching non-deleted unit's detail (as `GET /api/units/:uuid` does), or a 404 naming the barcode if none is bound to it — the lookup shape CAP-7's refusal already relies on internally, now exposed as its own route for a manager finding a unit by barcode (Flow 10)

**And** all four routes require only `authenticate` — they are reads over data every operating screen already needs

### Story 4.2: Mark a unit damaged or lost

As an inventory manager,
I want to take a piece out of circulation by marking it damaged or marking it lost,
So that a piece unfit for sale or missing from the floor stops appearing as available stock, with a durable record of who did it and when (FR11/CAP-11, AD-8).

**Acceptance Criteria:**

**Given** a unit currently `in_stock`, on either channel
**When** `POST /api/units/:uuid/mark-damaged` is called with a `requestUuid`
**Then** the service treats it as the `UNIT_TRANSITION` gesture (AD-22) and, inside one transaction it opens, calls `transitionUnit({ unitUuid, to: 'DAMAGED', cause: 'STAFF_MARKED_DAMAGED', reason, actorUserId }, { transaction })`, inserting the `request_keys` row last
**And** on success the unit's `status` becomes `damaged` and one `unit_status_events` row records the transition

**Given** a unit currently `in_stock`
**When** `POST /api/units/:uuid/mark-lost` is called with a `requestUuid`
**Then** the same shape applies with `to: 'LOST'`, `cause: 'STAFF_MARKED_LOST'` — per AD-34, this is the only way a unit becomes `lost` off the retail floor or off a rental unit with no live agreement; a `rented` unit's own path to `lost` is the write-off gesture (Epic 8's concern), not this route

**Given** a unit whose current status is anything other than `in_stock` — already `damaged`, `sold`, `rented`, etc.
**When** either route is called
**Then** `transitionUnit()`'s guard refuses it with a 409 naming the barcode and the real current status, and no row is written

**Given** `reason` is omitted on either call
**When** the request is validated
**Then** it is accepted — a reason is optional for these two transitions, unlike recovery's mandatory one (AD-35) — though it is stored when supplied

**Given** a request replays a `requestUuid` already recorded against the `UNIT_TRANSITION` gesture for this unit
**When** it is received
**Then** no second `transitionUnit()` call is made, and the original result is returned unchanged

**Given** AD-8's booked-unit guard is not yet implemented (Story 4.1's note)
**When** either route is called against a unit that, from Epic 7 onward, could have a live booking
**Then** no such check runs in this epic — `rental_bookings` does not exist yet, so no live booking can exist to be silently bypassed; this is safe only because Epic 7 builds the table and the check together, and this note exists so nobody reads the absence of a check here as an oversight

**And** both routes require `authenticate` and `authorize(PERMISSIONS.INVENTORY.UPDATE)` — the existing generic inventory permission; NFR15 enumerates no dedicated constant for marking a unit damaged or lost

### Story 4.3: Resolve a unit out of maintenance

As an inventory manager,
I want to move a piece out of maintenance once work is finished or once it's confirmed beyond repair,
So that a mended piece returns to sellable/rentable stock and an unsalvageable one is retired, both with a durable record (FR11/CAP-11).

**Acceptance Criteria:**

**Given** a unit currently `in_maintenance`
**When** `POST /api/units/:uuid/maintenance-complete` is called with a `requestUuid`
**Then** the service treats it as the `UNIT_TRANSITION` gesture and calls `transitionUnit({ unitUuid, to: 'IN_STOCK', cause: 'MAINTENANCE_COMPLETE', reason, actorUserId }, { transaction })`, following the same one-transaction, insert-request-keys-last shape as Story 4.2
**And** the unit's frozen price/rental snapshots (AD-5) are untouched by this transition — only `status` changes

**Given** a unit currently `in_maintenance`
**When** `POST /api/units/:uuid/retire` is called with a `requestUuid`
**Then** the same shape applies with `to: 'RETIRED'`, `cause: 'BEYOND_REPAIR'`

**Given** a unit whose current status is anything other than `in_maintenance`
**When** either route is called
**Then** `transitionUnit()`'s guard refuses it with a 409 naming the barcode and the real current status

**Given** `in_maintenance` is reached, on the retail channel, only as a recovery destination (`unit-state-machine.md`), and on the rental channel only via a return graded repairable (Epic 8)
**When** this story is implemented
**Then** neither route cares how the unit arrived at `in_maintenance` — the guard's `expectedFrom` is `in_maintenance` regardless of which earlier epic's transition put it there, so this story carries no dependency on Epic 8 shipping first

**And** `reason` is optional on both calls, exactly as in Story 4.2

**And** both routes require `authenticate` and `authorize(PERMISSIONS.INVENTORY.UPDATE)`, matching Story 4.2

### Story 4.4: Recover a lost unit

As a manager,
I want to bring a unit back from `lost` to stock, maintenance, or retirement with a mandatory reason,
So that a piece that turns up again is trackable and the shop's stock value is corrected, without touching any money the shop has already recognised (FR11/CAP-11, AD-29, AD-34, AD-35).

**Acceptance Criteria:**

**Given** the `INVENTORY.RECOVER_LOST` permission does not yet exist
**When** a scoped seeder migration runs
**Then** it adds `INVENTORY.RECOVER_LOST` (`'inventory.recover_lost'`) to `backend/src/constants/permissions.js` and grants it to exactly `ADMIN` and `MANAGER` — not `INVENTORY_MANAGER`, not `CASHIER`, not `ACCOUNTANT` (AD-29) — this migration is scoped to this one permission only, per Story 1.7's precedent, not the full `seed-new-permissions` migration other epics contribute their own groups to

**Given** a unit currently `lost`, on either channel
**When** `POST /api/units/:uuid/recover` is called with `{ destination, reason, requestUuid }` where `destination` is one of `IN_STOCK`/`IN_MAINTENANCE`/`RETIRED`
**Then** the service treats it as the `UNIT_RECOVER` gesture (AD-22) and calls `transitionUnit({ unitUuid, to: destination, cause: 'RECOVERY', reason, actorUserId }, { transaction })` exactly once, inside one transaction, inserting the `request_keys` row last
**And** the same route and the same three destinations apply unchanged whether the unit's channel is `RETAIL` or `RENTAL` — AD-35 states recovery exists identically for both, with no channel-specific branch beyond `transitionUnit()`'s ordinary `(channel, from, to)` lookup

**Given** `reason` is blank, missing, or whitespace-only
**When** the recovery request is validated
**Then** it is rejected before `transitionUnit()` is ever called — no default reason is substituted, and no row is written (AD-35's "never defaulted")

**Given** a user holding `INVENTORY_MANAGER`, `CASHIER`, or `ACCOUNTANT` but not `INVENTORY.RECOVER_LOST`
**When** they call the recover route
**Then** the response is 403 — an automated test confirms `INVENTORY_MANAGER` specifically is refused, since that role holds the rest of the inventory set and would be the easiest role to wrongly grant this to

**Given** `destination` is `RETIRED` on a unit currently `lost`
**When** `POST /api/units/:uuid/recover` succeeds
**Then** exactly **one** `unit_status_events` row is written — `fromStatus: 'LOST'`, `toStatus: 'RETIRED'`, `cause: 'RECOVERY'` — and the service never issues two chained calls (recover-to-`IN_STOCK` then a separate retire); an automated test asserts the unit's history gains exactly one row for this action, not two (AD-35, `domain-model.md`)

**Given** a recovery of any destination
**When** it succeeds
**Then** no row is written to `sales`, `sale_lines`, `expenses`, or (once they exist) `rental_bookings`/`rental_agreements` — the recovery's entire effect is the one `unit_status_events` row and the unit's `status` column; there is nothing to reverse, because AD-35 says the money is never reversed
**And** no column is added anywhere to store a "recovery value" or a zeroed shrinkage figure directly — the figure a later epic's dashboard will show (the unit's snapshotted `buying_price_paise`) and the figure that nets to zero on a `LOST → RETIRED` recovery (`shrinkage_paise`) are both derived at read time by that epic's report view (AD-13), by joining to `units.buying_price_paise` and to this event's own `from_status`/`to_status`/`cause` — this story stores neither as its own column

**Given** a unit recovered to `IN_STOCK` that was previously on a rental agreement written off under AD-32
**When** the recovery completes
**Then** the unit is immediately bookable again by Epic 7's stories with no residue — its former booking and agreement already left AD-7's `EXCLUDE` predicate and AD-9's `agreements_one_open_unit` index when the write-off happened, so this story touches neither table

**And** the route requires `authenticate` and `authorize(PERMISSIONS.INVENTORY.RECOVER_LOST)`

### Story 4.5: What is in the workshop (Q15) — a live-table read, no dashboard required

As the owner,
I want to see what's in the workshop right now — how many pieces, how long each has been there, and what I've spent keeping it there,
So that I can act on a slow repair without waiting for the dashboard epic to exist (FR21/CAP-22, AD-6, AD-14; Q15).

**Acceptance Criteria:**

**Given** `dashboard-questions.md`'s Q15, moved to this epic by Raviraj's decision (this epic's own implementation notes)
**When** `modules/reports/questions/q15-in-workshop.question.js` is written
**Then** it reads `units WHERE status = 'IN_MAINTENANCE' AND deleted_at IS NULL` directly (the same partial index Story 4.1's guard table and Epic 3's intake work already rely on `units.status` for), joined to `unit_status_events use ON use.unit_id = u.id AND use.to_status = 'IN_MAINTENANCE' AND use.deleted_at IS NULL` for `MAX(use.occurred_at)` per unit — the unit's **latest** transition into maintenance, never its first, since only the current stay is what "how long has it been there" asks — and it reads `expenses` directly, **not** through any view, for lifetime upkeep spend against each unit
**And** the `expenses` read replicates the same reversal-exclusion shape the eventual `v_net_expenses` view will formalise (a corrected expense contributes zero rows, not two that sum to zero): `SELECT unit_id, SUM(amount_paise) FROM expenses e WHERE e.category = 'RENTAL_UPKEEP' AND e.deleted_at IS NULL AND e.reverses_expense_id IS NULL AND NOT EXISTS (SELECT 1 FROM expenses r WHERE r.reverses_expense_id = e.id AND r.deleted_at IS NULL) GROUP BY unit_id` — this story writes that clause inline rather than importing it from anywhere, because nothing to import exists yet at this point in the build, the same reasoning Story 8.4 already states for restating its own overdue formula as SQL rather than calling into a service
**And** `summary()` takes **no** `from`/`to` — point-in-time, like Q7 and Q8 — and returns `{ unitCount, byUnit: [{ unitId, daysInWorkshop, upkeepSpentPaise }] }`; `lines()` returns the same `byUnit` rows, paginated, in the `{ items, page, pageSize, total }` envelope (AD-26)

**Given** this question's shape once the dashboard epic eventually exists
**When** that epic's own implementation notes are read
**Then** they state plainly that Q15 is already delivered, here, and must not be rebuilt — a dashboard card may point at this route's existing JSON shape, but no second `q15-*.question.js` file is ever written

**Given** `GET /api/reports/inventory/workshop/summary` and `GET /api/reports/inventory/workshop/lines`
**When** either is called
**Then** both require `authenticate` and `authorize(PERMISSIONS.INVENTORY.VIEW)` — the existing generic inventory-viewing permission (pre-existing, per this epic's own precedent of not inventing a dedicated constant for an ordinary read) — and no `requestUuid` is required or accepted, since neither route mutates anything

### Story 4.6: Units list and unit detail screen, with the shared status-pill component

As an inventory manager,
I want to browse and filter all units, and open one to see its status, history, and price snapshots,
So that I have one screen to find a piece and see everything about it before acting on it (FR10/CAP-10, UX-DR3).

**Acceptance Criteria:**

**Given** no `/units` route exists yet
**When** this story is implemented
**Then** `navigation.js` gains `{ permission: PERMISSIONS.INVENTORY.VIEW, label: 'Units', path: '/units', element: UnitsScreen }` — gated on the read-oriented `inventory.view` permission rather than `inventory.create`, since Story 4.1's `GET /api/units` and `GET /api/units/:uuid` routes themselves require only `authenticate`, and this is a lookup surface useful to more roles than the create/update-gated Picklists and Vendors screens (today's seeded `CASHIER` already holds `inventory.view`, so this is a deliberate, narrower gate than Epic 2's screens, not an oversight)
**And** a nested `/units/:uuid` route renders `UnitDetail.jsx`, guarded by the same `inventory.view` check

**Given** `GET /api/units` returns units in the `{ items, page, pageSize, total }` envelope (AD-26)
**When** `UnitsScreen.jsx` loads
**Then** it lists units paginated per AD-26 (50/page, skeleton rows while loading), filterable by status, product type, lot, and vendor via query parameters the screen appends to the request — this story assumes the filter parameters `GET /api/units` accepts follow the same naming convention as its own response fields (`status`, `productTypeUuid`, `stockIntakeLineUuid`, `vendorUuid`), and a mismatch surfaces as a visible "results may be incomplete" state rather than a silent empty list, since this story does not itself re-specify the backend's filter contract
**And** each row shows the unit's barcode in `{typography.barcode}`, colour, size, and its `{components.status-pill}`

**Given** this is the first screen in the frontend codebase to render a unit's status
**When** this story is implemented
**Then** it builds `frontend/src/components/StatusPill.jsx` as the shared, reusable component UX-DR3 names — consuming `DESIGN.md`'s six `{colors.status-*}` tokens (`status-in-stock`, `status-rented`, `status-overdue`, `status-sold`, `status-maintenance`, `status-terminal`) at 14% alpha fill behind the token at full strength per `{components.status-pill}`'s spec, always rendering a text label alongside the colour — never colour alone — and every later screen in this build that shows a unit's status imports this component rather than rendering its own; **Epic 3's Story 3.12 shipped earlier in build order and could not import this component, since it did not yet exist — that screen's plain-text status rendering already satisfies the same accessibility rule on its own terms and is not retrofitted to this component by this story**
**And** the six-way mapping from `unit.status` (and the derived `overdue` condition, not a stored value) to a status-pill variant is centralised in one `statusPillVariant(unit)` helper this component exports, so no future screen re-derives the mapping independently

**Given** `GET /api/units/:uuid` (Story 4.1)
**When** `UnitDetail.jsx` loads
**Then** it renders the unit's barcode, `{components.status-pill}`, colour, size, channel, and its price/rental snapshots (buying/selling/floor price, and — for a rental unit — rent-per-day/deposit/overdue-per-day) each formatted through `formatPaise()`, never a raw paise integer or an ad hoc division

**Given** `GET /api/units/:uuid/status-events` (Story 4.1), paginated per AD-26
**When** the detail screen renders its history section
**Then** it lists events newest-first — from-status, to-status, cause, reason (when present), `occurredAt`, and the acting user's name — this **is** the "per-unit ledger" the IA names for this screen, paginated exactly as any other list in this build, with no "show all" affordance

**Given** `GET /api/units/by-barcode/:barcode` (Story 4.1)
**When** a manager searches this screen by barcode directly (a manual-entry field beside the filter controls, not a live camera — this screen is a lookup surface, not a scan surface, so it carries no viewfinder)
**Then** the search resolves through this route, landing directly on `UnitDetail.jsx` on a match, or showing an inline "no unit bound to this barcode" message naming the searched value on a 404 — never a bare "not found"

**And** automated tests cover: `{components.status-pill}` renders the correct colour/label pair for each of the six variants including derived overdue; the units list paginates and filters; the detail screen renders price snapshots through `formatPaise()`; the status-events history paginates newest-first; and a barcode search resolves to the matching unit or shows the named-barcode not-found message

### Story 4.7: Unit detail screen - mark a unit damaged or lost

As an inventory manager,
I want to mark an in-stock piece damaged or mark it lost from its own detail screen,
So that a piece unfit for sale or missing from the floor stops appearing as available stock, with a durable record of who did it and when (FR11/CAP-11).

**Acceptance Criteria:**

**Given** `UnitDetail.jsx` (Story 4.6) for a unit currently `in_stock`
**When** the screen renders
**Then** two actions appear — *Mark damaged* and *Mark lost* — both in `{components.button-danger}` per `DESIGN.md`'s rule that button-danger is reserved for exactly this kind of action, and both absent (not disabled) for a unit whose current status is anything other than `in_stock` — this is a client-side courtesy mirroring `transitionUnit()`'s own guard, not a replacement for it; the server's 409 refusal (Story 4.2) is still what actually protects the transition if a stale screen is acted on anyway

**Given** either action is tapped
**When** a confirmation sheet opens
**Then** it carries an optional `reason` free-text field (Story 4.2's own "reason is optional... though stored when supplied") and a commit button reading *Mark damaged* or *Mark lost* — the verb the button writes, per `DESIGN.md`'s "every button carries a verb naming what it writes" rule

**Given** the commit is tapped
**When** the request is sent
**Then** the screen mints a `requestUuid` via `platform/requestKey.js`'s `createRequestKey()` at the moment the confirmation sheet opens — not earlier — reused unchanged across any retry of this same attempt, and calls `POST /api/units/:uuid/mark-damaged` or `.../mark-lost` (Story 4.2) through `platform/wakingRequest.js`, surfacing `{components.waking-banner}` at 1200ms exactly as every other gesture in this build does

**Given** the unit's status has changed since the screen loaded (someone else already acted on it)
**When** the server returns its 409
**Then** the confirmation sheet shows the server's own message naming the barcode and the unit's real current status, and the sheet does not close automatically — the inventory manager reads the new status before deciding what to do next, rather than the screen silently discarding their attempted action

**Given** the commit succeeds
**When** the response returns
**Then** `UnitDetail.jsx`'s `{components.status-pill}` updates immediately to `damaged` or `lost`, the new event appears at the top of the status-events history without a full page reload, and the sheet closes

**Given** `UnitsScreen.jsx`'s list (Story 4.6) shows the same unit
**When** the list is next fetched (on return navigation, or on its own periodic refresh — this story adds no live-push mechanism, since NFR10 rules out any such layer)
**Then** the pill reflects the new status, consistent with the detail screen — no separate client-side cache exists for this build to keep synchronised beyond an ordinary refetch on navigation

**And** automated tests cover: both actions are absent for a non-`in_stock` unit; the optional reason field submits when filled and omits cleanly when blank; a stale-status 409 shows the server's own message without closing the sheet; and a successful mark updates the status pill and history without a reload

### Story 4.8: Unit detail screen - resolve a unit out of maintenance

As an inventory manager,
I want to move a piece out of maintenance once work is finished, or mark it beyond repair,
So that a mended piece returns to sellable/rentable stock and an unsalvageable one is retired, both with a durable record (FR11/CAP-11).

**Acceptance Criteria:**

**Given** `UnitDetail.jsx` for a unit currently `in_maintenance`
**When** the screen renders
**Then** two actions appear — *Maintenance complete* (a neutral commit, `{components.button-primary}`, since it is a positive outcome, not a loss) and *Retire — beyond repair* (`{components.button-danger}`, since it permanently removes value from stock) — both absent for a unit whose status is anything other than `in_maintenance`, the same client-side courtesy pattern Story 4.7 establishes

**Given** either action is tapped
**When** a confirmation sheet opens
**Then** it mirrors Story 4.7's shape exactly — optional reason field, verb-named commit button, `requestUuid` minted at sheet-open, `POST /api/units/:uuid/maintenance-complete` or `.../retire` (Story 4.3) through `platform/wakingRequest.js` — this story reuses the same confirmation-sheet component Story 4.7 builds (`TransitionConfirmSheet.jsx`) rather than building a second one, parameterised by the action's verb, destination status, and button variant

**Given** a unit reaches `in_maintenance` from more than one path across this build (a recovery destination today, a repairable rental return once Epic 8 exists)
**When** this screen renders its two actions
**Then** it does not care how the unit arrived at `in_maintenance` — the same two actions apply regardless, matching Story 4.3's own "neither route cares how the unit arrived" statement

**Given** the unit currently sits on Story 4.10's workshop list (this epic's own Q15 screen)
**When** *Maintenance complete* or *Retire* succeeds from this screen
**Then** the unit disappears from that list on its next fetch — Story 4.10's list is a live read over `units WHERE status = 'IN_MAINTENANCE'`, so a status change here is reflected there without any explicit wiring beyond both screens reading current server state, closing the loop this epic's brief asked for ("wire it into these screens rather than leaving it as an orphan report")

**And** automated tests cover: both actions are absent for a non-`in_maintenance` unit; `TransitionConfirmSheet.jsx` is reused with the correct verb/destination/variant for each action; and a successful resolution removes the unit from a subsequently-fetched workshop list

### Story 4.9: Unit detail screen - recover a lost unit

As a manager,
I want to bring a unit back from lost to stock, maintenance, or retirement with a mandatory reason, seeing plainly that no money moves,
So that a piece that turns up again is trackable and the shop's stock value is corrected without anyone at the counter wondering whether a sale is being reversed (FR11/CAP-11, AD-29).

**Acceptance Criteria:**

**Given** `UnitDetail.jsx` for a unit currently `lost`
**When** a signed-in `MANAGER` or `ADMIN` views it
**Then** a single *Recover* action appears — absent entirely, not disabled, for any other role, including `INVENTORY_MANAGER` and `CASHIER`, since `inventory.recover_lost` (Story 4.4's own permission) is checked to decide whether the action renders at all, matching AD-29's "a withheld surface is absent, never a disabled entry" and this epic's own explicit instruction that this screen is MANAGER-and-above only

**Given** *Recover* is tapped
**When** `{components.recovery-panel}` opens (`DESIGN.md`'s named component)
**Then** it shows three destination radio choices — *Return to stock* / *Send to maintenance* / *Retire* — plus a reason field carrying **no default value and no placeholder text that could be mistaken for one**, and the commit button stays disabled until both a destination is picked and the reason field is non-blank — Story 4.4's "never defaulted" rule enforced client-side before the request is even attempted, not only by the server's own rejection of a blank reason

**Given** the panel is open
**When** it renders
**Then** it states plainly, before commit, exactly the sentence `DESIGN.md` specifies for this component: *"This adds the unit's buying price back to stock. No money moves and nothing already earned is reversed."* — this is the one line the user's brief specifically called out, and it is not paraphrased or shortened

**Given** the commit is tapped with both fields set
**When** the request is sent
**Then** the screen mints a `requestUuid` at panel-open (matching Story 4.7/4.8's timing convention) and calls `POST /api/units/:uuid/recover` (Story 4.4) with `{ destination, reason, requestUuid }` through `platform/wakingRequest.js`

**Given** the same route and panel apply whether the unit's channel is `RETAIL` or `RENTAL`
**When** the panel is opened on either
**Then** no branch in this screen or the panel component checks `unit.channel` at all — Story 4.4's own "no channel-specific branch" guarantee has a client-side mirror: one panel, one route, both channels

**Given** a `destination` of *Retire*
**When** the commit succeeds
**Then** `UnitDetail.jsx`'s status-events history (Story 4.6) shows exactly one new row — `LOST -> RETIRED`, cause `RECOVERY` — never two, matching Story 4.4's "the service never issues two chained calls" guarantee; this screen renders whatever the single response contains and does not itself synthesize a second history entry

**Given** a signed-in `INVENTORY_MANAGER` (holding the rest of the inventory permission set but not `inventory.recover_lost`)
**When** they view a `lost` unit's detail screen
**Then** no *Recover* action, panel, or any trace of it renders anywhere on the screen — an automated test specifically covers this role, per Story 4.4's own emphasis that `INVENTORY_MANAGER` is "the easiest role to wrongly grant this to"

**And** automated tests cover: the Recover action's presence for `MANAGER`/`ADMIN` and absence for every other role including `INVENTORY_MANAGER`; the commit button staying disabled until both destination and a non-blank reason are set; the "no money moves" sentence rendering verbatim; and the status-events history gaining exactly one row after a Retire-destination recovery

### Story 4.10: Workshop screen (Q15)

As the owner,
I want to see what's in the workshop right now — how many pieces, how long each has been there, and what's been spent keeping it there — from a screen I can actually open,
So that I can act on a slow repair without it being buried in an API response only a developer can read (FR21/CAP-22, Q15).

**Acceptance Criteria:**

**Given** `GET /api/reports/inventory/workshop/summary` and `GET /api/reports/inventory/workshop/lines` (Story 4.5), both requiring `authorize(PERMISSIONS.INVENTORY.VIEW)`
**When** this story is implemented
**Then** `navigation.js` gains `{ permission: PERMISSIONS.INVENTORY.VIEW, label: 'Workshop', path: '/workshop', element: WorkshopScreen }` — reachable to the same roles Story 4.6's Units screen is, matching that screen's gating rationale exactly

**Given** the `summary()` shape `{ unitCount, byUnit: [...] }` (point-in-time, no date range — Story 4.5's own "no `from`/`to`" note)
**When** `WorkshopScreen.jsx` loads
**Then** it renders `unitCount` as a headline figure with an explicit "as of now" qualifier — matching `EXPERIENCE.md`'s "point-in-time cards say so rather than silently ignoring the range" rule — and this screen carries no `{components.date-range-control}` at all, since one would imply a range this data doesn't have

**Given** the `lines()` route returns the same `byUnit` rows, paginated per AD-26
**When** the screen renders its list
**Then** each row shows the unit (linking through to `UnitDetail.jsx`, Story 4.6, reusing its `{components.status-pill}` for consistency even though every row here is necessarily `in_maintenance`), `daysInWorkshop`, and `upkeepSpentPaise` formatted through `formatPaise()` — the list is paginated exactly as every other list in this build, no "show all"

**Given** a unit on this list is resolved from `UnitDetail.jsx` (Story 4.8's *Maintenance complete* or *Retire*)
**When** the workshop list is next fetched
**Then** that unit no longer appears — this story is what Story 4.8's own note refers to as "wired into these screens," and no explicit cross-screen event or subscription exists beyond both reading current server state on their own fetch

**Given** this epic's own implementation notes state Q15 must not be rebuilt once the eventual dashboard epic ships
**When** this story is implemented
**Then** it deliberately builds no dashboard-card wrapper or pinning behaviour around this data — this is a standalone screen with its own nav entry, not a dashboard card, since no dashboard shell exists yet in this build's span; a future epic's dashboard card, if one is ever added, would point at this same route rather than this story inventing a card shape prematurely

**And** automated tests cover: `unitCount` renders with its point-in-time qualifier; the `byUnit` list paginates and formats `upkeepSpentPaise` correctly; a row links through to the correct unit's detail screen; and a unit resolved out of maintenance from `UnitDetail.jsx` no longer appears on a subsequent fetch of this list

