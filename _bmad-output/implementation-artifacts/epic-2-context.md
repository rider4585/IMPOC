# Epic 2 Context: Reference Data & Vendor Registry

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Staff can maintain the product-type/colour/size/damage-grade picklists and the vendor registry that every later purchase and intake record depends on. These are master-data tables (mutable, soft-delete via `is_active` flag) that form the controlled vocabulary for stock intake and operations. Deactivating an entry flips `is_active` to `false` and touches nothing else, so records already pointing at the entry are unaffected; intake-side rejection of inactive entries happens in later epics.

## Stories

- Story 2.1: Product type picklist with self-referencing hierarchy
- Story 2.2: Colour and size picklists
- Story 2.3: Damage grade picklist
- Story 2.4: Vendor registry

## Requirements & Constraints

**Functional:**
- FR3 (CAP-3): Reference picklists (product type, colour, size, damage grade) — mutable master data, not ledger entries
- FR4 (CAP-4): Vendor registry — vendor CRUD only (history view ships in Epic 3 when intake tables exist)
- Product types form a self-referencing hierarchy (parent-child relationships); top-level types must have unique names, subtypes unique within their parent
- Colour and size picklists are flat, non-hierarchical
- Damage grades map a grade name to a default charge (in paise) and a recovery outcome (`RETURN_TO_STOCK`, `SEND_TO_MAINTENANCE`, or `RETIRE`)
- Vendors have no uniqueness constraint on name or phone (two vendors can share a trading name or shop phone)

**Non-functional:**
- All new tables are mutable master data (AD-5 tier 3): ordinary UPDATE, soft delete via `deleted_at`, and `is_active` flag for deactivation
- Every table carries `deleted_at TIMESTAMPTZ NULL`, `created_at`, and `updated_at`
- All money is stored as `BIGINT` paise with a `_paise` suffix (e.g., `default_charge_paise` on damage grades)
- Money columns carry a named `CHECK (<col> >= 0)` constraint
- API exposes `uuid` only; integer `id` never leaves the process (AD-1)

## Technical Decisions

**Partial Unique Indexes:**
- Product types: two partial unique indexes — one on `name WHERE parent_id IS NULL AND deleted_at IS NULL` (top-level names unique) and one on `(parent_id, name) WHERE parent_id IS NOT NULL AND deleted_at IS NULL` (subtype names unique within parent)
- Colour and size: partial unique indexes on `name WHERE deleted_at IS NULL` only
- Damage grades: partial unique index on `name WHERE deleted_at IS NULL` only
- Vendors: no uniqueness constraint on any column (allowing duplicate names/phones)

**Constrained Values:**
- Damage grade `outcome` is `VARCHAR(30)` with a named `CHECK` constraint restricting it to the three allowed values (`RETURN_TO_STOCK`, `SEND_TO_MAINTENANCE`, `RETIRE`). The same three values are mirrored as a frozen object in a `damage-grade-outcome.js` constants module; the service validates against the constant before INSERT (AD-3)

**Row Mutability:**
- Product types, colours, sizes, damage grades, and vendors are all mutable master data (AD-5 tier 3)
- Deactivation is an UPDATE to `is_active = false`, not a soft delete
- Nothing in this epic issues a soft delete; `deleted_at` exists for uniformity with the schema's other tables
- The Sequelize model is registered `paranoid: true` with `deletedAt: 'deleted_at'` per AD-4, though nothing in this story uses it

**Hierarchy Validation:**
- Product type service walks the ancestry chain at creation or update to detect and reject cycles (a type may not be its own ancestor or a descendant of one of its children)
- Missing parent UUIDs throw a 404-mapped error naming the missing parent

**Authorization:**
- GET routes require `authenticate` only
- POST/PATCH routes require `authorize(PERMISSIONS.INVENTORY.CREATE)` (create) or `authorize(PERMISSIONS.INVENTORY.UPDATE)` (update/deactivate)
- No new permission constants are introduced; existing generic inventory permissions suffice

## Cross-Story Dependencies

- Story 2.1 (product types) must complete before Stories 2.2 and 2.3, since the latter depend on the created tables
- All four stories in this epic must complete before Epic 3 begins, since intake (stock intakes, stock intake lines, units) references these picklists
- Vendor history view (reading `stock_intakes`, `stock_intake_lines`, `units`) is deferred to Epic 3
