## Epic 3: Buying Trips & Lot Intake

Staff can record a buying trip, define a lot against it, and scan physical units into stock - including the clone-last-lot and size-run shortcuts. Migration order continues the spine's binding sequence: `stock_intakes` (migration 10), then `stock_intake_lines` (migration 11), then `units` (migration 12). Lot definition enforces floor price ≤ selling price and overdue-per-day > rent-per-day server-side (FR6/CAP-6); `overdue_per_day_paise` additionally carries its own standalone `CHECK (... > 0)` on both `stock_intake_lines` and `units` (AD-2), since AD-16's read-side division by it needs more than "greater than a possibly-negative rent" to stay safe. A unit copies its lot's prices and, for a rental-channel lot, its rental terms at intake and never re-reads them afterwards (AD-24 tier one) - editing a lot after units exist changes only the lot row. Scanning a barcode already bound to any unit is refused, naming the existing unit (CAP-7); a lot cannot accept a scan once its declared quantity is reached. Intake also completes two validations Epic 2 explicitly deferred here: rejecting a colour, size or product type that is not an active picklist entry, and rejecting a trip against a deactivated vendor. There is no reusable product-template table (NFR14) - the lot is the template, so clone-last-lot (CAP-8) copies a previous lot's field values rather than instantiating from a catalogue. **Carried over from Epic 2:** the vendor detail view (FR4's second half) is sequenced last in this epic, once the trip, lot and unit stories give it something to read.

**Frontend added this run (Stories 3.7-3.12), continuing the frontend restructure that began with Epic 1's Stories 1.10-1.17 and Epic 2's Stories 2.5-2.8:** the Trips screen (list, create, trip detail with its variance strip), the Lot form, Lot intake's scan loop with the `N of M` counter, Clone last lot, Size-run mode, and the Vendor detail history view carried over from Epic 2. This is where `EXPERIENCE.md`'s Scan Primitive gets its first real screen in this build: arm -> decode -> disarm -> act -> commit -> re-arm, on a still screen with the camera off between units - deliberately **not** the retail cart's continuous-scan variant Epic 5 will later build, which keeps the camera armed for a whole cart session. Every screen imports Epic 1's `platform/money.js`, `platform/envelope.js`, and `platform/wakingRequest.js` rather than reimplementing any of the three; every list is paginated per AD-26; navigation is permission-driven throughout, gated on `inventory.create` to match this epic's own backend routes. **This epic's acceptance bar, matching Epic 1's own:** after Story 3.12, Raviraj can record a real buying trip, define a lot, scan physical units into it - including a size run - clone a lot for a similar trip, and see a vendor's full trip/lot/unit history, entirely from the app he carries.

### Story 3.1: Record a buying trip

As an inventory manager,
I want to record a buying trip against a vendor with the date, bill reference and what I actually paid,
So that every lot I define afterwards is tied to a real vendor visit, and I can see at a glance whether what I paid matches what my lots cost (FR5/CAP-5).

**Acceptance Criteria:**

**Given** migration `09-create-vendors` has already run
**When** migration `10-create-stock-intakes` runs
**Then** it creates `stock_intakes` with `id`/`uuid` (AD-1), `vendor_id INTEGER NOT NULL REFERENCES vendors(id)`, `purchased_on DATE NOT NULL`, `bill_reference VARCHAR NULL`, `total_paid_paise BIGINT NOT NULL` with a named `CHECK (total_paid_paise >= 0)` (AD-2), `deleted_at TIMESTAMPTZ NULL` (AD-4), and `created_at`/`updated_at`
**And** the Sequelize model is registered `paranoid: true` per AD-4/AD-5's mutable-master-data tier

**Given** the table exists
**When** a new `stock-intake.service.js`'s `create({ vendorUuid, purchasedOn, billReference, totalPaidPaise })` is called with a `vendorUuid` that does not resolve to an existing, non-deleted vendor
**Then** it throws a 404-mapped error naming the missing vendor, and inserts no row

**Given** a vendor exists with `isActive = false`
**When** `create({ vendorUuid, ... })` is called against that vendor
**Then** it rejects with an error naming the vendor as inactive, and inserts no row - this is the validation Story 2.4 explicitly deferred to this epic: deactivating a vendor removes it from future trip entry

**Given** an active vendor
**When** `create({ vendorUuid, purchasedOn, billReference, totalPaidPaise })` is called with a missing or blank `purchasedOn`, or a negative `totalPaidPaise`
**Then** it rejects at validation before any `INSERT`, and no row is created

**Given** a trip has been recorded with no lots yet
**When** `GET /api/stock-intakes/:uuid` is called
**Then** it returns the trip's fields plus a derived `variancePaise` equal to `totalPaidPaise - Σ(line.quantity × line.buyingPricePaise)` over that trip's non-deleted `stock_intake_lines` - with no lots, the sum is zero and `variancePaise` equals `totalPaidPaise` - and `variancePaise` is never written to a column, recomputed on every read (CAP-5)

**Given** a trip has two lots with known quantities and buying prices
**When** `GET /api/stock-intakes/:uuid` is called
**Then** `variancePaise` reflects the current sum across both lots, and changes on the next read if a lot's `quantity` or `buyingPricePaise` is later edited (Story 3.2) - the figure is never stored, so no update path needs to keep it in sync

**Given** trips exist for several vendors
**When** `GET /api/stock-intakes` is called
**Then** it returns every non-deleted trip, most recent `purchasedOn` first, each exposing its own `variancePaise`

**And** every response exposes the trip's `uuid` and the vendor's `uuid` as `vendorUuid` - never either row's internal `id` (AD-1)
**And** `GET` routes require only `authenticate`; `POST` requires `authorize(PERMISSIONS.INVENTORY.CREATE)` - the existing generic inventory permission, since nothing about this story needs a new permission constant (NFR15)

### Story 3.2: Define a lot against a trip

As an inventory manager,
I want to add a lot to a buying trip with its product type, quantity, prices, channel and - for rentals - its rental terms,
So that every unit I later scan into this lot inherits correct, validated pricing and rental terms without me retyping them per piece (FR6/CAP-6).

**Acceptance Criteria:**

**Given** migration `10-create-stock-intakes` has already run
**When** migration `11-create-stock-intake-lines` runs
**Then** it creates `stock_intake_lines` with `id`/`uuid` (AD-1), `stock_intake_id INTEGER NOT NULL REFERENCES stock_intakes(id)`, `product_type_id INTEGER NOT NULL REFERENCES product_types(id)`, `name VARCHAR NOT NULL`, `quantity INTEGER NOT NULL`, `buying_price_paise`/`selling_price_paise`/`floor_price_paise BIGINT NOT NULL` each with a named `CHECK (... >= 0)` (AD-2), `channel VARCHAR(10) NOT NULL` with a named `CHECK` restricting it to `RETAIL`/`RENTAL` (AD-3), `rent_per_day_paise`/`deposit_paise`/`overdue_per_day_paise BIGINT NULL`, `deleted_at TIMESTAMPTZ NULL` (AD-4), and `created_at`/`updated_at`
**And** named `CHECK (floor_price_paise <= selling_price_paise)` and `CHECK (overdue_per_day_paise > rent_per_day_paise)` constraints exist, plus a standalone `CHECK (overdue_per_day_paise > 0)` (AD-2) - `AD-16`'s later read-side division by this column means "greater than `rent_per_day`" alone would not keep it above zero, since `rent_per_day_paise` is itself unbounded below zero by these two CHECKs alone
**And** every constrained `channel` value mirrors `AD-3`'s `UPPERCASE_SNAKE` convention in a shared `channel.js` constants module the service validates against before any `INSERT`

**Given** the table exists
**When** a new `stock-intake-line.service.js`'s `create({ stockIntakeUuid, productTypeUuid, name, quantity, buyingPricePaise, sellingPricePaise, floorPricePaise, channel, rentPerDayPaise, depositPaise, overduePerDayPaise })` is called with `floorPricePaise` greater than `sellingPricePaise`
**Then** it rejects at validation before any `INSERT`, naming both figures - the `CHECK` is the backstop, this is the service-level guard CAP-6 requires

**Given** `channel` is `RENTAL`
**When** `create()` is called with `overduePerDayPaise` less than or equal to `rentPerDayPaise`, or with any of `rentPerDayPaise`/`depositPaise`/`overduePerDayPaise` missing
**Then** it rejects at validation naming the offending field(s) - a `NULL` rental field passes every `CHECK` comparison silently, so requiredness for a rental lot is enforced only in the service, not the database

**Given** `channel` is `RETAIL`
**When** `create()` is called with any of `rentPerDayPaise`/`depositPaise`/`overduePerDayPaise` supplied
**Then** the service nulls all three before `INSERT` - they are meaningless outside a rental lot per `domain-model.md`

**Given** a `productTypeUuid` that does not resolve to an existing, non-deleted product type
**When** `create()` is called
**Then** it throws a 404-mapped error naming the missing type, and inserts no row

**Given** a product type exists with `isActive = false`
**When** `create()` is called against that type
**Then** it rejects naming the product type as inactive, and inserts no row - the validation Story 2.1 explicitly deferred to this epic

**Given** a lot has been created
**When** `GET /api/stock-intakes/:uuid` is called
**Then** the trip's response includes the lot with its `quantity` and a derived `unitsScannedCount` of `0` (no units yet) alongside it - the `x of quantity` figure Flow 1's intake screen displays, recomputed on every read and never stored

**Given** a lot already has units scanned into it (Story 3.3)
**When** `PATCH /api/stock-intake-lines/:uuid` changes `buyingPricePaise`
**Then** only the lot row changes, and an automated test asserts a unit already scanned into that lot still carries its original `buying_price_paise` snapshot, unaffected by the edit - `AD-24`'s tier-one snapshot, `AD-5`'s mutable-master-data tier on `stock_intake_lines`

**And** every response exposes the lot's `uuid`, the trip's `uuid` as `stockIntakeUuid`, and the product type's `uuid` as `productTypeUuid` - never an internal `id` (AD-1)
**And** `GET` routes require only `authenticate`; `POST`/`PATCH` routes require `authorize(PERMISSIONS.INVENTORY.CREATE)` / `authorize(PERMISSIONS.INVENTORY.UPDATE)` as in Story 2.1

### Story 3.3: Scan units into a lot

As an inventory manager,
I want to scan a unit's barcode and record its colour and size against an open lot,
So that a physical piece becomes a trackable unit carrying its lot's prices and rental terms, without exceeding the lot's declared quantity or double-binding a barcode (FR7/CAP-7).

**Acceptance Criteria:**

**Given** migration `11-create-stock-intake-lines` has already run
**When** migration `12-create-units` runs
**Then** it creates `units` with `id`/`uuid` (AD-1), `barcode VARCHAR(12) NOT NULL`, `stock_intake_line_id INTEGER NOT NULL REFERENCES stock_intake_lines(id)`, `colour_id INTEGER NOT NULL REFERENCES colours(id)`, `size_id INTEGER NOT NULL REFERENCES sizes(id)`, `status VARCHAR NOT NULL DEFAULT 'IN_STOCK'` with a named `CHECK` restricting it to the values in `unit-state-machine.md` (AD-3), `channel VARCHAR(10) NOT NULL` with the same `RETAIL`/`RENTAL` `CHECK` as `stock_intake_lines` (AD-3), `buying_price_paise`/`selling_price_paise`/`floor_price_paise BIGINT NOT NULL` each with `CHECK (... >= 0)`, `rent_per_day_paise`/`deposit_paise BIGINT NULL` with `CHECK (... >= 0)` where not null, `overdue_per_day_paise BIGINT NULL` with a standalone `CHECK (overdue_per_day_paise > 0)` where not null (AD-2, mirroring `stock_intake_lines`), `deleted_at TIMESTAMPTZ NULL` (AD-4), and `created_at`/`updated_at`
**And** a partial unique index on `barcode WHERE deleted_at IS NULL` exists - **the only guard against a barcode being bound twice**, per `domain-model.md` and AD-17's "genuine last resort" framing

**Given** the table exists
**When** a new `intake.service.js`'s `scanIntoLot({ barcode, stockIntakeLineUuid, colourUuid, sizeUuid, actorUserId })` is called with a `barcode` already bound to an existing, non-deleted unit
**Then** it rejects with an error naming the existing unit - its barcode, current status, colour and size - and inserts no row (CAP-7's "refuses an already-bound barcode by naming the existing unit")

**Given** a lot whose `quantity` has already been reached (count of non-deleted units on that `stock_intake_line_id` equals `quantity`)
**When** `scanIntoLot()` is called against that lot
**Then** it rejects naming the lot and its declared `quantity`, and inserts no row (CAP-7's "blocks exceeding declared quantity")

**Given** a `colourUuid` or `sizeUuid` that resolves to an existing but inactive (`isActive = false`) picklist entry
**When** `scanIntoLot()` is called
**Then** it rejects naming the inactive colour or size, and inserts no row - the validation Story 2.2 explicitly deferred to this epic (FR3/CAP-3)

**Given** a `colourUuid` or `sizeUuid` that does not resolve to any existing, non-deleted entry
**When** `scanIntoLot()` is called
**Then** it throws a 404-mapped error naming the missing colour or size, and inserts no row

**Given** a valid scan against an open lot with room remaining
**When** `scanIntoLot()` succeeds
**Then** it runs inside one transaction, opened by the service (AD-10 - CAP-7 is one of AD-10's bound gestures), and delegates the actual row-writing to `units.service.js` rather than inserting `units` directly from `intake.service.js` - keeping AD-8's rule that `units.service` is the sole writer of `units.status` and `unit_status_events` intact even at creation, not only at later transitions
**And** the unit row copies `buying_price_paise`, `selling_price_paise`, `floor_price_paise`, `channel` from the `stock_intake_line`, and - only when `channel` is `RENTAL` - `rent_per_day_paise`, `deposit_paise`, `overdue_per_day_paise`, verbatim, at this instant (AD-24 tier one)
**And** the unit is inserted with `status = 'IN_STOCK'` and, in the same transaction, a `unit_status_events` row is inserted recording the transition from `NULL` to `IN_STOCK` with `cause = 'INTAKE'` and `actor_user_id` - the unit row and its first event both exist, or neither does

**Given** a unit has already been scanned into a lot
**When** that lot's prices are later edited (Story 3.2's `PATCH`)
**Then** the unit's own snapshot columns are unchanged - an automated test asserts the unit's `buying_price_paise` still differs from the lot's newly edited value, per AD-24's "no read path re-derives a snapshotted value by joining to its source"

**Given** a lot's declared `quantity` and its current scanned count
**When** `GET /api/stock-intake-lines/:uuid` is called
**Then** `unitsScannedCount` reflects the true count of non-deleted units on that lot, recomputed on every read

**And** every response exposes the unit's `uuid`, and its lot's `uuid` as `stockIntakeLineUuid` - never an internal `id` (AD-1)
**And** the scan-in route requires `authenticate` and `authorize(PERMISSIONS.INVENTORY.CREATE)` - the same permission as Story 3.1/3.2, since NFR15's enumerated new permission constants do not add an intake-specific one

### Story 3.4: Clone the last lot

As an inventory manager,
I want to clone the trip's most recently created lot into a new, fully editable lot,
So that a second similar lot from the same trip costs a couple of field edits instead of retyping every attribute (FR8/CAP-8).

**Acceptance Criteria:**

**Given** a trip has at least one non-deleted lot
**When** `POST /api/stock-intakes/:uuid/clone-last-lot` is called
**Then** it returns every field value copied from that trip's most recently created lot - `productTypeUuid`, `name`, `quantity`, `buyingPricePaise`, `sellingPricePaise`, `floorPricePaise`, `channel`, and (when rental) `rentPerDayPaise`/`depositPaise`/`overduePerDayPaise` - and creates no row itself; the clone is a pre-fill for the client's lot form, not a database write (CAP-8)

**Given** a trip has no lots yet
**When** `POST /api/stock-intakes/:uuid/clone-last-lot` is called
**Then** it responds with an error naming that the trip has no lot to clone, rather than returning an empty or null-filled payload

**Given** the clone-last-lot payload has been returned and the user edits some fields
**When** the client submits `POST /api/stock-intake-lines` (Story 3.2's create endpoint) with the edited values
**Then** it validates and inserts exactly as any other new lot - Story 3.2's floor-≤-selling, overdue-per-day-greater-than-rent-per-day, active-product-type, and rental-field-requiredness checks all apply unchanged; the clone inherits Story 3.2's validation, not an exemption from it

**Given** the original lot already has units scanned against it
**When** a cloned lot is created from it and its own units are subsequently scanned in (Story 3.3)
**Then** the original lot and its existing units remain completely untouched - the clone is an independent row from the moment it is created (AD-5's mutable-master-data tier: a clone is a new row, editing it never touches the original)

**And** two automated tests confirm this: cloning and submitting unedited returns a lot indistinguishable in content from the original but with its own `uuid`; and deleting or later editing the clone does not alter the original lot's row or its units' snapshots

**And** the clone-last-lot route requires `authenticate` and `authorize(PERMISSIONS.INVENTORY.CREATE)` - it is read-only against existing data but gates entry into the same lot-creation flow Story 3.2 protects

### Story 3.5: Size-run intake mode

As an inventory manager scanning a lot that varies only by size,
I want an auto-advancing size sequence during intake with wraparound and a per-scan override,
So that I don't have to reselect the same size field for every piece in a run, while still being able to correct one out-of-order piece without breaking the sequence (FR9/CAP-9).

**Acceptance Criteria:**

**Given** the intake screen for an open lot
**When** the inventory manager turns on size-run mode and configures a run from the active size picklist (for example S, M, L, XL)
**Then** the run's sequence state - the ordered list and the "next" index - lives entirely client-side; no new table, column, or backend endpoint is created to persist it, since CAP-9's sequence state is client-side by the same AD-25 reasoning that keeps the retail cart client-side

**Given** size-run mode is on with the run `[S, M, L, XL]` and the chip reads "Next: S"
**When** a barcode is scanned and the unit is saved without changing the size field
**Then** the client posts an explicit `sizeId` for S to Story 3.3's unchanged `scanIntoLot` endpoint - the server cannot distinguish a size-run scan from an ordinary one, and validates the submitted `sizeId` exactly as Story 3.3 specifies, including the active-picklist check

**Given** four consecutive scans have recorded S, M, L, XL in order
**When** a fifth unit is scanned and saved without changing the size field
**Then** the client pre-fills S again - the run wraps back to its start

**Given** the run is at "Next: M"
**When** the user changes the size field on that scan to L before saving, and the save succeeds
**Then** the sequence advances to "Next: L" as though M had been scanned - one overridden scan does not reset or skip the run; it simply advances past whatever position it was on (CAP-9's "per-scan override that doesn't break the sequence")

**Given** a size included in the configured run is deactivated on the picklist mid-run (Story 2.2's `PATCH`)
**When** the client's next-in-sequence position would land on that size
**Then** the client skips it and advances to the next active size in the run; if that scan is nonetheless submitted with the now-inactive size's id, the server refuses it exactly as Story 3.3 specifies, independent of what the client's sequence UI shows (CAP-3, CAP-9)

**Given** the active size picklist is empty
**When** the user attempts to turn on size-run mode
**Then** it is unavailable - a run cannot be configured from an empty size list

**And** no schema change or new backend route belongs to this story - the run is a client-side sequencing layer over Story 3.3's existing scan-in endpoint, and every request it sends remains a normal, independently-validated `scanIntoLot` call

### Story 3.6: Vendor detail - trip, lot and unit history

As an inventory manager,
I want a vendor's page to list every buying trip, lot and unit sourced from that vendor,
So that I can see a supplier's complete history in one place instead of cross-referencing trips, lots and units separately (FR4/CAP-4, carried over from Epic 2's Story 2.4).

**Acceptance Criteria:**

**Given** Story 2.4's `vendors` table and this epic's `stock_intakes`, `stock_intake_lines` and `units` tables all exist
**When** `GET /api/vendors/:uuid/history` is called for a vendor with trips
**Then** it returns every non-deleted `stock_intake` for that vendor, most recent `purchasedOn` first, each nested with its non-deleted `stock_intake_lines`, each nested with its non-deleted `units` - joined `vendor_id → stock_intake.id → stock_intake_line.id → unit`

**Given** a vendor has a trip with a recorded `totalPaidPaise`
**When** the history is fetched
**Then** each trip in the response includes its own derived `variancePaise`, computed exactly as Story 3.1's `GET /api/stock-intakes/:uuid` computes it, never a stored figure

**Given** a vendor has a trip with no lots yet
**When** the history is fetched
**Then** that trip appears with an empty `lines` array, not omitted from the response

**Given** a lot has no units scanned yet
**When** the history is fetched
**Then** that lot appears with an empty `units` array, not omitted

**Given** a vendor has never had a trip recorded against it
**When** `GET /api/vendors/:uuid/history` is called
**Then** it returns the vendor with an empty `trips` array - a 404 is reserved for a `vendorUuid` that does not resolve to any existing, non-deleted vendor at all

**Given** a vendor has been deactivated (`isActive = false`, Story 2.4)
**When** `GET /api/vendors/:uuid/history` is called
**Then** its full trip/lot/unit history returns unchanged - deactivation only removes the vendor from future trip-entry pickers (Story 3.1), never from its own past record

**And** every row in the response exposes only `uuid`s - trip, lot, unit, product type, colour, size - and never an internal `id` (AD-1), and each unit entry carries its `barcode`, colour, size and current `status`

**And** the route requires only `authenticate` - the same read tier as `GET /api/vendors` (Story 2.4) - since it is a read over data the vendor, trip, lot and unit screens already individually expose to any authenticated staff member

### Story 3.7: Trip screen - list, create, and detail with variance

As an inventory manager,
I want a Trips screen listing every buying trip, a way to record a new one against a vendor, and a trip-detail view showing the variance between what I paid and what my lots cost,
So that every lot I define is tied to a real vendor visit I can see the shape of at a glance (FR5/CAP-5).

**Acceptance Criteria:**

**Given** no `/trips` route exists yet
**When** this story is implemented
**Then** `navigation.js` gains `{ permission: PERMISSIONS.INVENTORY.CREATE, label: 'Trips', path: '/trips', element: TripsScreen }`
**And** a nested, unregistered route `/trips/:uuid` renders `TripDetailScreen.jsx`, guarded inline by the same `inventory.create` check `RouteGuard` applies to the registry entry - reached only by tapping a row, never listed in navigation itself, the same nested-route pattern Story 2.8 defers to this story for vendor detail

**Given** `GET /api/stock-intakes` (Story 3.1) returns every non-deleted trip, most recent first, each carrying its own derived `variancePaise`
**When** `TripsScreen.jsx` loads
**Then** it parses the response through `platform/envelope.js`, paginates per AD-26 (50/page, skeleton rows while loading), and each row shows the vendor's name, `purchasedOn`, and `variancePaise` formatted through `formatPaise()` in `{typography.money-sm}` - never a hardcoded rupee sign or a raw paise integer

**Given** the "New trip" action
**When** the inventory manager picks a vendor (from Epic 2's active-vendor set only - an inactive vendor does not appear in this picker, the client-side mirror of Story 3.1's server-side rejection), enters `purchasedOn`, an optional bill reference, and `totalPaidPaise` (entered in rupees, converted to paise before the request)
**Then** the screen calls `POST /api/stock-intakes`, and on success navigates straight to the new trip's detail screen - Flow 1's step 2 ("Trip detail opens with a variance strip reading *No lots yet*")
**And** attempting the same form against a vendor that was deactivated between opening the picker and submitting shows the server's own inactive-vendor rejection inline, since the picker's own filtering is advisory, not the authority (Story 3.1's own validation is)

**Given** `TripDetailScreen.jsx` for a trip with no lots yet
**When** it renders
**Then** the variance strip reads *No lots yet* rather than a computed ₹0 - even though the backend's `variancePaise` for a lotless trip numerically equals `totalPaidPaise`, this screen distinguishes "nothing to compare against yet" from "compared and it matches," per this epic's own Voice and Tone standard of naming the specific thing rather than showing a number that could be misread as a coincidental zero-variance match

**Given** a trip with one or more lots
**When** the detail screen renders
**Then** the variance strip reads *Recorded ₹{totalPaidPaise} · Lots ₹{Σ line cost} · Variance ₹{variancePaise}*, matching Flow 1's own closing line verbatim in shape, with the variance figure rendered in `{colors.money-out}` when negative (paid less than lots cost) or `{colors.money-in}` when positive (paid more) - this is the one plain arithmetic figure on this screen that does take a money-kind colour, since it is a genuinely counted comparison, not a bare price
**And** the strip is on `{components.surface-flat}`, since it carries a decided rupee comparison - DESIGN.md's binding rule ("anywhere a rupee figure is being decided or confirmed... FLAT") extends here to "being reconciled," the same reasoning this epic's implementation notes state explicitly

**Given** the trip's lots
**When** the detail screen renders below the variance strip
**Then** each lot appears as a `{components.surface-soft}` card (Story 3.2's fields: product type, name, quantity, prices, channel) with its own `unitsScannedCount / quantity` - the `8 of 12`-shaped figure Flow 1 describes, but at rest on the trip screen rather than mid-scan - and two actions per trip: *Add lot* (Story 3.8) and *Clone last lot* (Story 3.10, disabled/absent when the trip has no lots yet, per Story 3.4's own "no lot to clone" rejection)

**Given** the trip detail's own permission surface
**When** any of this story's actions render
**Then** all of them are gated on the same `inventory.create` permission the Trips nav entry already checks - no finer-grained permission exists per this epic's own precedent (NFR15 adds no intake-specific constant)

**And** automated tests cover: the trips list paginates and formats variance correctly; a lotless trip's variance strip reads "No lots yet"; a lotted trip's variance strip matches the backend's `variancePaise` sign and colour; the vendor picker excludes inactive vendors; and an inactive-vendor server rejection (a race with the picker) surfaces inline

### Story 3.8: Lot form

As an inventory manager,
I want to add a lot to a trip with its product type, quantity, prices, channel, and - for a rental lot - its rental terms, validated before I ever start scanning,
So that every unit I scan into it inherits correct pricing without a bad lot definition surfacing only after twelve pieces are already scanned (FR6/CAP-6).

**Acceptance Criteria:**

**Given** `TripDetailScreen.jsx`'s *Add lot* action (Story 3.7)
**When** it is tapped
**Then** `frontend/src/screens/LotForm.jsx` opens as a route nested under the trip (`/trips/:tripUuid/lots/new`), pre-filled with nothing, carrying fields for product type (a picker over Epic 2's active product-type tree only - an inactive type is excluded from the picker, mirroring the trip screen's vendor-picker pattern), name, quantity, buying/selling/floor price (rupees, converted to paise on submit), and channel (Retail/Rental segmented control)

**Given** `channel` is set to Rental
**When** the form renders
**Then** three further fields appear - rent per day, deposit, overdue-per-day (all rupees, converted to paise) - and disappear entirely, not just disable, when the channel is switched back to Retail, matching Story 3.2's own "the service nulls all three before INSERT" rule with a client-side mirror: this form never submits a value for those three fields on a Retail lot

**Given** the form's own client-side validation, mirroring Story 3.2's server checks so a mistake surfaces before the request rather than after
**When** floor price exceeds selling price, or (on a Rental lot) overdue-per-day is not greater than rent-per-day
**Then** the offending field(s) turn `{colors.danger}` inline before submit is even attempted - but the client check is advisory only; the actual submit still runs and the server's own rejection message (naming both figures, Story 3.2's own wording) is what displays if a value slips past the client check via some other path, since the client never overrides the server as the source of truth

**Given** a `productTypeUuid` deactivated between the picker loading and the form submitting
**When** `POST /api/stock-intake-lines` is called
**Then** the server's own "inactive product type" rejection (Story 3.2) displays inline, exactly as Story 3.7's vendor-race handling does - the same pattern, restated here rather than abstracted into a shared component this run's scope doesn't call for

**Given** a successful submit
**When** the lot is created
**Then** the form closes and the trip detail screen's lot list (Story 3.7) shows the new lot card immediately, with `0 / {quantity}` scanned and a *Start scanning* action - the entry point into Story 3.9

**And** automated tests cover: the rental fields appear/disappear with the channel toggle and are never submitted for a Retail lot; the floor-vs-selling and overdue-vs-rent client warnings render inline before submit; and a successful lot creation returns the user to trip detail with the new lot visible

### Story 3.9: Lot intake - scan units into a lot, with the arm-decode-confirm-save-re-arm cadence

As an inventory manager,
I want to scan a unit's barcode, confirm its colour and size on a still screen, and save it against an open lot, watching the count climb toward the lot's declared quantity,
So that a physical piece becomes a trackable unit without me risking a double-bound barcode or losing count of how many are left (FR7/CAP-7).

**Acceptance Criteria:**

**Given** a lot's *Start scanning* action (Story 3.8)
**When** it is tapped
**Then** `frontend/src/screens/LotIntake.jsx` opens at `/trips/:tripUuid/lots/:lotUuid/scan`, rendering `{components.intake-counter}` reading `{unitsScannedCount} of {quantity}` in `{typography.counter}`, camera **off**, and a single `{components.thumb-action-bar}` primary action reading *Scan barcode* - the Idle state of the Scan Primitive (`EXPERIENCE.md` -> The Scan Primitive -> Idle), explicitly not the retail cart's continuous variant; this screen never keeps the camera armed between units

**Given** the *Scan barcode* action is tapped (Armed)
**When** the camera starts
**Then** `{components.scan-viewfinder}` fills the upper two-thirds, the gold aperture renders per `DESIGN.md`'s `{components.scan-viewfinder}` spec, `BarcodeScanner.jsx`'s inherited decode pipeline (Epic 1's Story 1.16 - native `BarcodeDetector` with `@zxing/browser` fallback) is mounted for the first time since that story left it unmounted, and a *Cancel* affordance is always present, returning to Idle at no cost - a decode never commits anything, so cancelling loses nothing

**Given** a successful decode (Decoded)
**When** the barcode reads
**Then** the camera turns off in the same instant - not after a delay - `{components.scan-result-card}` replaces the viewfinder showing the barcode in `{typography.barcode}` and the lot's inherited prices beneath it, one short haptic pulse fires, and two fields appear, pre-filled from the **previous unit saved in this session** (colour and size) - empty on the very first scan of the lot, per Flow 1 step 8's "pre-filled from the last unit" behaviour - both fields sourced from Epic 2's active-only colour/size picklists (an inactive entry is excluded from these pickers, the same client-side mirror pattern used throughout this epic)

**Given** the Act state, with the scan result card and its two fields on screen
**When** the inventory manager changes nothing, or changes one or both fields, then taps *Save unit*
**Then** the screen calls `POST` to Story 3.3's `scanIntoLot` endpoint (via a new `frontend/src/services/intakeApi.js` built on `platform/apiClient.js`) with the barcode, `stockIntakeLineUuid`, `colourUuid`, `sizeUuid` - nothing is written before this tap; a decode alone commits nothing, matching the Scan Primitive's "nothing is ever committed by a decode alone" rule verbatim

**Given** the save succeeds
**When** the response returns
**Then** the counter increments from `{unitsScannedCount}` to `{unitsScannedCount + 1}` and an `aria-live="polite"` region announces "9 of 12 scanned" (`EXPERIENCE.md` -> Accessibility Floor) **only now, on commit** - never on decode - and the screen returns to Idle with a brief *Save unit* success state before re-arming; the next scan's colour/size pre-fill sources from this unit, not the one before it

**Given** the barcode is already bound to an existing unit
**When** the save attempt returns Story 3.3's "already used" rejection
**Then** `{components.scan-result-card}` is replaced by a refusal state naming the existing unit's barcode, current status, colour and size - *"Already used - barcode 0000451237 is a red kurti, in stock."* verbatim in shape, per `EXPERIENCE.md`'s Voice and Tone table and its "Barcode already used" state pattern - with a double haptic pulse, and dismissing the refusal re-arms the camera; nothing was written, and the counter does not move

**Given** the lot's declared `quantity` has already been reached
**When** the counter reads `{quantity} of {quantity}`
**Then** *Save unit* is disabled (the *Lot full* state - `EXPERIENCE.md`: *"12 of 12 - lot complete"*) and a *Close lot* action is offered in its place, returning to `TripDetailScreen.jsx`; the camera is never armed again from this screen once the lot is full, since there is nothing left to scan into it

**Given** a `colourUuid` or `sizeUuid` selected from the pre-filled fields was deactivated on the picklist between the pre-fill loading and the save
**When** the save is attempted
**Then** the server's own "inactive colour/size" rejection (Story 3.3) surfaces inline on the scan result card, exactly the same pattern as this epic's other picker-race handling

**Given** the API is cold at the moment *Save unit* is tapped
**When** the call is wrapped in `platform/wakingRequest.js`
**Then** `{components.waking-banner}` appears at 1200ms without blocking the screen - the scan result card and its fields stay interactive underneath it - and the counter ticks exactly once when the retried call finally succeeds, never twice, matching Flow 1's own "Cold start" callout

**Given** decode failure - ten seconds armed with no successful read
**When** the timeout is reached
**Then** an inline hint appears under the viewfinder (*"Hold the label flat, about 15cm from the camera"*) and a *Type the number instead* affordance appears beneath it, submitting the human-readable digits through the same `scanIntoLot` call a camera decode would - the server cannot tell the two apart and this screen gives manual entry no different treatment, per `EXPERIENCE.md`'s Decode Failure section

**And** automated tests cover: the counter increments only on a successful save, never on decode; colour/size pre-fill from the previous saved unit and are empty on the lot's first scan; the barcode-already-used refusal names the existing unit and re-arms on dismiss without incrementing the counter; the lot-full state disables Save and offers Close lot; the waking banner appears on a delayed save without double-incrementing; and manual barcode entry submits through the same endpoint as a camera decode

### Story 3.10: Lot form - clone last lot

As an inventory manager,
I want to clone a trip's most recently created lot into a new, fully editable lot form,
So that a second similar lot costs a couple of field edits instead of retyping every attribute (FR8/CAP-8).

**Acceptance Criteria:**

**Given** `TripDetailScreen.jsx`'s *Clone last lot* action (Story 3.7), present only when the trip has at least one lot
**When** it is tapped
**Then** the screen calls `POST /api/stock-intakes/:uuid/clone-last-lot` (Story 3.4), and on success opens `LotForm.jsx` (Story 3.8) pre-filled with every returned field - the same form, the same validation, the same submit path - rather than a separate cloning screen; the clone is a pre-fill for the existing form, exactly as Story 3.4's backend frames it, not a new component

**Given** the trip has no lots yet
**When** *Clone last lot* is tapped (a state this story does not expect to reach, since Story 3.7 hides the action until a lot exists, but the server is still the authority)
**Then** the server's "no lot to clone" rejection displays inline rather than opening a blank or null-filled form - the client-side hiding of the action is advisory, matching this epic's consistent pattern of never trusting a client-side guard as the sole protection

**Given** the pre-filled clone form
**When** the inventory manager edits the name and quantity (Flow 2's example: "V-neck kurti", quantity 8) and submits
**Then** the clone submits through the exact same `POST /api/stock-intake-lines` call Story 3.8 already builds - Story 3.2's floor-≤-selling and overdue-per-day checks apply unchanged, and the original lot and its units remain untouched, since the clone is a wholly new row from the moment of creation

**And** automated tests cover: the clone pre-fills every field from the trip's last lot; editing and submitting creates an independent lot leaving the original's units unaffected; and the no-lot-to-clone rejection surfaces correctly when the action is somehow reached with none available

### Story 3.11: Lot intake - size-run mode

As an inventory manager scanning a lot that varies only by size,
I want an auto-advancing size sequence during intake, with wraparound and a per-scan override that doesn't break the sequence,
So that I stop reselecting the same size field for every piece in a run, while still being able to correct one out-of-order piece (FR9/CAP-9).

**Acceptance Criteria:**

**Given** `LotForm.jsx` (Story 3.8)
**When** this story is implemented
**Then** a "Size-run mode" toggle is added, revealing a run-builder that lets the inventory manager pick an ordered subset of Epic 2's active sizes (for example S, M, L, XL) - unavailable, per Story 3.5's own condition, when the active size picklist is empty
**And** the run's sequence state - the ordered list and the "next" index - lives entirely in `LotIntake.jsx`'s (Story 3.9) client-side component state; no new endpoint, table, or column is created or called for this story, matching Story 3.5's own "client-side by the same AD-25 reasoning" framing

**Given** size-run mode is on with a run `[S, M, L, XL]`
**When** `LotIntake.jsx` renders with the run active
**Then** `{components.size-run-chip}` appears reading *Next: S*, and the size field on the scan result card (Story 3.9's Act state) pre-fills with S rather than with the previous unit's size - size-run mode's pre-fill rule **replaces** Story 3.9's ordinary "pre-fill from the last unit saved" rule for the size field specifically; colour still pre-fills from the last unit as Story 3.9 already specifies, since size-run mode says nothing about colour

**Given** a unit is saved without changing the pre-filled size
**When** the save succeeds
**Then** the chip advances to *Next: M* - and if the sequence had just completed XL, the fifth save's chip reads *Next: S* again, the run wrapping per Story 3.5's own wraparound rule

**Given** the chip reads *Next: M* and the inventory manager changes the size field to L before saving, and that save succeeds
**When** the chip's position is recalculated
**Then** it advances to *Next: L* as though M had been scanned - the override consumed the M slot and the sequence continues past it unbroken, matching Story 3.5's "one overridden scan does not reset or skip the run" rule and Flow 3's climax exactly

**Given** a size in the configured run is deactivated on the picklist mid-run (Story 2.6's `PATCH`)
**When** the sequence's next position would land on that size
**Then** the client skips it, advancing the chip to the next active size in the run; if the now-inactive size is nonetheless submitted (a race), the server's own inactive-size rejection (Story 3.3) applies exactly as Story 3.9's ordinary picker-race handling already does - size-run mode adds no exemption from that check

**And** automated tests cover: the chip pre-fills the size field and advances only on a successful save; the run wraps after its last member; an overridden scan advances the sequence past the overridden slot without resetting it; a mid-run deactivated size is skipped by the chip; and the toggle is unavailable when no active sizes exist

### Story 3.12: Vendor detail screen - trip, lot and unit history

As an inventory manager,
I want a vendor's own page listing every buying trip, lot and unit sourced from them,
So that I can see a supplier's complete history in one place instead of cross-referencing trips, lots and units separately (FR4/CAP-4, carried over from Epic 2's Story 2.8).

**Acceptance Criteria:**

**Given** Story 2.8's `VendorsScreen.jsx` renders vendor rows with no navigation target yet
**When** this story is implemented
**Then** each row becomes tappable, navigating to `/vendors/:uuid`, and `frontend/src/screens/VendorDetail.jsx` is added as that route's element, guarded by the same `inventory.create` check `VendorsScreen.jsx` already sits behind - completing the split this epic's own backend implementation notes record between Story 2.4 (CRUD) and Story 3.6 (history)

**Given** `GET /api/vendors/:uuid/history` (Story 3.6) returns every non-deleted trip for the vendor, most recent first, each nested with its lots, each nested with its units
**When** `VendorDetail.jsx` loads
**Then** it renders the vendor's own fields (name, phone, address, notes, and the Active/Inactive label Story 2.8's list already shows) above a paginated trip list - the top-level trips list follows AD-26's envelope exactly as `TripsScreen.jsx` (Story 3.7) does, while each trip's nested lots and each lot's nested units render in full underneath their trip row, unpaginated, since the backend embeds rather than separately paginates those nested collections

**Given** a vendor with a trip that has no lots yet, or a lot with no units yet
**When** the history renders
**Then** that trip's lot section, or that lot's unit section, renders an explicit empty note rather than being omitted - matching the backend's own "empty array, not omitted" guarantee (Story 3.6) with a visible client-side equivalent

**Given** a vendor who has never had a trip recorded
**When** the screen loads
**Then** it shows the *Empty - no trips* state pattern (`EXPERIENCE.md`), stating what the surface is for, rather than a bare "No results" - a 404 is reserved for a `vendorUuid` that doesn't resolve at all, which this screen only reaches by a broken link, not by ordinary navigation

**Given** each trip nested in the history
**When** it renders
**Then** its `variancePaise` displays through `formatPaise()`, exactly as `TripDetailScreen.jsx` (Story 3.7) already renders it - the same component, `TripVarianceStrip`, is extracted and reused by both screens rather than reimplemented here, so the two screens can never drift in how they compute or colour the variance figure

**Given** each unit nested in a trip's lot
**When** it renders
**Then** it carries its barcode in `{typography.barcode}`, colour, size, and its current status rendered as plain, always-visible text (e.g. "In stock", "Sold") - Epic 4's Story 4.6, which builds the shared `{components.status-pill}` component per UX-DR3, ships after this epic in build order, so no shared component exists yet for this screen to import; this story's plain-text rendering already satisfies the accessibility floor's "colour is never the only signal" rule on its own terms, and is left as-is rather than retrofitted once Story 4.6 ships, since retrofitting an earlier epic's screen is out of this run's scope

**And** automated tests cover: a vendor with full history renders trips/lots/units correctly nested; a lotless trip and a unitless lot both show their explicit empty notes; a vendor with no trips at all shows the empty-surface state, not a bare no-results message; and the trip-level pagination controls behave identically to `TripsScreen.jsx`'s own

