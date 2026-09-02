## Epic 2: Reference Data & Vendor Registry

Staff can maintain the product-type/colour/size/damage-grade picklists and the vendor registry that every later purchase and intake record depends on. Sequencing continues the spine's migration order - picklists first, then vendors - and every story in this epic lands in `modules/picklists/` or `modules/vendors/` per the Capability to Architecture Map. Deactivating a picklist entry or a vendor is an ordinary UPDATE on the mutable-master-data tier (AD-5), never a soft delete (AD-4's "deactivate is not delete"): it flips `is_active` to `false` and touches nothing else, so every record already pointing at the entry is unaffected. Intake-side rejection of inactive entries is Epic 3's concern, not this epic's. Resolved here: the vendor's page listing every trip/lot/unit sourced from them (FR4's second half) moves to Epic 3, since it reads tables (`stock_intakes`, `stock_intake_lines`, `units`) that only Epic 3 creates - this epic ships vendor CRUD only.

**Frontend added this run (Stories 2.5-2.8), continuing the frontend restructure that began with Epic 1's Stories 1.10-1.17:** the Picklists screen (one nav entry, three tabs - product types, colours and sizes, damage grades) and the Vendors screen. Every screen here imports `platform/money.js`'s `formatPaise()`, `platform/envelope.js`'s collection parser, and `platform/wakingRequest.js`'s retry wrapper from Epic 1's `platform` module (Story 1.10) rather than building any of the three again; every list follows AD-26's `{ items, page, pageSize, total }` envelope; and navigation is driven entirely by `frontend/src/app/navigation.js`'s permission-gated registry (Story 1.15) - a role without `inventory.create` never sees "Picklists" or "Vendors" in navigation at all, per AD-29. Active and inactive entries render side by side in every tab and on the vendor list, visibly distinct by a text label and muted (`{colors.ink-faint}`) styling, never by hiding the inactive ones - the screens' own version of this epic's "deactivate is not delete" rule, and never colour alone. **This epic's acceptance bar, matching Epic 1's own:** after Story 2.8, Raviraj can open the app and actually shape the shop's own picklists and vendor list from his phone - create a product subtype, add a size in the right order, retire a damage grade, register a vendor - not just query them through the API.

### Story 2.1: Product type picklist with self-referencing hierarchy

As an inventory manager,
I want to create and maintain product types organised in a nestable hierarchy,
So that stock is categorised precisely (Kurti to V-neck, Saree to Paithani) instead of drifting into free text across lots (FR3/CAP-3).

**Acceptance Criteria:**

**Given** migration `04-create-request-keys` has already run
**When** migration `05-create-product-types` runs
**Then** it creates `product_types` with `id` (`SERIAL PRIMARY KEY`), `uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()` (AD-1), `name VARCHAR NOT NULL`, `parent_id INTEGER NULL REFERENCES product_types(id)`, `is_active BOOLEAN NOT NULL DEFAULT true`, `deleted_at TIMESTAMPTZ NULL` (AD-4), and `created_at`/`updated_at`
**And** two partial unique indexes exist - one on `name WHERE parent_id IS NULL AND deleted_at IS NULL` (top-level names unique) and one on `(parent_id, name) WHERE parent_id IS NOT NULL AND deleted_at IS NULL` (subtype names unique within their parent) - a bare `UNIQUE(parent_id, name)` is not used, since Postgres treats every `NULL` `parent_id` as distinct from every other and would let duplicate top-level names through
**And** the Sequelize model is registered `paranoid: true` with `deletedAt: 'deleted_at'` per AD-4, though nothing in this story issues a soft delete

**Given** the table exists
**When** a new `product-type.service.js`'s `create({ name, parentUuid })` is called with a `parentUuid` that does not resolve to an existing, non-deleted product type
**Then** it throws a 404-mapped error naming the missing parent, and inserts no row

**Given** a top-level type P already exists
**When** `create({ name, parentUuid: P.uuid })` is called
**Then** the new row's `parent_id` is set to P's internal `id`, and the API response returns the new type's own `uuid` and P's `uuid` as `parentUuid` - never either row's internal `id` (AD-1)

**Given** a product type exists
**When** its `parentUuid` is set, at creation or by update, to its own `uuid` or to the `uuid` of one of its own descendants
**Then** the service walks the ancestry chain before writing, rejects with an error naming the cycle, and inserts or updates no row - "a type may not be its own ancestor" per `domain-model.md`

**Given** active and inactive product types exist at multiple levels
**When** `GET /api/picklists/product-types` is called
**Then** it returns every non-deleted type, both active and inactive, so the admin screen can render inactive entries distinctly rather than hiding them - hiding inactive entries from new intake is Epic 3's concern, not this listing's

**Given** an active product type already referenced by existing units or lots
**When** `PATCH /api/picklists/product-types/:uuid` sets `isActive` to `false`
**Then** only `is_active` changes; `deleted_at` and every other column are untouched
**And** an automated test asserts a unit or lot already referencing the now-inactive type is unaffected and still resolves it by join, exactly as before

**And** `GET` routes require only `authenticate`; `POST`/`PATCH` routes additionally require `authorize(PERMISSIONS.INVENTORY.CREATE)` (create) or `authorize(PERMISSIONS.INVENTORY.UPDATE)` (update/deactivate) - the existing generic inventory permissions, since nothing about this story needs a new permission constant

### Story 2.2: Colour and size picklists

As an inventory manager,
I want to maintain the colour and size picklists,
So that intake records colour and size from a controlled list instead of free text, with sizes ordering correctly for size-run intake (FR3/CAP-3, feeding CAP-9).

**Acceptance Criteria:**

**Given** migration `05-create-product-types` has already run
**When** migrations `06-create-colours` and `07-create-sizes` run
**Then** each creates its own table with `id`/`uuid` (AD-1), `name VARCHAR NOT NULL`, `is_active BOOLEAN NOT NULL DEFAULT true`, `deleted_at TIMESTAMPTZ NULL` (AD-4), `created_at`/`updated_at` - `sizes` additionally carries `sort_order INTEGER NOT NULL`
**And** each table carries a partial unique index on `name WHERE deleted_at IS NULL`

**Given** the tables exist
**When** a new `colour.service.js`'s `create(name)` or `size.service.js`'s `create({ name, sortOrder })` is called with a `name` already used by a non-deleted row in that table
**Then** it rejects with a conflict error naming the existing entry, mapped from the unique-index violation per the repo's existing constraint-to-response convention

**Given** sizes S, M, L, XL exist with `sort_order` 1, 2, 3, 4
**When** `GET /api/picklists/sizes` is called
**Then** the list is ordered by `sort_order` ascending - this is the ordering CAP-9's size-run auto-advance sequence will consume in Epic 3; the auto-advance logic itself is not built here

**Given** an active colour or size already referenced by existing units
**When** `PATCH /api/picklists/colours/:uuid` or `PATCH /api/picklists/sizes/:uuid` sets `isActive` to `false`
**Then** only `is_active` changes; every other column, including `deleted_at`, is untouched
**And** an automated test confirms a unit already referencing the deactivated entry still resolves it unchanged (AD-4/AD-5)

**And** `GET` routes require only `authenticate`; `POST`/`PATCH` routes require `authorize(PERMISSIONS.INVENTORY.CREATE)` / `authorize(PERMISSIONS.INVENTORY.UPDATE)` as in Story 2.1
**And** every response exposes each row's `uuid` only - no route accepts or returns the internal `id` (AD-1)

### Story 2.3: Damage grade picklist

As an inventory manager,
I want to maintain the damage-grade list with its default charge and stock outcome,
So that rental settlement staff (Epic 8) grade a returned piece consistently, with the deduction and next stock outcome pre-filled from one source (FR3/CAP-3).

**Acceptance Criteria:**

**Given** migration `07-create-sizes` has already run
**When** migration `08-create-damage-grades` runs
**Then** it creates `damage_grades` with `id`/`uuid` (AD-1), `name VARCHAR NOT NULL`, `default_charge_paise BIGINT NOT NULL` with a named `CHECK (default_charge_paise >= 0)` per AD-2's money-column convention, `outcome VARCHAR(30) NOT NULL` with a named `CHECK` constraint restricting it to `RETURN_TO_STOCK`, `SEND_TO_MAINTENANCE`, `RETIRE` (AD-3), `sort_order INTEGER NOT NULL`, `is_active BOOLEAN NOT NULL DEFAULT true`, and `deleted_at TIMESTAMPTZ NULL` (AD-4)
**And** the same three outcome values are mirrored as a frozen object in a new `damage-grade-outcome.js` constants module, and `damage-grade.service.js` validates against that constant before any `INSERT` - the `CHECK` is the backstop, the constant is what the service reads (AD-3)
**And** a partial unique index on `name WHERE deleted_at IS NULL` exists

**Given** the table exists
**When** `damage-grade.service.js`'s `create()` is called with an `outcome` value outside the three allowed values
**Then** it rejects at validation before any `INSERT` is attempted - the `CHECK` constraint is never exercised on this path

**Given** damage grades exist with distinct `sort_order` values
**When** `GET /api/picklists/damage-grades` is called
**Then** it returns them ordered by `sort_order` ascending, mirroring Story 2.2's size ordering, so a settlement screen presents grades from Clean through Beyond repair in a fixed sequence

**Given** an active damage grade
**When** `PATCH /api/picklists/damage-grades/:uuid` changes `defaultChargePaise` or deactivates it
**Then** only the targeted columns change, and no guard blocks editing a grade that a settled rental agreement has already used - `domain-model.md`'s rule that a settled agreement's `damage_grade_id` is never re-resolved for its current `default_charge_paise` (AD-5) means the snapshot that protects historical figures lives on the agreement in Epic 8, not on this row

**And** `GET` routes require only `authenticate`; `POST`/`PATCH` routes require `authorize(PERMISSIONS.INVENTORY.CREATE)` / `authorize(PERMISSIONS.INVENTORY.UPDATE)` as in Story 2.1

### Story 2.4: Vendor registry

As an inventory manager,
I want to create and maintain vendor records,
So that every buying trip can be attributed to a known vendor instead of free text, with the vendor's contact details available at trip-entry time (FR4/CAP-4).

**Acceptance Criteria:**

**Given** migration `08-create-damage-grades` has already run
**When** migration `09-create-vendors` runs
**Then** it creates `vendors` with `id`/`uuid` (AD-1), `name VARCHAR NOT NULL`, `phone VARCHAR NULL`, `address TEXT NULL`, `notes TEXT NULL`, `is_active BOOLEAN NOT NULL DEFAULT true`, `deleted_at TIMESTAMPTZ NULL` (AD-4), and `created_at`/`updated_at`
**And** no uniqueness constraint is added on `name` or `phone` - `domain-model.md` does not require either to be unique, and two vendors sharing a trading name or a shared shop phone line is a legitimate case this schema must not block

**Given** the table exists
**When** `vendor.service.js`'s `create({ name, phone, address, notes })` is called with a blank or missing `name`
**Then** it rejects at validation - `name` is the one mandatory field, and no row is inserted

**Given** vendors exist, active and inactive
**When** `GET /api/vendors` is called
**Then** it returns every non-deleted vendor, including inactive ones, so the admin screen can render and reactivate a deactivated vendor rather than losing track of it

**Given** an active vendor
**When** `PATCH /api/vendors/:uuid` sets `isActive` to `false`
**Then** only `is_active` changes; the vendor row and every buying trip Epic 3 later attributes to it (once that table exists) remain unaffected - deactivation only removes the vendor from future trip-entry pickers, a validation Epic 3 enforces, not this story

**And** every response exposes the vendor's `uuid` only - no route accepts or returns the internal `id` (AD-1)
**And** `GET` routes require only `authenticate`; `POST`/`PATCH` routes require `authorize(PERMISSIONS.INVENTORY.CREATE)` / `authorize(PERMISSIONS.INVENTORY.UPDATE)` as in Story 2.1

**Note - vendor history view:** No story in this epic builds the vendor's trip/lot/unit history page. It ships in Epic 3, once `stock_intakes`, `stock_intake_lines`, and `units` exist for it to read (see Epic 3's implementation notes).

### Story 2.5: Picklists screen - product type hierarchy tab

As an inventory manager,
I want a Picklists screen with a product-type tab showing the full nested hierarchy, letting me create a new type or subtype and deactivate one without deleting it,
So that stock categorisation stays accurate at the counter without me touching the API directly, and a deactivated type is never mistaken for a deleted one (FR3/CAP-3, UX-DR16).

**Acceptance Criteria:**

**Given** no `/picklists` route exists yet
**When** this story is implemented
**Then** `frontend/src/app/navigation.js`'s registry (Story 1.15) gains one new entry - `{ permission: PERMISSIONS.INVENTORY.CREATE, label: 'Picklists', path: '/picklists', element: PicklistsScreen }` - and `frontend/src/screens/PicklistsScreen.jsx` renders as a tabbed shell with, for now, a single tab, "Product types"; Stories 2.6 and 2.7 add the remaining two tabs to this same shell rather than each registering a second nav entry
**And** a signed-in user without `inventory.create` (today's seeded `CASHIER`, `ACCOUNTANT`) never sees "Picklists" in navigation and is redirected away from `/picklists` if the path is entered directly, per Story 1.15's `RouteGuard` - the same registry-driven behaviour every earlier nav entry already gets, not a new mechanism

**Given** `GET /api/picklists/product-types` (Story 2.1) returns every non-deleted type, active and inactive, flat, with each row's own `parentUuid`
**When** the Product types tab loads
**Then** the screen calls it through `platform/apiClient.js`, parses the response through `platform/envelope.js`, and renders the flat list reassembled client-side into a nested tree by `parentUuid` - indenting each level, since the backend does not itself return a nested shape
**And** the call is wrapped in `platform/wakingRequest.js`, showing `{components.waking-banner}` at 1200ms exactly as every other screen does - this story adds no second retry mechanism

**Given** a type is inactive (`isActive: false`)
**When** it renders in the tree
**Then** it carries a visible, textual "Inactive" label next to its name - never colour alone - and its row uses `{colors.ink-faint}` for its text, distinguishing it from an active row without hiding it or moving it out of its place in the hierarchy; per this epic's own instruction, an inactive entry stays exactly where it is in the tree, visibly distinct, not filtered out

**Given** the "Add type" action, reached from the tab's `{components.thumb-action-bar}` primary action
**When** the inventory manager fills a name and optionally picks a parent from the existing active-and-inactive tree (a parent can be any existing type, active or not - Story 2.1's service only checks the parent exists and is non-deleted, not that it is active)
**Then** the screen calls `POST /api/picklists/product-types` with `{ name, parentUuid }`, shows the server's own message inline on a 404-missing-parent or a cycle rejection (Story 2.1's ancestry-walk error), and on success closes the form and the new row appears in the tree in its correct nested position without a full page reload

**Given** an existing type row
**When** the inventory manager taps *Deactivate* (active row) or *Reactivate* (inactive row)
**Then** the screen calls `PATCH /api/picklists/product-types/:uuid` with `{ isActive: false }` or `{ isActive: true }`, and the row's own tree position, name, and every other field stay untouched - only the Active/Inactive label and its muted styling flip; no confirmation modal is shown for this action, since it is instantly reversible and touches no existing unit or lot record (Story 2.1's own guarantee)

**Given** the tree can, in principle, run deep and wide as the shop's catalogue grows
**When** the tab renders
**Then** top-level types render collapsed by default with a chevron to expand their children - a UI convenience only; the backend returns the full flat list in one call (Story 2.1 defines no pagination for this endpoint), so this is client-side disclosure, not a paged fetch, and no AD-26 envelope fields (`page`/`pageSize`/`total`) apply here since the backend response for this route is a bare `items` array with no pagination metadata to begin with - noted here so a later reviewer doesn't expect page controls where the backend offers none

**Given** a signed-in `INVENTORY_MANAGER`, `MANAGER`, or `ADMIN` (all of whom hold `inventory.create` and `inventory.update` under today's seeded grants plus this epic's own - no dedicated constant per Story 2.1)
**When** either views or edits this tab
**Then** create/deactivate controls render for all three identically - the screen checks the same two permission constants Story 2.1's routes themselves check, never a role name

**And** automated tests cover: the tree renders correctly nested from a flat backend response; an inactive type shows the "Inactive" label and muted styling while remaining in its tree position; creating a subtype under an existing parent; the cycle-rejection message rendering inline; and the nav entry's absence for a `CASHIER` session

### Story 2.6: Picklists screen - colours and sizes tabs, with size ordering

As an inventory manager,
I want colour and size tabs on the same Picklists screen, with sizes always shown and offered in their configured sort order,
So that intake picks from a controlled list, and size-run mode (Epic 3) has a stable order to advance through (FR3/CAP-3, feeding CAP-9).

**Acceptance Criteria:**

**Given** Story 2.5's `PicklistsScreen.jsx` tab shell
**When** this story is implemented
**Then** two further tabs are added - "Colours" and "Sizes" - each a flat list (no hierarchy, unlike product types), each reusing the same active/inactive visible-distinction pattern Story 2.5 established (textual "Inactive" label, `{colors.ink-faint}`, row stays in place) - no second implementation of that pattern is written

**Given** `GET /api/picklists/sizes` (Story 2.2) returns rows already ordered by `sort_order` ascending
**When** the Sizes tab loads
**Then** the screen renders them in the order the response arrives, with no client-side re-sort - the backend's own ordering is the single source of truth this tab and, later, Epic 3's size-run mode both rely on
**And** each size row displays its `sortOrder` value next to its name, since staff configuring a run need to see and reason about the sequence, not just trust it invisibly

**Given** the "Add colour" / "Add size" actions
**When** a name (colour) or a name plus a numeric sort order (size) is submitted
**Then** the screen calls `POST /api/picklists/colours` or `POST /api/picklists/sizes`, and a same-name conflict (Story 2.2's unique-index-mapped rejection) shows the server's own message inline, naming the existing entry - never a generic "already exists"

**Given** an existing size's `sortOrder` needs to change (a size inserted between two existing ones)
**When** `PATCH /api/picklists/sizes/:uuid` is called with a new `sortOrder`
**Then** the tab re-renders the list in the new order on the next fetch - this story does not add drag-to-reorder; the sort order is a numeric field edited directly, since Story 2.2's backend never defines a bulk-reorder endpoint for this screen to call

**Given** a colour or size already referenced by an existing unit (Story 2.2's own guarantee)
**When** it is deactivated
**Then** only its Active/Inactive label changes on screen, exactly as Story 2.5's product-type deactivation behaves - this screen never queries whether a picklist entry is "in use" before allowing deactivation, since the backend itself places no such restriction (deactivation never touches existing records)

**And** automated tests cover: sizes render in the backend's returned order with no client re-sort; the sort-order value displays per row; a same-name rejection shows inline; and deactivating a colour or size leaves its row's other fields visibly unchanged

### Story 2.7: Picklists screen - damage grades tab

As an inventory manager,
I want a damage grades tab showing each grade's default charge and stock outcome in a fixed order,
So that Epic 8's settlement staff (once built) grade a return consistently, from one screen I can also maintain (FR3/CAP-3).

**Acceptance Criteria:**

**Given** Story 2.6's tab shell
**When** this story is implemented
**Then** a third tab, "Damage grades", is added, listing rows ordered by `sortOrder` ascending (Story 2.3's guaranteed ordering), each row showing its name, its `defaultChargePaise` formatted through `platform/money.js`'s `formatPaise()` - no ad hoc division-by-100 anywhere in this tab - and its `outcome` as plain text (`Return to stock` / `Send to maintenance` / `Retire`, mapped from the three `UPPERCASE_SNAKE` values Story 2.3's backend returns)

**Given** the "Add grade" action
**When** a name, a default charge (entered in rupees and converted to paise before the request - the one place this tab performs that conversion, inverse to `formatPaise()`), a sort order, and an outcome (picked from a fixed three-option control, never free text) are submitted
**Then** the screen calls `POST /api/picklists/damage-grades`, and a same-name conflict shows the server's own message inline, matching the other two tabs' pattern

**Given** a damage grade already used by a settled rental agreement (a case that cannot exist yet, since Epic 8's settlement stories are not built, but Story 2.3's backend explicitly permits editing a used grade's charge)
**When** `defaultChargePaise` is edited on this tab
**Then** the tab shows no warning and applies no guard of its own - Story 2.3's own acceptance criteria state the snapshot protecting a settled agreement's historical figure lives on the agreement, not this row, so this screen matches that by doing nothing special here

**And** automated tests cover: the three outcome values render as their plain-text labels, never the raw `UPPERCASE_SNAKE` constant; `defaultChargePaise` renders through `formatPaise()`; and grades render in `sortOrder` order

### Story 2.8: Vendor registry screen

As an inventory manager,
I want to browse, create, and deactivate vendors from their own screen, with active and inactive vendors both visible and clearly told apart,
So that every buying trip (Epic 3) can be attributed to a known vendor, and a deactivated vendor is never lost track of, only removed from future trip-entry pickers (FR4/CAP-4).

**Acceptance Criteria:**

**Given** no `/vendors` route exists yet
**When** this story is implemented
**Then** `navigation.js` gains `{ permission: PERMISSIONS.INVENTORY.CREATE, label: 'Vendors', path: '/vendors', element: VendorsScreen }`, absent from nav for a role without `inventory.create`, matching Story 2.5's gating rule and reasoning exactly

**Given** `GET /api/vendors` (Story 2.4) returns every non-deleted vendor, active and inactive
**When** the screen loads
**Then** it parses the response through `platform/envelope.js` and lists vendors in a single flat, paginated list per AD-26 - `{ items, page, pageSize, total }`, 50 per page - with skeleton rows at the page's own height while loading, per EXPERIENCE.md's "loading a page of a list" state pattern
**And** each row shows the vendor's name, phone (when present), and an "Inactive" text label plus `{colors.ink-faint}` styling for a deactivated vendor - the same active/inactive visible-distinction pattern Stories 2.5-2.7 already established, reused rather than reinvented a fourth time

**Given** the "Add vendor" action in `{components.thumb-action-bar}`
**When** a name (mandatory) with optional phone, address, and notes is submitted
**Then** the screen calls `POST /api/vendors`, and a blank-name rejection (Story 2.4's own validation) shows inline on the name field, never as a toast that could be missed

**Given** an existing vendor row
**When** the inventory manager taps *Deactivate* or *Reactivate*
**Then** `PATCH /api/vendors/:uuid` is called with `{ isActive }`, and every other field on the row - including every trip, lot and unit Epic 3 later attributes to it - is unaffected; deactivation here only removes the vendor from Epic 3's future trip-entry vendor picker, a validation Story 3.1's backend enforces, not this screen

**Given** `GET /api/vendors/:uuid/history` (Story 3.6) does not exist as a frontend consumer until Epic 3's own vendor-detail story ships
**When** this story is implemented
**Then** vendor rows on this screen render inline edit/deactivate controls only - no row navigates anywhere yet; Epic 3's Story 3.12 is what adds the `/vendors/:uuid` detail route and makes a row tappable into it, mirroring the same Epic 2 to Epic 3 split this epic's own implementation notes already record for the vendor-history view

**And** automated tests cover: active and inactive vendors both list with correct visible distinction; pagination controls page through more than 50 vendors; the blank-name validation message renders inline; and the nav entry's permission gating matches Story 2.5's

