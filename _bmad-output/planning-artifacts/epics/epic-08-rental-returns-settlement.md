## Epic 8: Rental Returns, Settlement, Extension & Overdue Visibility

Staff can close out a returning unit's agreement, extend an active booking outward, and see which bookings are overdue or at deposit-exhaustion risk — all without a scheduler. Written in two batches, plus one story carried in later. **Carried in from the dashboard re-sequencing (Raviraj, this run):** Story 8.6 answers Q11 ("what is out on rent right now") from `dashboard-questions.md`, joining Q12 and Q26 — already answered here by Story 8.4 — as the third and last of the five operational dashboard questions this epic now owns outright. All three are moved out of the (now-relocated) owner-dashboard epic for the same reason: they are operational, not analytical, the dashboard itself is deliberately last in the build, and none of the three needs anything the dashboard epic builds. Story 8.4's own acceptance criteria, unchanged by this run, still describe themselves as "the first work in `modules/reports/` this build has needed" — that claim is now stale: Epic 4's Story 4.5 (Q15) and Epic 7's Story 7.6 (Q22) both precede Story 8.4 in build order and both write to `modules/reports/questions/` first. The claim is left exactly as Story 8.4 wrote it rather than edited here, since editing Story 8.4's prose is outside this run's organisational scope; a future pass through this epic should correct it. **Batch one** (Stories 8.1–8.3) covered the three close events (CAP-19): return and settlement, write-off, and cancellation. **Batch two** (Stories 8.4–8.5, this batch) closes the epic: overdue visibility and the deposit-exhaustion review list (CAP-20), and widening an `OPEN` booking (CAP-25).

**UPI payment (this run, 2026-08-30, closing the gap `ARCHITECTURE-SPINE.md` flagged against Story 8.5 while resolving U-16/U-17).** Story 8.5's extension gesture was rewritten to close the same defect Epic 5's Story 5.5 and Epic 7's Story 7.2/Story 7.5 already closed for retail checkout, rental booking, and walk-in hand-over: `paymentMethod` on `POST /api/rentals/extend` was previously a plain recorded field with no QR step, no allocation call, and no *Mark as received* gesture. The story now calls the exact same shared `POST /api/payments/upi-qr` route (AD-42) Story 5.5 builds and Story 7.2/7.5 already call — `modules/payments/`'s `payment_ref_seq` (AD-39), `buildUpiLink()` (AD-40), and `paiseToUpiAmount()` (AD-41) — rather than inventing a fourth allocation route; this epic invents nothing new in `modules/payments/`, it only calls what Epic 5 already ships, exactly as Epic 7's own implementation notes already state for CAP-17/18. The mechanism itself — allocate before any row exists, render the QR with nothing written while it is on screen, commit only on *Mark as received* (now carrying the reference), or switch to cash, or cancel and leave nothing to delete — is identical to retail checkout's and rental booking's and is not restated a third time here; Story 8.5's own acceptance criteria state it once for the extension gesture specifically. One respect in which Story 8.5 differs from CAP-14/17/18: it writes its payment reference onto the **same** `rental_bookings.payment_reference_code` column the original booking (Story 7.2) or walk-in hand-over (Story 7.5) already wrote, because AD-39 binds that column to CAP-25 as well as CAP-17/18 rather than giving the extension gesture a column of its own — a UPI-paid extension's reference therefore supersedes whatever reference the row already carried, and the row keeps no history of more than one payment event, matching every other money-collecting row in this build.

**Story 8.1 and Story 8.3 need nothing from this change, decided here rather than left ambiguous.** Both close a hire by moving money the **other** way: Story 8.1's settlement hands back a deposit balance to the customer, and Story 8.3's cancellation refunds a booking's deposit in full. Neither ever collects money from a customer at the moment it runs, so neither has a total to draw a QR for. The UPI QR mechanism (AD-39–AD-42; SPEC.md's "general payment surface" framing) is scoped explicitly to the four **money-in** capabilities AD-29 gates behind `SALES.CREATE`/`RENTALS.BOOK`/`RENTALS.HANDOVER`/`RENTALS.EXTEND` — CAP-14/17/18/25 — and no architecture decision in this spine describes an outbound-payment QR of any kind; a refund is authorized under `RENTALS.SETTLE`/`RENTALS.CANCEL` instead, verbs AD-42 does not list among the route's accepted permissions. Both stories already record their own outbound cash correctly without any QR involvement: Story 8.1 stores the manager's chosen `settlementMethod` alongside the computed `depositReturnedPaise` for the drawer to reconcile against, and Story 8.3's CAS sets `deposit_returned_paise = deposit_paise` directly on the cancelled booking row — in both cases the cash or transfer itself is handed to the customer outside the application entirely, exactly as it was before this run, and neither story's acceptance criteria change.

**Batch one shipped no migration.** Story 7.4 created every settlement column on `rental_agreements` ahead of time — `returned_at`, `written_off_at`, `damage_grade_id`, `damage_charged_paise`, `overdue_charged_paise`, `deposit_returned_paise`, `settlement_method`, `reverses_agreement_id` — and Story 7.1 did the same for `rental_bookings`' cancellation columns, exactly so this epic alters no table another epic owns. **Batch two ships exactly one migration** (Story 8.4, slot 20 — the next open slot after Story 7.4's 19, since batch one used none): a single generated column, `rental_agreements.deposit_exhausted_on`, added because it is a pure function of columns Story 7.4 already froze and needs no application code to stay correct. Everything else in this batch, like batch one, is service, route and screen work against tables that already exist.

**AD-31 permits a booking to be amended only while it is still `OPEN`.** A booking already `HANDED_OVER` — collected by the customer, an agreement already open against it — cannot be extended by Story 8.5's route at all; the shop's only lever on a hire already out the door is Story 8.1's settlement (which never re-prices a finished window) or Story 8.2's write-off. Moving a collected hire's dates is not a capability this system offers, by AD-31's own design, not an oversight this batch works around.

This is where rental money finally becomes income. Rent, overdue and damage are recognised at the close event and anchored to that event's own shop day, never to the booking's creation day (AD-33). No story in this epic writes an income row: income is derived in Epic 12's views from the columns these stories commit, so nothing here builds an income ledger table.

### Story 8.1: Return a rental unit and settle its deposit

As a manager,
I want to scan a returning piece, see exactly how its deposit is being carved up before I commit, and hand back the balance with a printed slip,
So that the customer sees why she is getting ₹3,500 back instead of ₹5,000, and the shop's held-deposit figure drops by exactly the deposit that just closed (FR18/CAP-19, AD-6, AD-9, AD-10, AD-13, AD-22, AD-23, AD-29, AD-33).

**Acceptance Criteria:**

**Given** a scanned barcode on the Return & settle screen
**When** `GET /api/rentals/agreements/by-unit-barcode/:barcode` is called
**Then** it resolves the unit's one open agreement — `returned_at IS NULL AND written_off_at IS NULL AND deleted_at IS NULL`, which Story 7.4's partial unique index guarantees is at most one — and returns it with its booking, its snapshotted rental terms, and the derived settlement preview below
**And** a barcode whose unit has no open agreement is refused with a 404 naming the barcode and the unit's actual status, before any settlement screen renders

**Given** an open agreement resolved for settlement
**When** the settlement preview is computed
**Then** every figure is derived at read time and none is stored until commit: `overdueDays = GREATEST(0, (now() AT TIME ZONE 'Asia/Kolkata')::date - due_date)` (AD-6 — the shop day, never the server clock); `overdueChargedPaise = LEAST(overdueDays * overdue_per_day_paise, deposit_paise)`; `damageChargedPaise` defaults to the selected `damage_grades` row's `default_charge_paise` and is editable by the manager, capped at `deposit_paise - overdueChargedPaise`; and `depositReturnedPaise = deposit_paise - overdueChargedPaise - damageChargedPaise`
**And** the three parts sum to exactly `deposit_paise` in every case, which is the arithmetic that drains the held-deposit figure to zero rather than negative — `depositReturnedPaise` can reach zero but is never negative
**And** overdue is deducted **first** and damage from what remains, stated explicitly because the order changes the answer once the two together exceed the deposit; a unit returned at exactly its maximum period has already consumed the whole deposit in overdue and leaves nothing for damage, which is the intended consequence of AD-16's cap and not a defect

**Given** the manager has chosen a destination — returned clean, or needs work
**When** `POST /api/rentals/settle` is called with `{ requestUuid, agreementUuid, damageGradeUuid, damageChargedPaise, settlementMethod, destination }`
**Then** everything below happens inside one transaction (AD-10), and nothing slow runs inside it — no slip is rendered until after commit

**Given** that transaction
**When** it runs
**Then** it first CASes the agreement — `UPDATE rental_agreements SET returned_at = now(), overdue_charged_paise = :overdue, damage_charged_paise = :damage, damage_grade_id = :gradeId, deposit_returned_paise = :returned, settlement_method = :method WHERE id = :id AND returned_at IS NULL AND written_off_at IS NULL AND deleted_at IS NULL RETURNING id` — and a zero-row return rolls the whole transaction back with a 409 saying this hire is already closed, naming when and by whom
**And** it then CASes the booking — `UPDATE rental_bookings SET state = 'SETTLED' WHERE id = :bookingId AND state = 'HANDED_OVER' AND deleted_at IS NULL RETURNING id` — and a zero-row return also rolls the whole transaction back. **Settlement is not complete until both rows are terminal (AD-9):** a booking left at `HANDED_OVER` keeps its deposit in the held-deposit figure forever, keeps Story 7.1's exclusion constraint blocking dates the shop already has back on the floor, and never reaches the tier-two freeze, so the row stays editable indefinitely
**And** it then calls `transitionUnit({ unitUuid, to: destination === 'CLEAN' ? 'IN_STOCK' : 'IN_MAINTENANCE', cause: 'RETURN', actorUserId, agreementId }, { transaction })`, with `RETURN` added to `unit-status-cause.js` alongside `SALE`, `EXCHANGE_RETURN`, `EXCHANGE_SALE` and `HANDOVER`; a CAS failure here rolls back the agreement and booking writes too
**And** it inserts the `request_keys` row last (AD-22), `gesture_type: 'RENTAL_SETTLE'`, `result_kind: 'RENTAL_AGREEMENT'`, `result_uuid` the settled agreement's uuid; a replay performs no second CAS on either row and no second unit transition, and returns the original committed settlement with 200, never a 409 claiming the hire is already closed by its own prior attempt

**Given** a booking group of three sarees where only one piece has come back
**When** that piece is settled
**Then** only its own agreement and only its own booking row are touched; the other two agreements stay open, their deposits stay in the held figure, and they remain overdue-eligible — partial return needs no special handling because AD-21 made the group a shared column rather than a header row

**Given** the settlement has committed
**When** the slip is produced
**Then** it always prints, whether or not anything was deducted (Raviraj's decision, CAP-19), rendered after commit from committed rows by Story 6.2's existing `modules/receipts/receipt-renderer.js` — no second renderer is written
**And** it is assembled into Story 6.2's domain-agnostic shape, with `lines[]` carrying the four settlement figures in order — deposit held, overdue deducted with its day count, damage deducted with its grade name, balance returned — and `rentalTerms` carrying the hire's dates and daily rate; the same View / Download PDF / Send on WhatsApp / Print channels apply unchanged

**Given** the damage grade selected at settlement
**When** the agreement is later read for any purpose
**Then** `damage_charged_paise` on the agreement is the only figure ever used, and `damage_grades.default_charge_paise` is never re-resolved for a settled agreement (AD-5) — an admin retuning a grade's default must not change what a customer was already charged

**Given** `PERMISSIONS.RENTALS.SETTLE` (AD-29, MANAGER and above)
**When** `POST /api/rentals/settle` is authorized
**Then** it requires `authenticate` and `authorize(PERMISSIONS.RENTALS.SETTLE)`; a CASHIER does not hold it, so Return & settle is absent from a cashier's navigation entirely rather than present and refused

### Story 8.2: Write off a hire whose piece never came back

As a manager,
I want to declare that a piece is not coming back and close its hire in one action,
So that the shop stops holding a deposit it has actually kept, the unit stops blocking dates it will never occupy, and the money is recognised on the day I made the call (FR18/CAP-19, AD-9, AD-13, AD-32, AD-33, AD-34).

**Acceptance Criteria:**

**Given** an open agreement whose piece has not returned
**When** `POST /api/rentals/write-off` is called with `{ requestUuid, agreementUuid, reason }`
**Then** the whole write-off happens in one transaction: the agreement is CASed with `written_off_at = now()`, `deposit_returned_paise = 0` and the supplied reason; the booking is CASed from `HANDED_OVER` to `WRITTEN_OFF` (AD-32); and `transitionUnit({ unitUuid, to: 'LOST', cause: 'WRITE_OFF', reason, actorUserId, agreementId })` runs in the same transaction — a zero-row return on any of the three rolls back all of them
**And** `returned_at` is left NULL, deliberately: the piece did not come back, and writing a return timestamp for it would be a lie in an audit trail. `returned_at` keeps exactly one meaning — the piece physically came back (AD-32)

**Given** the write-off has committed
**When** the income it recognises is derived in Epic 12's views
**Then** it recognises the booking's rent **plus the full deposit**, both anchored to `written_off_at` and to nothing else (AD-32, AD-34)
**And** it emits **no separate overdue figure at all.** The overdue is what consumed the deposit, and the whole deposit is already being recognised, so recognising overdue as well would count the same rupees twice. This is called out because it is the most plausible mistake in this epic: the overdue figure is sitting on the very screen the write-off is triggered from, and `overdue_charged_paise` is left NULL on a written-off agreement precisely so no view can pick it up

**Given** the write-off has committed
**When** the unit's dates and slot are checked
**Then** Story 7.1's exclusion constraint releases the window, because its predicate covers only `OPEN` and `HANDED_OVER`; and Story 7.4's `rental_agreements_one_open_per_unit` index releases the unit's slot, because its predicate excludes rows with `written_off_at` set — so a piece later recovered under Story 4.4 can be handed over again with no data surgery

**Given** AD-34's rule that marking a unit lost is always a human action
**When** this story is implemented
**Then** nothing in it runs on a timer, and no code path anywhere transitions a unit to `LOST` without a person invoking this route — the deposit-exhaustion date is a prompt for a human, built in a later batch of this epic, and never a trigger
**And** a `reason` is mandatory with no default and no placeholder value

**Given** `PERMISSIONS.RENTALS.SETTLE`
**When** `POST /api/rentals/write-off` is authorized
**Then** it reuses that existing constant rather than introducing a seventh rental verb — a write-off is the terminal settlement of a hire, and AD-29's six verbs are deliberately one per counter gesture with no write-off verb among them
**And** the gesture is recorded as `RENTAL_WRITE_OFF` in `gesture-type.js` with the `request_keys` row inserted last, so a retried write-off does not recognise the deposit twice

### Story 8.3: Cancel a booking before hand-over

As a manager,
I want to cancel a booking the customer no longer wants and return her deposit,
So that the dates go back on the floor and the drawer reconciles, without inventing an agreement for a piece that never left the shop (FR16/CAP-17, AD-5, AD-27, AD-29, AD-33).

**Acceptance Criteria:**

**Given** a booking still in `OPEN` — never handed over, so no agreement exists
**When** `POST /api/rentals/cancel` is called with `{ requestUuid, bookingUuids, reason }`
**Then** each booking is CASed `UPDATE rental_bookings SET state = 'CANCELLED', cancelled_at = now(), cancelled_by_user_id = :actor, deposit_returned_paise = deposit_paise WHERE id = :id AND state = 'OPEN' AND deleted_at IS NULL RETURNING id`, all inside one transaction, and a zero-row return on any one of them rolls back every other cancellation in the same call and returns a 409 naming that booking and its actual state
**And** the money settles on the booking row itself (AD-27) — no `rental_agreements` row is invented to carry it, because the refund of a deposit on a piece that never left the shop has nowhere else to live and Q2's cash reconciliation would otherwise lose it

**Given** a cancelled booking
**When** its money is derived in Epic 12's views
**Then** the deposit is returned in full and leaves the held-deposit figure, and the **rent stays charged and is recognised as income**, anchored to `cancelled_at` — a cancellation is one of AD-33's four close events, and CAP-17 is explicit that a cancellation leaves the rent as charged
**And** `rent_charged_paise` is not zeroed, reduced or refunded by this story, and no rent is ever pro-rated

**Given** a cancelled booking
**When** the unit's status is checked
**Then** it is unchanged and still `in_stock` — the piece never left the shop, so no `transitionUnit()` call is made by this story at all
**And** Story 7.1's exclusion constraint releases the window immediately, because its predicate covers only `OPEN` and `HANDED_OVER`, so the dates are bookable again the moment the transaction commits

**Given** a booking already `HANDED_OVER`
**When** cancellation is attempted against it
**Then** it is refused with a 409 explaining that a collected hire is settled or written off, not cancelled, and pointing at Return & settle — the CAS's `state = 'OPEN'` predicate makes this structural rather than a separate check

**Given** a three-piece booking group where the customer wants only one piece cancelled
**When** `bookingUuids` carries just that one booking's uuid
**Then** only that booking is cancelled and the other two stay `OPEN` — cancellation granularity is per booking row, and cancelling a whole group is N row cancellations in one transaction (AD-21)

**Given** `PERMISSIONS.RENTALS.CANCEL` (AD-29, MANAGER and above)
**When** `POST /api/rentals/cancel` is authorized
**Then** it requires `authenticate` and `authorize(PERMISSIONS.RENTALS.CANCEL)`; a CASHIER does not hold it, which is why a cashier who scans a damaged piece against a live booking is refused by Story 7.3's guard and must fetch a manager — the two rules are deliberately connected, and the refusal message names the blocking booking so the cashier knows what to relay
**And** the gesture is `RENTAL_CANCEL` with its `request_keys` row inserted last, so a retried cancellation does not return the deposit twice

### Story 8.4: Overdue visibility and the deposit-exhaustion review list — derived on read, no scheduler, ever

As a staff member with `RENTALS.VIEW`,
I want to see which handed-over pieces are overdue and how much that has eaten into their deposit, and see a review list of the ones whose deposit is fully consumed,
So that I can chase a late return or decide a write-off, without the shop running a single job in the background to tell me (FR19/CAP-20, AD-6, AD-13, AD-16, AD-18, AD-26, AD-29, AD-34; Q12, Q26).

**Acceptance Criteria:**

**Given** the shop's rule that overdue is a property of a live hire, never a stored fact
**When** any of this story's endpoints run
**Then** every figure — whether a unit is overdue at all, how many days, how much that has accrued, and which agreements have exhausted their deposit — is computed **inside the SELECT that renders the page**, exactly as AD-16 requires: no `is_overdue` column, no `overdue_days` column, no `accrued_overdue_paise` column, and no `max_period_days` column exists anywhere in the schema, on `rental_agreements` or elsewhere
**And** an automated test asserts that `backend/package.json` carries no scheduler, cron, or job-queue dependency (AD-16's own list — `node-cron`, `node-schedule`, `agenda`, `bull`, `bullmq`, `bree`, `cron`, `croner`, `toad-scheduler` — is illustrative, not exhaustive) and that no `setInterval` or self-rescheduling `setTimeout` exists in `backend/src/`, so a reviewer does not have to re-derive AD-16's prohibition by reading every file this story touches

**Given** two new files, `modules/reports/questions/overdue.question.js` and `modules/reports/questions/deposit-exhausted.question.js`, each exporting a `summary()`/`lines()` pair (AD-18) — no longer the first work in `modules/reports/` this build needs — this epic's own implementation notes now list two files ahead of it in build order (Story 4.5's Q15, Story 7.6's Q22), carried in by the dashboard epic's move to the end of the build
**When** either module is reviewed
**Then** both are hand-written parameterised SQL reading `rental_agreements` (joined to `units`, `damage_grades` is not needed here) directly — never through a Sequelize model, and never by calling into `rentals.service.js` — matching NFR17's rule for the read side exactly, and establishing `modules/reports/questions/` as the one home for every `reports/questions/` module this build writes, so Epic 12 (the owner-dashboard epic, moved to the end of the build by this run's re-sequencing) extends this directory rather than inventing a second one — Story 4.5 (Q15) and Story 7.6 (Q22) already extend it first, ahead of this story, per this epic's own implementation notes
**And** neither module reads or writes any of the six AD-12 views (`v_net_sale_lines`, `v_net_expenses`, `v_rental_income`, `v_rent_held`, `v_deposits_held`, and the sixth Epic 12 defines) — those views, and the migration that creates them, are Epic 12's, not yet built, and this story does not depend on them: Q26's deposit figure reads `rental_agreements.deposit_paise` directly, which is the same figure `v_deposits_held` would show for this row while it is still `HANDED_OVER`, since both read the identical snapshotted column — Epic 12 may re-point Q26 at the view later for consistency with Q6, but nothing in this story requires that it does

**Given** `GET /api/reports/rentals/overdue/summary` and `GET /api/reports/rentals/overdue/lines` (Q12, point-in-time — no date range accepted, matching Q6's shape per AD-33)
**When** either is called
**Then** the underlying query is `SELECT ra.*, u.barcode, u.product_type_id, u.colour_id, u.size_id FROM rental_agreements ra JOIN units u ON u.id = ra.unit_id WHERE ra.returned_at IS NULL AND ra.written_off_at IS NULL AND ra.deleted_at IS NULL AND (now() AT TIME ZONE 'Asia/Kolkata')::date > ra.due_date` — "handed over" is exactly `returned_at IS NULL AND written_off_at IS NULL` (a live agreement only exists once hand-over has happened, per Story 7.4/7.5), and "today past the due date" is AD-6's shop-day reduction, never the server's local clock and never a stored flag
**And** for each row, `overdueDays = (now() AT TIME ZONE 'Asia/Kolkata')::date - ra.due_date` and `accruedOverduePaise = LEAST(overdueDays * ra.overdue_per_day_paise, ra.deposit_paise)` — the identical formula shape Story 8.1's settlement preview already uses, restated here as its own SQL rather than imported as code, because NFR17 forbids this module from calling into `rentals.service.js` where Story 8.1's version lives; `lines()` returns these fields inside the `{ items, page, pageSize, total }` envelope (AD-26), and `summary()` returns the count of overdue agreements and the sum of `accruedOverduePaise` across all of them, both with no date-range parameter
**And** a unit that is `RENTED` but not yet past `due_date`, and a unit whose agreement has already `returned_at` or `written_off_at` set, both appear on neither `lines()` nor count toward `summary()` — the predicate above excludes them structurally, not by a second filter downstream

**Given** the same migration that adds nothing else, `20-add-deposit-exhausted-on` (Story 7.4 claimed slot 19; batch one of this epic shipped no migration, so 20 is the next open slot)
**When** it runs against `rental_agreements`
**Then** it adds, via raw SQL exactly as AD-7's `period` column precedent requires (`queryInterface.sequelize.query()`, **not** declared on the `RentalAgreement` Sequelize model, and any attempt to `INSERT` a value into it errors): `ALTER TABLE rental_agreements ADD COLUMN deposit_exhausted_on DATE GENERATED ALWAYS AS (due_date + (deposit_paise / overdue_per_day_paise)::integer) STORED` — the explicit `::integer` cast is required because Postgres has no `date + bigint` operator, only `date + integer`, and `deposit_paise` and `overdue_per_day_paise` are both `BIGINT`; integer division of two positive `BIGINT`s already truncates toward zero, which equals `floor()` for positive operands, so no separate `floor()` call is needed
**And** this is the **one and only** derived rental figure in this build that is a stored (generated) column rather than computed fresh in every SELECT, and the distinction is deliberate, not an inconsistency with the AC above: `deposit_exhausted_on`'s only inputs — `due_date`, `deposit_paise`, `overdue_per_day_paise` — are frozen snapshots on the agreement the instant Story 7.4 writes them (AD-24, AD-5) and never change again, so the column recomputes to the identical value on every read regardless of when it is read; `overdueDays` and `accruedOverduePaise` above cannot be generated columns by the same logic in reverse — their value depends on `now()`, a volatile function Postgres forbids inside a `GENERATED ALWAYS` expression, so they can only ever be computed in the SELECT, which is exactly what the AC above does
**And** the migration's `down()` drops the column, cleanly reversible, with no data migration in either direction since the column carries no state Postgres did not already have the ingredients for

**Given** `GET /api/reports/rentals/deposit-exhausted/summary` and `GET /api/reports/rentals/deposit-exhausted/lines` (Q26, point-in-time)
**When** either is called
**Then** the query is `SELECT ra.*, u.barcode FROM rental_agreements ra JOIN units u ON u.id = ra.unit_id WHERE ra.returned_at IS NULL AND ra.written_off_at IS NULL AND ra.deleted_at IS NULL AND (now() AT TIME ZONE 'Asia/Kolkata')::date > ra.deposit_exhausted_on` — "past the day the deposit runs out" is strict, matching AD-6's "due on the 17th is not overdue on the 17th" reading applied to this second date — and each `lines()` row carries `customer_name_snapshot`, `overdueDays` and `accruedOverduePaise` computed identically to the overdue query above, and `deposit_paise` itself as "the deposit it has consumed" (accrued is capped at the deposit by definition, so once a row appears here `accruedOverduePaise` always equals `deposit_paise`)
**And** `summary()` returns only the count of agreements on this list and the total deposit they represent — no rupee total is described as "at risk" or "lost," because nothing has been decided about any of them yet

**Given** AD-34's rule that this date is a prompt for a human and never a trigger
**When** an agreement's `deposit_exhausted_on` passes
**Then** nothing in the system reads or reacts to it except this story's two `GET` endpoints: no status changes on `units` or `rental_bookings`, no row is written anywhere, and no code path outside this story's SQL ever references `deposit_exhausted_on` in a `WHERE` clause that could branch program behaviour
**And** the **only** way an agreement on this list becomes `WRITTEN_OFF` is a person opening Story 8.2's write-off action against it — this story adds no button, no route, and no service call that transitions a unit or closes an agreement; it is read-only, start to finish, and the review list exists precisely so a human has something to act on, per AD-34's own framing, never so the system can act on it
**And** an automated test proves an agreement can sit on this list for months with no row anywhere in the database changing as a result — the passage of time alone, with the app never invoked, produces no side effect, which is the concrete, checkable form of "never a trigger"

**Given** `PERMISSIONS.RENTALS.VIEW` (AD-29, held by `CASHIER`, `MANAGER`, and `ACCOUNTANT`)
**When** any of this story's four routes is authorized
**Then** each requires `authenticate` and `authorize(PERMISSIONS.RENTALS.VIEW)` — no new permission constant is introduced, since seeing which hires are late or at risk is a viewing action available to everyone who can already see rentals, including the read-only `ACCOUNTANT` role

### Story 8.5: Extend a booking — widen an `OPEN` window, collect only the difference via the UPI QR flow, protected against a double charge

As a cashier,
I want to move a customer's booking dates outward when they call ahead, draw a UPI QR for just the extra rent with nothing written until I confirm payment, or take cash instead, and never risk the customer being charged twice if the connection drops mid-request,
So that a wedding that moves out three days is one counter action instead of a cancel-and-rebook that would double-charge rent the shop never intended to collect twice, and a UPI payment is never recorded as received until I've actually seen it land (FR24/CAP-25, AD-8, AD-10, AD-16, AD-22, AD-23, AD-29, AD-31, AD-33, AD-39–AD-42).

**Acceptance Criteria:**

**Given** an `open` booking shown in the extension panel, its two date fields pre-filled with the current `start_date`/`end_date` (UX-DR14, `EXPERIENCE.md` Flow 9)
**When** the staff member tries to set either field to a value that would narrow the window at either end
**Then** the field refuses the value before any request is sent — the client enforces `newStartDate <= start_date` and `newEndDate >= end_date` inline, matching the "Booking narrowed" state pattern (*An extension can only widen the window, never shorten it*) — and this is a UX convenience only; the AC below states the server-side guard that is the actual authority

**Given** `POST /api/rentals/extend` called with `{ requestUuid, bookingUuid, newStartDate, newEndDate, paymentMethod, paymentReferenceCode }` — `paymentReferenceCode` present only when `paymentMethod` is `UPI` and a QR was drawn and confirmed for this attempt (see the UPI QR flow below), absent whenever the cashier is paid cash or never chose UPI at all
**When** the service computes the new rent
**Then** it re-reads the booking's own already-snapshotted `rent_per_day_paise`, `deposit_paise`, `overdue_per_day_paise` and current `rent_charged_paise` — never re-reading `units`, since AD-24 tier two already froze the first three at booking — and computes `newRentalDays = rentalDays(newStartDate, newEndDate)` via the **same shared `rentalDays()` helper** Story 7.2 introduced (AD-23), imported unchanged, not restated
**And** if `newRentalDays` exceeds `floor(deposit_paise / overdue_per_day_paise)` — the identical arithmetic Story 7.2's original booking check used, against the booking's own unchanged deposit — the whole request is refused with a 409 naming the booking and the arithmetic, *"This deposit covers up to N days"* (`EXPERIENCE.md` Flow 9's own refusal example, CAP-17, CAP-25), evaluated **before** the QR-drawing step and the CAS below both

**Given** the extension panel already shows the previewed rent difference — Flow 9's own "Collect ₹2,100" example — computed client-side as `rent_per_day_paise × newRentalDays − rent_charged_paise`, the identical arithmetic the server re-runs authoritatively below
**When** the cashier picks **UPI** as the payment method
**Then** the client calls the shared `POST /api/payments/upi-qr` (AD-42, built by `epic-05-cart-customer-checkout.md`'s Story 5.5, called here unchanged) with `{ requestUuid, amountPaise }` — the same `requestUuid` this extension attempt's commit call below reuses — and `amountPaise` equal to the previewed rent difference, never the new rent in full (AD-41's "CAP-25's rent-difference calculation")
**And** the response's `upiLink` renders as a QR on the extension panel, the amount and payment reference shown beside it exactly as *The UPI Payment Pattern* describes (`EXPERIENCE.md`); nothing is written to any table while it is displayed — no `rental_bookings` row is touched, no `request_keys` row exists — matching CAP-25's own general-payment-surface flow

**Given** the QR is on screen and a `paymentReferenceCode` has been allocated for this extension attempt
**When** the cashier sees the customer's phone show payment success and taps **Mark as received**
**Then** `POST /api/rentals/extend` is called with the same `requestUuid` plus `{ bookingUuid, newStartDate, newEndDate, paymentMethod: 'UPI', paymentReferenceCode }`, and the service re-derives the rent difference itself — re-running the maximum-period check and the CAS below from the booking's own re-read snapshotted terms — rather than trusting the previewed `amountPaise` the QR was drawn from (AD-41's "neither call ever accepts a client-supplied total in place of running that computation itself")
**And** because nothing about the booking's rent terms can change between the QR rendering and this tap — the cashier may only switch to cash or cancel from here, never re-widen the window with the QR already up — the server-computed rent difference this commit produces is guaranteed to equal the previewed amount the QR encoded, by construction, not by re-validation against it (AD-41); a **different** counter widening the same booking first in that same window is not this guarantee's concern — it is caught by the CAS's own zero-row-return triage below exactly as it already was before this rewrite, refusing the whole request with a 409 rather than silently committing against a stale QR total

**Given** the QR is on screen
**When** UPI is unavailable on either side and the cashier switches the payment method to cash instead
**Then** the QR is dismissed client-side and `POST /api/rentals/extend` is called with the same `requestUuid` and `paymentMethod: 'CASH'`, carrying no `paymentReferenceCode` at all — the reference allocated for the abandoned QR is simply never sent, never stored, and never reused; `payment_ref_seq` gaps by one, which is expected and harmless (AD-39)

**Given** the QR is on screen, or no QR was ever drawn because the cashier chose cash from the start
**When** the customer decides not to extend and the staff member cancels
**Then** the extension panel closes client-side and no request is sent to `POST /api/rentals/extend` at all — because nothing was ever written in any of these three branches until the moment of commit, there is no `rental_bookings` change and no `request_keys` row to delete or roll back; a UPI reference drawn for the cancelled attempt simply gaps, exactly as the cash-switch branch above

**Given** the maximum-period check has passed
**When** `UPDATE rental_bookings SET start_date = :newStart, end_date = :newEnd, rent_charged_paise = :newRent, payment_method = :paymentMethod, payment_reference_code = :paymentReferenceCode WHERE id = :id AND state = 'OPEN' AND deleted_at IS NULL AND :newStart <= start_date AND :newEnd >= end_date RETURNING id, start_date, end_date, rent_charged_paise` runs (AD-31's exact shape, the same CAS pattern AD-8 mandates elsewhere)
**Then** a zero-row return means exactly one of three things, and the service re-reads the row to name which: the booking is no longer `OPEN` (already `HANDED_OVER`, `CANCELLED`, `SETTLED` or `WRITTEN_OFF` — refused with a 409 pointing at Return & settle or explaining the booking is closed, per this epic's own note that AD-31 permits amendment only while `OPEN`), another transaction won the race and already widened it (refused with a 409 naming the booking's now-current window), or the request itself tried to narrow one end despite the client-side guard above (refused with a 409 restating that an extension can only widen, never shorten) — the same zero-row-return triage shape Story 8.1 and 8.3 already use for their own CASes
**And** on success, `rentDifferencePaise = newRent - previousRentChargedPaise` is computed from the CAS's own `RETURNING` values against the pre-update figure read in the same transaction, and this is the **only** figure the response and the counter screen show to collect — never `newRent` in full, matching Flow 9's "Collect ₹2,100" example exactly, which is the difference for a 4-day-to-7-day extension, not the 7-day total re-charged — and it is exactly the figure the QR step above previewed and drew against
**And** `payment_method` and `payment_reference_code` are set from the request's `paymentMethod` and `paymentReferenceCode` exactly as Story 7.2's booking insert sets the same two columns, `payment_reference_code` left `NULL` when the extension commits as cash; because `rental_bookings` carries only one `payment_method`/`payment_reference_code` pair per row, a UPI-paid extension **overwrites** whatever reference the original booking (Story 7.2) or walk-in hand-over (Story 7.5) left there — this is deliberate, not a gap: AD-39 names `rental_bookings.payment_reference_code` as a column CAP-25 itself binds, and this row, like every other money-collecting row in this build, keeps no history of more than one payment event on a single column

**Given** the generated `period` column Story 7.1 declared on `rental_bookings`
**When** the CAS `UPDATE` above commits new `start_date`/`end_date` values
**Then** `period` recomputes automatically as part of the same `UPDATE`, being `GENERATED ALWAYS ... STORED`, and `rental_bookings_no_overlap`'s `EXCLUDE USING gist` constraint re-checks the widened window against every other `OPEN`/`HANDED_OVER` booking on the same unit **in the same statement** — a property builders will not assume, stated here because it means this story needs no cancel-then-rebook ordering dance and no separate availability re-check call: if the widened window collides with a booking that started after this one was placed, the `UPDATE` itself raises the `23P01` exclusion violation and `withDbErrors` (AD-11) translates it to a 409 naming the conflicting unit and window, exactly as a fresh booking's collision does (Story 7.2)
**And** this story adds no new predicate to `rental_bookings_no_overlap` and no new migration of its own — the constraint Story 7.1 already shipped covers a widened `OPEN` row's window automatically, because the constraint re-evaluates on every `UPDATE` to `period`, not only on `INSERT`

**Given** the `requestUuid` on the request, and the `RENTAL_AMEND` gesture (already enumerated by Story 1.4's `gesture-type.js` and named explicitly in AD-22's fixed set)
**When** the service handles the gesture
**Then** it inserts the `request_keys` row last, inside the same transaction as the CAS `UPDATE`, `result_kind: 'RENTAL_BOOKING'`, `result_uuid` the amended booking's uuid (AD-22's insert-last ordering)
**And** **this is the property this story exists to guarantee, stated explicitly because it is easy to get subtly wrong:** the CAS `UPDATE`'s own `WHERE` clause is satisfied not only by a not-yet-widened row but, trivially, by a row **already** widened to exactly `newStart`/`newEnd` (`newStart <= newStart` and `newEnd >= newEnd` both hold) — so a same-parameter retry of the raw CAS, with no idempotency guard, would **not** 409; it would silently re-run, re-set `rent_charged_paise` to the same value, and commit again with no error visible anywhere in the database. The danger this story closes is therefore not a corrupted row — the row ends up correct either way — it is that a cold-start retry (which AD-19.1 explicitly instructs the client to perform when a response is lost) would show the cashier the "Collect ₹2,100" screen a **second** time with no signal that the first attempt already succeeded, and the cashier would collect real cash or UPI from the customer twice for a database write that only ever happened once. The `request_keys` collision on `(gesture_type, request_uuid)` is what the service checks **before** touching the CAS at all: on a replay it reads back the original committed `result_uuid`, returns the original committed window and the original `rentDifferencePaise` with 200, and the counter screen never asks the cashier to collect anything a second time — this was flagged as a critical finding precisely because the CAS's own harmlessness on retry masks the fact that the money side of the gesture is not harmless at all

**Given** AD-33's rule that an `OPEN` booking's rent is not yet income
**When** this story's CAS updates `rent_charged_paise` to the new, larger figure
**Then** no `v_rental_income` row is written or implied by this story, no signed delta row is created, and the entire amended `rent_charged_paise` — original plus difference alike — is recognised as income exactly once, later, on whichever of AD-33's four close events this booking eventually reaches, anchored to that event's own shop day and not to the day of this extension; this story neither reads nor writes any of the six AD-12 report views, matching Story 7.2's own note that booking-side gestures write nothing income-shaped

**Given** `PERMISSIONS.RENTALS.EXTEND` (AD-29, held by **both** `CASHIER` and `MANAGER` — the one `RENTALS.*` verb besides `BOOK`/`HANDOVER` a cashier holds, because an extension only ever collects more rent and never returns money, unlike `SETTLE`/`CANCEL`)
**When** `POST /api/rentals/extend` is authorized
**Then** it requires `authenticate` and `authorize(PERMISSIONS.RENTALS.EXTEND)` — no new permission constant is introduced, and a cashier taking Anjali's call in Flow 9 needs no manager to complete the extension, unlike Story 8.1's settlement or Story 8.3's cancellation
**And** `POST /api/payments/upi-qr`, called ahead of this route when UPI is chosen, is reached under this same `RENTALS.EXTEND` permission — the fourth and last of AD-29's four money-in verbs the shared route accepts — introducing no new permission constant of its own; Story 5.5 built the route under `SALES.CREATE`, Story 7.2 added `RENTALS.BOOK`, and Story 7.5 added `RENTALS.HANDOVER`, and this is simply the last verb the same route already accepts

**Given** this story's scope
**When** it is reviewed against a multi-unit booking group sharing one `group_uuid` (AD-21)
**Then** `POST /api/rentals/extend` operates on exactly one `bookingUuid` per call, matching AD-31's own `WHERE id = :id` shape literally; a customer's three-saree wedding booking with a shared window is extended by calling this route once per booking row (three `requestUuid`s, three calls), and this story does not introduce a batched `bookingUuids` variant — nothing in `EXPERIENCE.md`'s extension panel or AD-31 describes group-level extension, and Story 8.3's cancel-by-array shape is that story's own design for a different gesture, not a precedent this story is obliged to repeat

### Story 8.6: What is out on rent right now (Q11) — a live-table read, no dashboard required

As the owner,
I want to see every hire that's currently out — how many, which are due today, which are due this week, and the deposit each is holding,
So that I know what's coming back and when, without waiting for the dashboard epic to exist (FR21/CAP-22, AD-6, AD-13, AD-14; Q11).

**Acceptance Criteria:**

**Given** `dashboard-questions.md`'s Q11, moved to this epic by Raviraj's decision (this epic's own implementation notes), joining Q12 and Q26 (Story 8.4) as the third of this epic's three carried-in dashboard questions
**When** `modules/reports/questions/q11-out-on-rent.question.js` is written
**Then** `summary()` reads `rental_agreements WHERE returned_at IS NULL AND written_off_at IS NULL AND deleted_at IS NULL` directly — a live-state question, the same read shape Story 8.4's Q12 already uses for "handed over" — returning `{ openCount, dueTodayCount, dueThisWeekCount }`, both due-window counts computed against `(now() AT TIME ZONE 'Asia/Kolkata')::date` (AD-6), never the client clock; no `from`/`to` accepted, matching AD-14's point-in-time list
**And** `lines({ groupKey: 'due-today'|'due-this-week'|'all', page, pageSize })` returns the matching agreements, each row's deposit figure read straight off `rental_agreements.deposit_paise` — that column is already the tier-two snapshot Story 7.4 copies forward from the booking at hand-over, the same figure `v_deposits_held` would show for this row while it is still `HANDED_OVER` (matching Story 8.4's own stated reasoning for Q26), so no join to any view is needed or attempted; this differs from how this question was originally drafted against the (now-relocated) dashboard epic, which would have joined `v_deposits_held` — that view does not exist at this point in the build, and this story does not depend on it existing

**Given** this question's shape once the dashboard epic eventually exists
**When** that epic's own implementation notes are read
**Then** they state plainly that Q11 is already delivered, here, and must not be rebuilt

**Given** `GET /api/reports/rentals/out-on-rent/summary` and `GET /api/reports/rentals/out-on-rent/lines`
**When** either is called
**Then** both require `authenticate` and `authorize(PERMISSIONS.RENTALS.VIEW)`, exactly matching Story 8.4's Q12/Q26 routes — no new permission constant is introduced, and no `requestUuid` is required or accepted, since neither route mutates anything
