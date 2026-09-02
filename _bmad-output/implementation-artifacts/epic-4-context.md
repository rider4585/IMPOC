# Epic 4 Context: Unit Lifecycle, Recovery & Loss Management

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Staff can transition units through damaged/lost/retired/maintenance statuses and recover lost items without corrupting stock value or money. This epic stands up a single `units.service.transitionUnit()` function as the sole writer of unit status, enforcing state machine rules via a table-driven guard. Every later epic that moves a unit (checkout, exchange, hand-over, return, write-off, recovery) calls into this function rather than writing status directly, ensuring atomic operations, durable audit trails, and concurrency safety via compare-and-swap on the unit's status column.

## Stories

- Story 4.1: Create `unit_status_events` table and stand up `units.service.transitionUnit()` as the sole writer
- Story 4.2: Mark a unit damaged or lost
- Story 4.3: Resolve a unit out of maintenance
- Story 4.4: Recover a lost unit

## Requirements & Constraints

**Functional:** A unit's lifecycle is enforced by a state machine (unit-state-machine.md) allowing retail and rental channels different paths. Staff transition units through `DAMAGED`, `LOST`, `RETIRED`, `IN_MAINTENANCE` statuses; a recovery action brings a lost unit back to `IN_STOCK`, `IN_MAINTENANCE`, or `RETIRED` without reversing money. Every transition writes an audit row to `unit_status_events` with who acted, when, why (cause), and an optional reason.

**Non-functional:** All transitions are atomic — status and audit row commit together or neither does. Concurrent transitions on the same unit race via compare-and-swap; only one wins and commits; the loser sees the unit's real current status and is refused. Recovery is `ADMIN`/`MANAGER`-only and requires a mandatory reason (a CHECK constraint on the table backs this up). Once a unit leaves `IN_STOCK`, its price and rental snapshots are frozen forever and never thawed by recovery. A `LOST → RETIRED` recovery is one event row, not two, so shrinkage nets to zero across loss and recovery.

## Technical Decisions

**AD-1 (UUID on the wire):** All routes return and accept `uuid` only; internal `id` never leaves the process except for `unit.barcode` as the scan-time lookup key.

**AD-3 (Constrained strings):** `units.status` and cause values are `VARCHAR` plus named `CHECK` constraints; every value is `UPPERCASE_SNAKE` (`IN_STOCK`, `DAMAGED`, `LOST`, `RETIRED`, `IN_MAINTENANCE`). The same set is mirrored as a constant in `backend/src/constants/unit-status.js` and `backend/src/constants/unit-status-cause.js`.

**AD-5 (Row mutability):** `unit_status_events` is append-only-ledger tier — INSERT only, never UPDATE or soft-delete. Corrections on other ledgers are reversing rows; this table has no corrections at all.

**AD-8 (Concurrency via compare-and-swap):** `transitionUnit()` is the sole writer of `units.status`, `units.channel`, the three rental snapshots (`rent_per_day_paise`, `deposit_paise`, `overdue_per_day_paise`), and `unit_status_events`. Transitions use a conditional UPDATE on the unit's current status; zero rows means another transaction won or the transition is illegal from the real current status — the service re-reads and throws a 409 naming the barcode and actual status (CAP-10). A table-driven guard built once in `units.service.js` contains the complete `(channel, from, to)` state machine for both channels, ready for later epics to call.

**AD-22 (Idempotency):** Every transition request carries a client-generated `requestUuid` (UUIDv4); a replay returns the original committed result unchanged.

**AD-29 (Permission: `INVENTORY.RECOVER_LOST`):** Recovery is gated to `ADMIN` and `MANAGER` only, not `INVENTORY_MANAGER`, `CASHIER`, or `ACCOUNTANT`. This permission is added in a scoped seeder migration.

**AD-35 (Recovery specifics):** A recovered unit's entire effect is one `unit_status_events` row and the status column — nothing is reversed in sales, expenses, or rental tables. Recovery restores stock value (buying price snapshot at intake) but no money moves. A future dashboard report will derive shrinkage at read time from the event's cause, original status, and the unit's buying price, never from a stored column.

## Cross-Story Dependencies

**Resolved dependency on Epic 3:** Story 3.3 creates units and writes to `unit_status_events` at intake, so this table must exist before Epic 3 ships. Story 4.1 creates the table immediately after `units` (migration 13) rather than at the later position suggested in the Requirements Inventory, because that position describes when optional FK constraints become addable, not when the table itself is created.

**Resolved dependency on Epic 7:** AD-8's booked-unit guard (refusing a transition out of `IN_STOCK` other than hand-over while a live booking covers today or later) requires `rental_bookings`, which doesn't exist until Epic 7. Story 4.1 builds the guard as an ordered list of pre-write checks so Epic 7 can append the booking predicate once both the table and the check can be wired together. There is never a gap where a live booking exists and the guard fails to see it.

**Later epics' transitions:** Stories 5.x (checkout/sale), 6.x (exchange), 7.x (hand-over), 8.x (return/write-off) each call `transitionUnit()` with their own causes (SALE, EXCHANGE, HAND_OVER, RETURN, WRITE_OFF), which Story 4.1 pre-allocates in the cause enum so the guard covers them all at once.
