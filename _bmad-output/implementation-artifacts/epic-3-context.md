# Epic 3 Context: Buying Trips & Lot Intake

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Staff can record buying trips against vendors, define lots with product details and pricing, scan physical units into stock, and leverage convenience shortcuts (clone-last-lot, size-run mode) to streamline intake work. This epic establishes the core data model for inventory tracking — every unit that enters the shop must come through a trip and lot, and the pricing snapshot taken at intake is immutable for the unit's lifetime, separating it from the lot's editable source values.

## Stories

- Story 3.1: Record a buying trip
- Story 3.2: Define a lot against a trip
- Story 3.3: Scan units into a lot
- Story 3.4: Clone the last lot
- Story 3.5: Size-run intake mode
- Story 3.6: Vendor detail — trip, lot and unit history

## Requirements & Constraints

**Functional:**
- A trip captures the vendor, purchase date, bill reference, and total paid; every lot is tied to exactly one trip.
- A lot is defined per-product-type with quantity and a complete pricing tier (buying, selling, floor prices); it may optionally carry rental terms (rent-per-day, deposit, overdue-per-day).
- A unit scanned into a lot copies its lot's prices and rental terms at that instant and is never re-synced if the lot is edited afterwards.
- A barcode can never be bound to more than one unit; a scan against an already-bound barcode fails and names the existing unit.
- A lot cannot accept a scan once its declared quantity is reached.
- Deactivated vendors and inactive picklist entries (colour, size, product type) are rejected at intake, completing deferrals from earlier epics.
- The lot is the template — there is no separate product master or catalogue table; clone-last-lot copies field values from a prior lot.

**Non-functional:**
- All money is stored and computed as `BIGINT` paise with a `_paise` suffix and a named `CHECK (... >= 0)` constraint; pricing columns on `stock_intake_lines` and `units` carry this.
- For rental lots, `overdue_per_day_paise` carries a standalone `CHECK (... > 0)` because the read-side divides by it to cap rental periods.
- Every table carries `deleted_at` for soft deletion and `created_at`/`updated_at` timestamps; `stock_intake_lines` and `units` use the mutable-master-data tier (ordinary UPDATE and soft-delete).
- The API exposes UUIDs only (`uuid` for trips/lots/units); internal `id` never leaves the process.
- Variance between paid and scanned costs is computed on read as `totalPaidPaise - Σ(quantity × buyingPrice)` and never stored; it updates whenever a lot is edited.
- Scans are validated transactionally against active picklists and bounds before insertion; at least one automation verifies a unit's price snapshot remains unchanged even if its lot is later edited.

## Technical Decisions

**Data model:**
- Migrations 10–12: `stock_intakes`, `stock_intake_lines`, `units`.
- `units.status` (per AD-3) is a `VARCHAR` with a named `CHECK` restricting values to those in `unit-state-machine.md`, starting at `IN_STOCK` at intake.
- `units.channel` is `RETAIL` or `RENTAL` (named `CHECK`, mirrored in `channel.js` constant).
- A partial unique index on `units.barcode WHERE deleted_at IS NULL` is the **only guard** against double-binding (no application-level dedup, per the spec's explicit constraint).

**Transactional coherence:**
- Unit insertion delegates to `units.service` even at scan time, preserving AD-8's rule that `units.service` is the sole writer of `units.status` and `unit_status_events`.
- A successful scan inserts both a `units` row and a `unit_status_events` row (from `NULL` to `IN_STOCK` with cause `INTAKE`) in one transaction, opened by the service; both exist or neither does.

**Pricing snapshots (AD-24 tier one):**
- At scan time, the unit copies `buying_price_paise`, `selling_price_paise`, `floor_price_paise`, and (when rental) `rent_per_day_paise`, `deposit_paise`, `overdue_per_day_paise` from the lot, verbatim, at that instant.
- Later edits to the lot leave the unit's snapshots unchanged; automation confirms this invariant.

**Permissions:**
- `POST /stock-intakes` and `POST /stock-intake-lines` and `POST /stock-intake-lines/:uuid/scan` require `authorize(PERMISSIONS.INVENTORY.CREATE)`.
- `PATCH /stock-intake-lines/:uuid` requires `authorize(PERMISSIONS.INVENTORY.UPDATE)`.
- `GET` routes require `authenticate` only.
- No new permission constant is added for intake (NFR-15 does not mandate one).

## Cross-Story Dependencies

- Story 3.2 depends on `stock_intakes` existing (Story 3.1's migration 10).
- Story 3.3 depends on `stock_intake_lines` existing (Story 3.2's migration 11).
- Story 3.4 depends on at least one lot existing in a trip; it is a read-only endpoint returning pre-fill data.
- Story 3.5 is entirely client-side sequencing over Story 3.3's scan endpoint; no new backend route or table.
- Story 3.6 (vendor detail view) is sequenced last because it reads `stock_intakes`, `stock_intake_lines`, and `units` — all created by this epic — and it carries forward the vendor history view deferred from Epic 2.
