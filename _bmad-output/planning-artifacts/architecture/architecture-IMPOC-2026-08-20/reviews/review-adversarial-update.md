# Adversarial Review — Spine Update (2026-08-20)

**Target:** `ARCHITECTURE-SPINE.md` at 32 ADs, after the M/L re-triage.
**Scope:** what is new or changed in this update — AD-29 … AD-32, the AD-17 redesign, and the widened AD-3, AD-5, AD-8, AD-13, AD-14, AD-15, AD-2. Findings already dispositioned in `review-adversarial.md` / `review-rubric.md` are not restated.

**Method.** For each finding, two concrete units one level down that each obey **every** AD to the letter and still build something that will not compose.

> **Provenance caveat, stated plainly.** Two subagent attempts at this review died before writing findings (one on a host sleep, one on an account session limit). This pass was therefore run by the same author who made the changes, which is a materially weaker lens than an independent one — an author is poor at seeing what they failed to consider. To compensate, every claim that could be checked mechanically was checked rather than argued, and **two suspected criticals were disproved that way and dropped.** An independent pass is still worth running.

## Disproved by testing — recorded so they are not re-raised

- **AD-15's expression index is not creatable (suspected CRITICAL).** *False.* Tested on PostgreSQL 16: `CREATE INDEX ON t (((sold_at AT TIME ZONE 'Asia/Kolkata')::date))` succeeds. Both `timezone(text, timestamptz)` and `timezone(text, timestamp)` are marked `IMMUTABLE` (`provolatile = 'i'`), so the expression is indexable. The generated-column form is also accepted.
- **The expression index will not be used through a netting view (suspected HIGH).** *False.* Built a `v_net_sale_lines` matching AD-13's contract (signed projection, reversed originals retained) over 60,000 sales and 60,000 lines. `EXPLAIN` on `WHERE shop_day BETWEEN …` gives `Index Scan using sales_shop_day`, with the index condition pushed through the view. AD-15 works as written.

## Verified sound

- **AD-5's tier table is exhaustive over migrations 03–19.** Checked by diffing the tier table against the migration sequence; no table appears in one and not the other.

---

## CRITICAL

### C-1 — An AD-31 amendment retroactively mutates a closed accounting period, which AD-14 forbids by name

- **Two units:** *Rentals / booking amendment (AD-31)* and *Reports / Q1 takings + Q2 till reconciliation*.
- **The AD they both obey:** AD-31 (`start_date`/`end_date` amendable while `OPEN`, "`rent_charged_paise` is recomputed by AD-23's `rentalDays` formula"), AD-13 (`rent` "anchored to the booking's **creation** shop-day"), AD-14 ("**A reversal anchors to the reversing row's own shop day, never the original's** … retroactively mutating a period the owner has already read and acted on … is the reporting equivalent of UPDATEing a completed transaction").
- **The concrete divergent outcome:** a booking is created 28 September and amended 5 October; three days become four and the rent goes ₹1,200 → ₹1,600. AD-31 says recompute `rent_charged_paise` in place. Its anchor is still `created_at` — 28 September. September's takings, which the owner already read and reconciled against the till and closed, silently increase by ₹400 a week later. Developer A implements exactly this, because it is the literal text of AD-31. Developer B, reading AD-14's closed-period rule, refuses to touch September and has **nowhere** to put the delta — AD-31 gives it no column and `v_rental_income` no kind. Both readings are quotable and the money is real.
- **The tightening:** AD-31 must state that the rent delta is a **separate signed income row anchored to the amendment's own shop day** — the identical rule AD-14 already applies to reversals — with a matching `kind` in `v_rental_income` and a signed column that joins AD-2's enumerated exception list. The cheaper alternative is to permit amendment only within the same shop day as creation, which sidesteps the whole problem but refuses the actual use case (a customer moving a wedding weeks out).

### C-2 — The amendment is the one mutating gesture AD-22 cannot make idempotent, and AD-19.1 mandates retrying it

- **Two units:** *Frontend / the AD-19.1 retry-with-backoff client* and *Rentals / amendment service*.
- **The AD they both obey:** AD-22 ("The client generates a UUIDv4 per counter gesture … Every header row (`sales`, and the booking/hand-over gesture's first `rental_bookings` row) stores it as `client_request_uuid UUID NOT NULL UNIQUE`"), AD-19.1 ("every scan and checkout call retries with backoff"), AD-31.
- **The concrete divergent outcome:** `rental_bookings.client_request_uuid` is already occupied by the *booking* gesture's key and is `UNIQUE`, so the *amendment* gesture has no place to store its own. It is therefore the only mutating counter gesture with no replay guard — while AD-19.1 instructs the client to retry it. The cold start eats the response, the client retries as told, and **the rent difference is collected from the customer twice**. AD-22's own *Prevents* paragraph describes precisely this failure; the column shape it specifies cannot express it for a second gesture against the same row.
- **The tightening:** move idempotency off the header column and into one `request_keys` table keyed on `(gesture_type, request_uuid)` with the resulting reference — which is the shape that also covers every future gesture — or give the amendment its own child row carrying its own key. A column per header row does not scale past one gesture per row and this is the first case that proves it.

---

## HIGH

### H-1 — AD-13 and AD-32 name different anchors for the same forfeited deposit, and it can be counted twice

- **Two units:** *Rentals / write-off (AD-32)* and *Reports / Q13 per-unit earnings + Q23 retired-piece ROI*.
- **The AD they both obey:** AD-13 — `forfeited_deposit` "(anchored to the `LOST` transition)" — and AD-32 — "**Deposit forfeiture on a write-off anchors to `written_off_at`**". Verified by grep; both sentences are in the current spine.
- **The concrete divergent outcome:** writing off a booking naturally also transitions the unit to `LOST`, because the piece is gone. One developer builds `v_rental_income` from the `LOST` transition per AD-13; another adds a `written_off_at` leg per AD-32. Build both — which is what two epics reading two ADs will do — and **the same deposit appears as income twice**. Build either alone and the two ADs disagree about which shop day it lands on, so Q13 and Q23 can differ by a day across a month boundary.
- **The tightening:** one anchor, stated once. `written_off_at` is the better of the two — it is the booking's own terminal moment and does not depend on a unit transition that may not fire, or may fire twice. AD-13's row must be rewritten to match, and must state explicitly that a `LOST` transition alone never produces a `forfeited_deposit` row for a unit that has an agreement.

### H-2 — AD-14's anchor table contradicts AD-14's own prose, and one anchor has no view at all

- **Two units:** *Reports / Q1 (reads the prose)* and *Reports / Q17 vendor spend (reads the table)*.
- **The AD they both obey:** AD-14's prose — "**Every anchor in the table below is reached through an AD-13 view that exposes it as a `shop_day DATE` column, with no exceptions**" — and AD-14's table, five of whose six Row source cells name **raw tables**: `sales`/`sale_lines`, `rental_bookings`, `rental_agreements`, `expenses`, `stock_intakes`. Only `v_unit_status_events` names a view.
- **The concrete divergent outcome:** the developer who reads the prose selects from `v_net_sale_lines`; the developer who reads the table two lines below selects from `rental_bookings` directly — which the prose calls a greppable violation. Worse, **`stock_intakes.purchased_on` has no view among AD-13's five**, so for Q17 there is no compliant path at all and the "no exceptions" claim is false as written. This was introduced by this update: the general rule was strengthened while only one row of its own table was changed to match.
- **The tightening:** rewrite the Row source column so every cell names the view that serves it, and resolve `stock_intakes` one of two ways — add a sixth view, or state that `DATE`-typed anchors (`incurred_on`, `purchased_on`) are the named exception because they need no conversion and the timezone hazard does not reach them. The second is honest and cheaper, but it must be *said*, since the prose currently denies any exception exists.

### H-3 — AD-8's booked-unit guard forces either an unsanctioned cross-module table read or an import cycle

- **Two units:** *Units epic (implements the guard)* and *Rentals epic (calls `transitionUnit` at hand-over and settlement)*.
- **The AD they both obey:** AD-8's new clause — a transition out of `IN_STOCK` is refused "whenever an open booking on that unit covers today or later" — and the Dependency direction rule, "A service may call another module's service."
- **The concrete divergent outcome:** to evaluate that predicate, `units.service` must learn about `rental_bookings`. Developer A queries the table directly from `units.service` — a write-side cross-module table read the spine neither permits nor forbids anywhere. Developer B calls `rentals.service`, which is the reading the dependency rule invites — and `rentals.service` already calls `units.service.transitionUnit()`, so this is a **circular import that fails at module load under ESM**. Both are faithful readings of the spine; one of them does not start.
- **The tightening:** name the answer. The direct query is correct here — it is one predicate against one table, and the alternative is a genuine cycle — but the spine must carve it out explicitly as the one sanctioned write-side cross-module table read, or the cycle gets built first and discovered at boot.

### H-4 — `client_request_uuid` is `NOT NULL UNIQUE` on a table where one gesture inserts N rows

- **Two units:** *Rentals / multi-unit booking (AD-21)* and *Rentals / replay handling (AD-22)*. (Pre-dates this update; still live, so recorded.)
- **The AD they both obey:** AD-22 (`client_request_uuid UUID NOT NULL UNIQUE`, stored by "the booking/hand-over gesture's **first** `rental_bookings` row") and AD-21 (a three-saree group is three `rental_bookings` rows inserted in one gesture, sharing a `group_uuid`).
- **The concrete divergent outcome:** rows two and three must carry a value that is non-null and unique and means nothing. Developer A fabricates a throwaway UUID per sibling — the column now holds a mix of real idempotency keys and noise, and any later query that treats it as "the gesture that created this row" is wrong for two rows in three. Developer B makes the column nullable, silently contradicting the AD's stated shape. Neither is signalled as wrong by anything in the schema.
- **The tightening:** subsumed cleanly by C-2's `request_keys` table — with the key off the row entirely, the question disappears. Failing that, the column must be explicitly nullable with the uniqueness carried by a partial index, and AD-22 must say that only the group's first row carries it.

---

## MEDIUM

### M-1 — AD-17 never says which clock produces the minute prefix

- **Two units:** *Barcode epic (allocates a sheet)* and any later *validator or re-issue path*.
- **The AD they both obey:** AD-17, which gives the formula and the epoch but names no clock. AD-6 forbids `new Date()` for **shop-day reduction** specifically, so a builder can correctly conclude it does not reach a barcode prefix.
- **The concrete divergent outcome:** developer A computes minutes-since-epoch in JavaScript from the container's wall clock; developer B computes it in SQL from `now()`. A free-tier container's clock is the least reliable in the system and resets across every cold start, so the two can disagree — and a drifted container can reuse a prefix Postgres has already advanced past, which is exactly the collision the whole redesign exists to prevent. Uniqueness ends up resting on the weakest clock rather than the strongest.
- **The tightening:** state that the prefix is computed **in Postgres, in the same statement as `nextval`**, so one clock owns the value end to end and the JS path does not exist to be chosen.

### M-2 — Barcode sheet generation is a mutating, retried gesture with no idempotency key

- **Two units:** *Frontend (AD-19.1 retry)* and *Barcode epic*.
- **The AD they both obey:** AD-22, whose rule enumerates `sales` and `rental_bookings` header rows — barcode generation creates neither, so it sits outside the rule while remaining a mutating call the client is instructed to retry. AD-19.1 mandates that retry without exempting anything.
- **The concrete divergent outcome:** the cold start eats the PDF response, the client retries as told, a second block of numbers is burned and a **second, different sheet** streams back. The burned block is harmless gaps per AD-17, but the two documents are not the same and the user has no way to tell which one they printed and stuck onto stock.
- **The tightening:** either bring allocation under AD-22 with a persisted allocation record keyed by request, or state explicitly that barcode generation is exempt and the client must **not** auto-retry it. One or the other — AD-19.1 currently mandates the retry unconditionally.

### M-3 — AD-29 and AD-8 jointly leave a cashier unable to clear a damaged booked unit

- **Two units:** *Units epic (AD-8's refusal)* and *the permissions seeder (AD-29)*.
- **The AD they both obey:** AD-8 (marking a booked unit damaged is refused; staff "cancel the booking first") and AD-29 (a cashier holds no `RENTALS.CANCEL`).
- **The concrete divergent outcome:** a cashier finds a booked saree torn. They cannot cancel the booking and therefore cannot mark the unit damaged. The piece stays nominally on the floor and hand-over-eligible until a manager is physically present. This is not a data divergence — it is an operational dead end the two ADs create jointly and neither mentions, and the UX epic will discover it as a screen with no exit.
- **The tightening:** not necessarily a permission change — but the intended workflow must be stated, and AD-8's refusal message should name it, so the UX epic renders a route to a manager rather than a wall.

---

## LOW

- **L-1 — AD-2's signed-column exception list is not future-proof.** It enumerates `sale_lines.*_paise` on reversing lines and `sales.exchange_difference_paise`. C-1's rent-delta row would add a third, and `v_rental_income.amount_paise` is a *view* column carrying no constraint at all — worth saying, since the AD reads as though it covers every money column in the system.
- **L-2 — AD-17's restore argument rests on an assumption it states as fact.** "A restore takes far longer than a minute" holds for restore-from-backup, but the guarantee actually needed is narrower and should be the stated invariant: *the system must never resume issuing labels inside a minute that has already issued one.* Cheap belt-and-braces that makes it structural rather than probabilistic — on boot, refuse to issue until the current minute exceeds `max(left(barcode, 7))` over `units`.

---

## Checklist of tightenings

| # | Change | Where it lands |
|---|---|---|
| C-1 | Rent delta from an amendment becomes a signed income row on the amendment's own shop day; new `kind`; signed column | AD-31, AD-13, AD-2 |
| C-2 | Idempotency moves to a `request_keys` table keyed `(gesture_type, request_uuid)` | AD-22, migration 13/15 |
| H-1 | One anchor for a forfeited deposit — `written_off_at`; `LOST` alone never emits the row | AD-13, AD-32 |
| H-2 | Anchor table's Row source column names views; `stock_intakes`/`expenses` declared the named `DATE` exception | AD-14, AD-13 |
| H-3 | The booked-unit predicate is a sanctioned write-side cross-module table read, not a service call | AD-8, Dependency direction |
| H-4 | Subsumed by C-2; otherwise nullable column + partial unique, first row only | AD-22 |
| M-1 | Minute prefix is computed in Postgres, in the `nextval` statement | AD-17 |
| M-2 | Barcode allocation either gets an idempotency key or an explicit no-retry exemption | AD-22, AD-19.1 |
| M-3 | State the workflow when a cashier meets a damaged booked unit | AD-8, AD-29 |
| L-1 | Signed-column exception list stated as a closed set, views excluded | AD-2 |
| L-2 | Boot refuses to issue labels inside an already-used minute | AD-17 |
