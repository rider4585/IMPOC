## Epic 5: Retail Cart, Customer Capture & Checkout (Frontend Foundation)

A cashier can continuously scan items into a cart, attach a customer, and complete a sale — cash or UPI, per-piece or one negotiated total. This is the first frontend-facing epic in the plan and, being the heaviest, its five stories were written in two batches: Story 5.1 and Story 5.2 shipped the cart addition to the shared frontend foundation module and scan-to-cart (CAP-12); Story 5.3 through Story 5.5 close out the epic with customer capture and lookup (CAP-13) and retail checkout (CAP-14). Story 5.1 comes first and ships no screen. Four of the five client-side obligations the architecture spine fixes but leaves homeless were given a permanent home earlier than this epic — Epic 1's Story 1.10 established `frontend/src/platform/` with `requestKey.js` (the client-generated `requestUuid` idempotency key, AD-22), `wakingRequest.js` (the cold-start wake/retry banner and backoff logic, AD-19.1), `envelope.js` (the `{ items, page, pageSize, total }` collection-envelope client contract, AD-26), and `money.js` (the shared paise→₹ money formatter, AD-2), precisely so every module Epic 2 onward ships is testable as it lands rather than waiting on this epic. Story 5.1's job is narrower than it once was: it adds the fifth and last obligation, the cart — held client-side only with every rule re-enforced server-side (AD-25) — as `cart.js` in that same module, never a second `platform/` directory. Every later frontend epic still imports from this one module rather than reimplementing any of the five. Story 5.2 then builds the retail cart itself on top of it: the camera stays armed for the whole cart session rather than following the arm→decode→disarm→act→commit→re-arm cadence every other scan surface uses (UX-DR6, UX-DR7), a decode writes a cart line directly with no per-piece confirm, and every cart rule CAP-12 states is re-enforced server-side through the existing `GET /api/units/by-barcode/:barcode` route Story 4.1 already exposed — scan-to-cart adds no new backend route, no new permission, and no new table. Pricing is deliberately out of scope for Story 5.2: the cart carries no price field until the Price & checkout screen, which Story 5.5 builds. Story 5.3 stands up `customers` (migration 14) and the WhatsApp-number-first lookup/capture flow, completing the migration renumbering Story 4.1 already started when it pulled `unit_status_events` forward to slot 13 — `customers`, `sales` and `sale_lines` each shift one slot later than `ARCHITECTURE-SPINE.md`'s raw Structural Seed table names them. Story 5.4 stands up `sales` and `sale_lines` (migrations 15–16) and, in the same pass, adds the foreign key from `unit_status_events.sale_line_id` that Story 4.1 deliberately left unconstrained until this table existed. Story 5.5 is the checkout gesture itself: commit-time re-verification of every unit against AD-8's compare-and-swap, AD-36's proportional bargain-spreading for a whole-bill total, the floor-price refusal that names the piece rather than the total, and an idempotent commit under AD-22 whose replay returns 200, never 409.

**UPI payment (this run, 2026-08-29, resolving U-16 against `ARCHITECTURE-SPINE.md`'s AD-39 through AD-42).** Story 5.5 was rewritten end to end: retail checkout's payment half no longer takes `paymentMethod` as a plain field committed directly alongside the sale. Story 5.5 is also where the shared `modules/payments/` module is built — `payment_ref_seq` (AD-39), `buildUpiLink()` (AD-40), `paiseToUpiAmount()` (AD-41), and the one shared route both this epic and Epic 7 call, `POST /api/payments/upi-qr` (AD-42) — because CAP-14 is the earliest, in build order, of the four capabilities this route serves (CAP-14, CAP-17, CAP-18, CAP-25). The mechanism, stated once here rather than in every consuming story: the route allocates a payment reference and assembles a UPI deep link before any row exists, writing nothing to any table — no sale, no booking, not even a `request_keys` row — so it needs no AD-22 idempotency guard, the same way a read needs none. The QR renders on screen; nothing is written to the database while it is displayed. Exactly one of three things follows: the cashier taps *Mark as received* and the capability's own existing commit route runs, now also carrying the drawn `paymentReferenceCode`; the customer pays cash instead, the QR is dismissed, and the same commit runs with `paymentMethod: CASH` and no reference; or the checkout is cancelled and the cart clears — because nothing was ever written, there is no record to delete and no reference to reclaim, it simply gaps. The amount the QR encodes and the amount the commit records both come from one `amountPaise` value run through `paiseToUpiAmount` (AD-41) — never two independent conversions that could disagree. Epic 7 (`epic-07-rental-booking-handover.md`) calls this exact route for CAP-17 and CAP-18's walk-in path rather than building a second one; see that epic's own implementation notes.

### Story 5.1: Add `cart.js` to the `platform` module

As a developer,
I want the cart — the one client-side obligation left for this epic once the other four moved to Epic 1 — added to the same `frontend/src/platform/` module Story 1.10 already established,
So that this epic's scan-to-cart work has a shared cart implementation to build on, without standing up a second `platform/` directory or reimplementing the idempotency key, cold-start retry, envelope, or money-formatting logic Story 1.10 already shipped.

**Rewritten from this story's original scope.** This story originally built the entire `platform/` module — `cart.js`, `requestKey.js`, `wakingRequest.js`, `envelope.js`, `money.js` — as the epic that opened frontend work. A later re-sequencing moved the other four obligations into Epic 1 (`epic-01-foundation-barcode.md`, Story 1.10), specifically so every module Epic 2 onward ships is testable as it lands rather than waiting until this epic. This story now does only what remains: `cart.js`.

**Acceptance Criteria:**

**Given** `frontend/src/platform/` already exists, containing `requestKey.js`, `wakingRequest.js`, `envelope.js`, `money.js`, and `apiClient.js` (Epic 1, Story 1.10)
**When** this story is implemented
**Then** it adds exactly one new file to that same directory — `cart.js` — and creates no second `platform/` directory anywhere in the frontend codebase
**And** every later frontend story that touches a cart, a mutating gesture, a list endpoint, a slow request, or a rupee figure continues to import from this one module, exactly as Story 1.10 already established for the other four files — this is stated here so it can be checked at review time on every later epic

**Given** `platform/cart.js`'s exported `useCart()` hook
**When** a unit is added via `cart.addUnit(unit)`
**Then** the cart holds the unit keyed on `unit.uuid` in in-memory state only — no `localStorage`, no `sessionStorage`, no server call is made by `addUnit` itself, matching AD-25's "adding a unit to a cart changes nothing in the database"
**And** calling `cart.addUnit(unit)` again with a `unit.uuid` already in the cart does not add a second entry — the existing entry is returned/flagged and the cart's size is unchanged (CAP-12's duplicate-scan collapse, keyed on `unit.uuid` exactly as AD-25 specifies)

**Given** `cart.removeUnit(unitUuid)`
**When** it is called for a `unitUuid` present in the cart
**Then** that entry is removed and no other entry is affected
**And** `cart.clear()` empties the cart entirely, for use once a sale commits or a session is abandoned

**And** an automated test file for `cart.js` covers the behaviours enumerated above — the equivalent test coverage for `requestKey.js`, `wakingRequest.js`, `envelope.js`, and `money.js` already exists from Epic 1's Story 1.10 and is not duplicated here

### Story 5.2: Scan-to-cart — continuous scan, inline refusals, duplicate collapse

As a cashier,
I want to scan a stack of items straight into a running cart without stopping to confirm each one,
So that I can ring up a queue of five or fifteen pieces at counter speed instead of one confirm-tap at a time (FR12/CAP-12, UX-DR7, AD-25).

**Acceptance Criteria:**

**Given** the retail cart screen in its empty state
**When** the cashier taps *Scan barcode*
**Then** the camera arms and, unlike every other scan surface in the product, it does **not** turn off after a successful decode — it keeps running for the next item, matching "the retail cart is the one deliberate exception" (`EXPERIENCE.md` → The Scan Primitive → The retail cart exception)

**Given** the camera is armed on the retail cart screen
**When** the cashier taps *Review cart* or *Price & checkout*, navigates away, or the tab is hidden
**Then** the camera turns off — these are the only three conditions that disarm it during a cart session; this story implements no *Price & checkout* screen itself, only the tap that disarms the camera and hands off to it

**Given** the camera is armed and a barcode decodes to a value bound to a unit whose current `status` is `IN_STOCK` and whose `channel` is `RETAIL`
**When** the decode fires
**Then** the client calls `GET /api/units/by-barcode/:barcode` (Story 4.1) through `platform/wakingRequest.js`, and on a successful response adds the unit to the cart via `platform/cart.js`'s `addUnit(unit)` — no `platform/requestKey.js` key is attached to this call, because a barcode lookup is a read, not one of AD-22's enumerated mutating gestures
**And** the cart line renders immediately with no intermediate scan-result card and no confirm tap — the decode itself is the write to cart state, client-side only (AD-25)
**And** the camera remains armed and ready for the next decode with no pause
**And** this call and this screen require only `authenticate` — no new permission constant is introduced by this story, matching `GET /api/units/by-barcode/:barcode`'s existing requirement (Story 4.1)

**Given** a decoded barcode resolves to a unit whose `channel` is `RENTAL`
**When** the lookup response returns
**Then** the unit is **not** added to the cart; an inline toast reads *"This is a rental piece. It can't go in a retail sale."*, a double haptic pulse fires where the device supports it, and the camera stays armed for the next scan — the loop is never broken by a refusal (CAP-12, `EXPERIENCE.md` State Patterns → Wrong channel)

**Given** a decoded barcode resolves to a unit whose `status` is anything other than `IN_STOCK` (e.g. `SOLD`, `DAMAGED`, `LOST`, `IN_MAINTENANCE`, `RETIRED`, `RENTED`)
**When** the lookup response returns
**Then** the unit is **not** added to the cart; an inline toast names the unit's **actual** current status, a double haptic pulse fires, and the camera stays armed (CAP-12, `EXPERIENCE.md` State Patterns → Not in stock)
**And** the refusal toast renders on a FLAT surface regardless of what surface it interrupts, per `DESIGN.md`'s binding rule that every refusal and warning state is FLAT

**Given** a decoded barcode does not resolve to any unit
**When** `GET /api/units/by-barcode/:barcode` returns its 404 naming the barcode (Story 4.1)
**Then** an inline toast names the scanned barcode as not recognised, the camera stays armed, and nothing is added to the cart

**Given** a unit already present in the cart, keyed on its `uuid`
**When** the same unit's barcode is scanned again
**Then** `platform/cart.js`'s `addUnit()` collapses to the existing line — the existing cart line highlights briefly, the cart's line count and running total do not change, and no toast or error tone is shown (CAP-12, AD-25, `EXPERIENCE.md` State Patterns → Duplicate scan)

**Given** one or more units in the cart
**When** the retail cart screen renders
**Then** each line shows the unit's barcode, product identity, and colour/size, carries no price field, and the screen's running total is the sum of every line's `selling_price_paise` formatted through `platform/money.js`'s `formatPaise()` — labelled as a preview, never as the transacted total, since price is decided entirely at Price & checkout in this epic's next batch
**And** the cart's container and each line render on a FLAT surface per `DESIGN.md`'s binding rule ("Retail cart — Named explicitly. A running total is being built, scan by scan, at the counter.")

**Given** a line in the cart
**When** the cashier swipes it left, or activates an equivalent explicit remove control
**Then** that line is removed via `platform/cart.js`'s `removeUnit(unitUuid)` and the running total updates accordingly

**Given** a unit added to, or removed from, the cart during a session
**When** the corresponding unit row is inspected on the backend
**Then** its `status` and `channel` are unchanged by either action — no request this story issues calls `transitionUnit()` or any other unit-mutating route, and no `carts` table exists anywhere to record the cart's contents (AD-25)

**Given** the retail cart's running-total region
**When** a scan is accepted and a new line is added
**Then** an `aria-live="polite"` region announces the newest line, mirroring the intake counter's announcement pattern since there is no per-piece confirm step to announce instead (`EXPERIENCE.md` → Accessibility Floor)
**And** a scan refusal — wrong-channel, not-in-stock, or unrecognised barcode — announces via an assertive live region instead, since "a refusal missed at the counter becomes a wrong unit sold"

**Given** the camera is armed and no barcode has decoded for 10 seconds
**When** that threshold passes
**Then** an inline hint appears (*"Hold the label flat, about 15cm from the camera"*) followed by a *Type the number instead* affordance, and manual entry submits the typed digits through the same `GET /api/units/by-barcode/:barcode` call and the same accept/refuse handling as a camera decode — the server cannot distinguish the two paths, and neither is privileged (`EXPERIENCE.md` → Decode failure)

**Given** the backend is cold when a decode fires its lookup call
**When** that call is still unanswered at 1200ms
**Then** the non-blocking waking banner from `platform/wakingRequest.js` appears without pausing the armed camera — the cashier can keep scanning into the cart while one item's lookup is still waking the API, per "only the commit waits"

**Given** this story's scope
**When** it is reviewed against Epic 5's remaining stories
**Then** it implements no price field, no floor check, no customer attachment, and no checkout/commit route — pricing (CAP-14), customer capture (CAP-13), and checkout are entirely out of scope here and land in this epic's next batch of stories

### Story 5.3: Customer capture and lookup — WhatsApp-number-first

As a cashier,
I want to find a returning customer by their WhatsApp number or capture a new one with consent recorded,
So that every sale can be attached to a customer before checkout proceeds (FR13/CAP-13, AD-18).

**Acceptance Criteria:**

**Given** migration `13-create-unit-status-events` has already run (Story 4.1's resolution of Epic 4's dependency on Epic 3)
**When** migration `14-create-customers` runs
**Then** it creates `customers` with `id`/`uuid` (AD-1), `whatsapp_number VARCHAR NULL` under a partial unique index `UNIQUE (whatsapp_number) WHERE whatsapp_number IS NOT NULL AND deleted_at IS NULL` (AD-18), `name VARCHAR NOT NULL`, `email VARCHAR NULL`, `date_of_birth DATE NULL`, `consent_given_at TIMESTAMPTZ NULL`, `consent_purpose VARCHAR NULL`, `erased_at TIMESTAMPTZ NULL`, `erased_by_user_id INTEGER NULL REFERENCES users(id)`, `deleted_at TIMESTAMPTZ NULL` (AD-4), and `created_at`/`updated_at`
**And** this migration takes slot 14, not the slot 13 the raw `ARCHITECTURE-SPINE.md` Structural Seed table names for `create-customers` — Story 4.1 already claimed migration 13 for `unit_status_events`, shifting `create-customers` and every migration after it one slot later than the spine's original listing; `create-sales` and `create-sale-lines` (Story 5.4) take slots 15 and 16 for the same reason
**And** `erased_at` and `erased_by_user_id` are created now but written by no story in this epic — they exist so Epic 10's erasure work alters no table, only `customers.service.js`'s own behaviour

**Given** a customer exists with `whatsapp_number` `919876543210` and is not erased
**When** `GET /api/customers/by-whatsapp/919876543210` is called
**Then** it returns that customer's `uuid`, `whatsappNumber`, `name`, `email`, `dateOfBirth`, `consentGivenAt`, and `consentPurpose` — never the internal `id` (AD-1)
**And** an erased customer is never returned by this route — their `whatsapp_number` is already `NULL` by the time erasure has run, so no lookup can reach them by number at all

**Given** no non-erased customer carries a given WhatsApp number
**When** `GET /api/customers/by-whatsapp/:whatsappNumber` is called with that number
**Then** it returns 404 naming the number as not on file — the "miss opens capture" behaviour `EXPERIENCE.md`'s Customer sheet component pattern describes, so the cashier moves straight to the consent-and-capture form

**Given** a WhatsApp number not currently bound to any non-erased customer
**When** `POST /api/customers` is called with `{ whatsappNumber, name, consentPurpose }`
**Then** the service creates the customer row with `consent_given_at` stamped by the database's own `now()` — never a client-supplied timestamp, matching NFR9's shop-time discipline — and `consent_purpose` set from the request body
**And** `email` and `dateOfBirth` are accepted as optional fields on the same request, stored when supplied and left `NULL` otherwise, matching `domain-model.md`'s "DOB has no consumer in this scope"

**Given** `whatsappNumber`, `name`, or `consentPurpose` is missing, empty, or whitespace-only on a capture request
**When** `POST /api/customers` is validated by a new `customers.validation.js` Zod schema parsed in the controller, per the Consistency Conventions table
**Then** the request is rejected before any row is written — "Null is not a valid state for a customer attached to a transaction" (AD-18) is enforced at the API boundary, not only left to the nullable columns

**Given** a WhatsApp number already bound to an existing non-erased customer
**When** `POST /api/customers` is called with that same number
**Then** AD-11 translates the partial unique index violation into a 409 naming the existing customer, rather than a generic 500 — the cashier is being told to look the customer up instead of capturing a duplicate

**Given** a customer previously erased (Epic 10's concern, not built by this story) whose `whatsapp_number` is `NULL`
**When** a new customer is captured with the number that customer used to hold
**Then** the partial unique index does not collide — Postgres does not match `NULL`s — and the new customer is created normally, matching AD-18's "the number becomes reusable"

**Given** the `CUSTOMERS.VIEW` and `CUSTOMERS.CREATE` permissions do not yet exist
**When** a scoped seeder migration runs
**Then** it adds `customers.view` and `customers.create` to `backend/src/constants/permissions.js` under a new `CUSTOMERS` group and grants both to `CASHIER` and `MANAGER` — mirroring the existing seeder's pattern of writing `MANAGER`'s money-in permissions out explicitly alongside `CASHIER`'s rather than relying on an inherited role hierarchy — and to no other role; `ADMIN` receives both automatically through its existing `Object.keys(permissionMap)` assignment
**And** `CUSTOMERS.ERASE` is not added by this migration — it is `ADMIN`-alone (AD-29) and is seeded by Epic 10 when erasure is built, scoped exactly as Story 4.4 scoped `INVENTORY.RECOVER_LOST` to itself alone

**And** `GET /api/customers/by-whatsapp/:whatsappNumber` requires `authenticate` and `authorize(PERMISSIONS.CUSTOMERS.VIEW)`; `POST /api/customers` requires `authenticate` and `authorize(PERMISSIONS.CUSTOMERS.CREATE)`

### Story 5.4: Create `sales` and `sale_lines`, and complete `unit_status_events`' deferred `sale_line_id` foreign key

As a developer,
I want the `sales` and `sale_lines` tables in place — carrying every column both this epic's checkout and Epic 6's exchange will need — and the foreign key Story 4.1 deliberately left off `unit_status_events.sale_line_id`,
So that checkout (Story 5.5) has a table to write to and Epic 4's deferred constraint is closed the moment its target exists, rather than left open indefinitely (AD-9, AD-20, AD-24).

**Acceptance Criteria:**

**Given** migration `14-create-customers` has already run (Story 5.3)
**When** migration `15-create-sales` runs
**Then** it creates `sales` with `id`/`uuid` (AD-1), `customer_id INTEGER NOT NULL REFERENCES customers(id)` — checkout's "blocked until a customer is attached" enforced as a database fact, not only a client-side gate — `customer_name_snapshot VARCHAR NOT NULL`, `customer_whatsapp_snapshot VARCHAR NOT NULL` (both `NOT NULL` because Story 5.3 requires `name` and `whatsappNumber` on every captured customer, so a customer this story can ever attach to a sale always has both), `payment_method VARCHAR NOT NULL` under a named `CHECK` restricting it to the `UPI`/`CASH` set (AD-3), `sold_by_user_id INTEGER NOT NULL REFERENCES users(id)`, `sold_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `reverses_sale_id INTEGER NULL REFERENCES sales(id)`, `exchange_of_sale_id INTEGER NULL REFERENCES sales(id)`, `exchange_difference_paise BIGINT NULL` — no `CHECK (>= 0)` on this column, since AD-2 names it explicitly in its closed exempt set — `deleted_at TIMESTAMPTZ NULL` (AD-4, though AD-5's append-only tier means it is never written on this table), and `created_at`/`updated_at`
**And** a named unique index `sales_one_reversal` on `sales(reverses_sale_id) WHERE reverses_sale_id IS NOT NULL AND deleted_at IS NULL` exists (AD-9) — added now even though no story in this epic ever writes `reverses_sale_id` or `exchange_of_sale_id`, because this spine creates a table's full column set once, at its one creation migration, exactly as Story 4.1 did for `unit_status_events.sale_line_id`/`agreement_id` ahead of the epics that use them

**Given** migration `15-create-sales` has already run
**When** migration `16-create-sale-lines` runs
**Then** it creates `sale_lines` with `id`/`uuid` (AD-1), `sale_id INTEGER NOT NULL REFERENCES sales(id)`, `unit_id INTEGER NOT NULL REFERENCES units(id)` — with **no unique constraint** on `unit_id`, since `domain-model.md`'s standing-sale-line rule is enforced by AD-8's compare-and-swap on `units.status`, not by an index here, and a unique index would refuse the resale-after-exchange case CAP-23 exists for — `transacted_price_paise BIGINT NOT NULL` and `buying_price_paise BIGINT NOT NULL`, **neither carrying a `CHECK (>= 0)`** — AD-2 names `sale_lines.*_paise` as one of its two closed exemptions, because a reversing line (Epic 6) negates both — `reverses_sale_line_id INTEGER NULL REFERENCES sale_lines(id)`, `deleted_at TIMESTAMPTZ NULL`, and `created_at`/`updated_at`
**And** a named unique index `sale_lines_one_reversal` on `sale_lines(reverses_sale_line_id) WHERE reverses_sale_line_id IS NOT NULL AND deleted_at IS NULL` exists (AD-9)
**And** this same migration also runs `ALTER TABLE unit_status_events ADD CONSTRAINT unit_status_events_sale_line_id_fkey FOREIGN KEY (sale_line_id) REFERENCES sale_lines(id)` — the constraint Story 4.1 left off because `sale_lines` did not exist yet, added now at the first point in the migration sequence where it does

**Given** `unit_status_events` already carries rows written by Story 3.3's intake inserts and any of Epic 4's transitions, all with `sale_line_id IS NULL`
**When** the FK constraint above is added
**Then** it validates cleanly against the existing table with no data migration and no row rewritten — a `NULL` foreign key value satisfies any FK constraint — and Story 4.1's own named `CHECK (sale_line_id IS NULL OR agreement_id IS NULL)` is untouched by this migration

**Given** `domain-model.md`'s four allowed and five blocked standing-sale-line cases
**When** this story's tables are reviewed against them
**Then** nothing in this migration adds a constraint beyond AD-9's two reversal indexes above — "at most one standing sale line per unit" is not itself a schema constraint on `sale_lines`, and is instead the property Story 5.5's checkout preserves by calling `transitionUnit()`'s compare-and-swap exactly once per unit per gesture, exactly as AD-8 states

**Given** no shared payment-method constant exists yet
**When** a new `payment-method.js` constants module is added under `backend/src/constants/`
**Then** it enumerates `UPI` and `CASH` as the complete set — the same module `sales.payment_method`'s `CHECK` constraint mirrors, and the one Epic 7/8 reuse verbatim for `rental_bookings.payment_method` and `rental_agreements.settlement_method` rather than each defining its own near-identical set (AD-3)

**Given** this story's scope
**When** it is reviewed against Story 5.5
**Then** it ships two migrations and one constants module only — no `sales.service.js`, no `sales.controller.js`, no route, and no test beyond the constraint/index assertions above; the checkout gesture itself is Story 5.5's concern

### Story 5.5: Retail checkout — commit-time re-verification, bargain spreading, the UPI QR flow, and idempotent commit

As a cashier,
I want to price a cart — per piece or as one negotiated total for the whole bill — draw a UPI QR for that priced amount with nothing written until I confirm payment, or take cash instead, and commit the sale in one tap either way, with the register catching a piece someone else just sold,
So that a customer at the counter leaves with a sale that survives a race with another till, a UPI payment that's never recorded as received until I've actually seen it land, and a reference the receipt can be built from later (FR14/CAP-14, AD-8, AD-10, AD-22, AD-24, AD-36, AD-39–AD-42).

**Acceptance Criteria:**

**Given** migration `19-create-rental-agreements` is the highest slot any other epic's own story has claimed as of this rewrite (Epic 7, Story 7.4)
**When** migration `26-add-payment-ref-seq-and-sales-reference-code` runs
**Then** it creates `payment_ref_seq` as a plain, non-transactional Postgres `SEQUENCE`, never reset, no register of issued values kept anywhere — the same shape and reasoning as `barcode_seq` (AD-39) — and adds `sales.payment_reference_code VARCHAR NULL` (AD-39), set only when `payment_method = UPI` and never a foreign key to the sequence itself
**And** this migration takes the next open slot rather than being inserted back at slot 15 next to `create-sales` — this column and this sequence did not exist when `ARCHITECTURE-SPINE.md` first specified AD-39 through AD-42, exactly the reasoning Story 5.4 and Story 7.4 already used to add a deferred foreign key at the first point in the sequence where its target existed, applied here to a deferred column instead of a deferred constraint

**Given** no `modules/payments/` module exists yet anywhere in this codebase, and CAP-14 is the earliest of the four UPI-collecting capabilities in build order
**When** this story is implemented
**Then** it creates `backend/src/modules/payments/` — `payments.routes.js`, `payments.controller.js`, `payments.service.js` (exporting `buildUpiLink({ amountPaise, referenceCode })` per AD-40 and `paiseToUpiAmount(paise)` per AD-41), and `payments.validation.js` — and a single route, `POST /api/payments/upi-qr`, mounted at `/api/payments`, matching the module-layout convention every other module in this build follows
**And** `POST /api/payments/upi-qr` writes nothing to any table — its only server-side effect is `SELECT nextval('payment_ref_seq')` — and is therefore exempt from AD-22's idempotency-key requirement exactly like a read, matching AD-42's stated reasoning; this story adds no `gesture_type` for it
**And** Epic 7's Story 7.2 and Story 7.5 (`epic-07-rental-booking-handover.md`) call this exact route unchanged for CAP-17 and CAP-18's walk-in path rather than building a rentals-specific equivalent — this epic's implementation notes state the shared mechanism once; neither story restates it

**Given** a cart ready to check out
**When** `POST /api/sales/checkout` is called with no `customerUuid`
**Then** it is rejected at validation before any transaction opens — "Checkout blocked... routing to the customer sheet" (`EXPERIENCE.md` State Patterns → No customer attached) is enforced server-side, not only by the client withholding the button

**Given** the cashier's per-bill choice between *Per piece* and *One total for the bill*
**When** `POST /api/sales/checkout` is called with `{ requestUuid, customerUuid, paymentMethod, paymentReferenceCode, pricingMode, lines, negotiatedTotalPaise }`
**Then** `pricingMode: 'PER_PIECE'` requires every entry in `lines` to carry its own `unitUuid` and `pricePaise`, and any `negotiatedTotalPaise` present is ignored
**And** `paymentReferenceCode` is present only when `paymentMethod` is `UPI` and a QR was drawn and confirmed for this attempt (see the UPI QR flow below), and is absent whenever the cashier pays cash or never chose UPI at all
**And** `pricingMode: 'WHOLE_BILL'` requires every entry in `lines` to carry only `unitUuid`, requires `negotiatedTotalPaise`, and any `pricePaise` on a line is ignored — bargaining happens only on this screen, never at scan time, matching Story 5.2's explicit exclusion of a price field from the cart

**Given** `pricingMode: 'WHOLE_BILL'`
**When** the service computes each line's price
**Then** it re-reads every unit's current `selling_price_paise` inside the transaction and spreads `negotiatedTotalPaise` across them itself — it never trusts a client-computed per-line breakdown, even though the client renders its own preview of the same computation before the cashier commits (`EXPERIENCE.md` → Price & checkout screen)
**And** the spread is proportional to each line's `selling_price_paise`: line *i*'s raw share is `negotiatedTotalPaise × selling_price_paise_i / Σselling_price_paise`, computed in integer arithmetic and floored (AD-36)
**And** the leftover paise — `negotiatedTotalPaise − Σ⌊share_i⌋`, always fewer paise than there are lines — is awarded one paisa at a time to the lines with the largest fractional remainder; ties are broken by each line's position in the request's `lines` array, so the same cart submitted in the same order always spreads the same way

**Given** three lines with `selling_price_paise` 50000, 30000, and 20000 (sum 100000) and `negotiatedTotalPaise` 77777
**When** the spread runs
**Then** the raw shares are 38888.5, 23333.1, and 15555.4; the floors are 38888, 23333, and 15555 (summing to 77776); the one leftover paisa goes to the first line, whose fractional remainder (.5) is the largest; and the committed `transacted_price_paise` values are 38889, 23333, and 15555 — summing to exactly 77777 regardless of which order the three units were scanned in

**Given** every line's price has been determined — typed directly in *Per piece* mode, or computed by the spread above in *Whole bill* mode
**When** any line's resulting price is below that unit's `floor_price_paise`
**Then** the **whole bill** is refused with a 409 naming the specific unit and its floor price — never the bill total — and no partial commit occurs; in *Whole bill* mode the shortfall on one line is never covered by reallocating headroom from another line, matching AD-36's explicit rejection of that shortcut
**And** this check runs once, inside the transaction, before any unit's status is touched — never per keystroke and never at scan time

**Given** `unit-status-cause.js`'s causes as Story 4.1 left them (`INTAKE`, `STAFF_MARKED_DAMAGED`, `STAFF_MARKED_LOST`, `MAINTENANCE_COMPLETE`, `BEYOND_REPAIR`, `RECOVERY`)
**When** this story is implemented
**Then** it adds `SALE` to that same module, per Story 4.1's own note that later epics add their own causes here rather than inventing a second one, and every `transitionUnit()` call this story makes uses `cause: 'SALE'`

**Given** the floor check has passed
**When** the service processes each cart line inside the transaction
**Then** it inserts that line's `sale_lines` row first — carrying `transacted_price_paise` and `buying_price_paise` — and only then calls `transitionUnit({ unitUuid, to: 'SOLD', cause: 'SALE', reason: null, actorUserId, saleLineId }, { transaction })` with the just-inserted line's id, so the resulting `unit_status_events` row's `sale_line_id` is populated at insert time — this line-then-transition order is the opposite of AD-10's illustrative sequence diagram, which simplifies the per-line steps; the reorder is necessary because `unit_status_events` is append-only (AD-5) and can never be UPDATEd afterward to backfill a reference it was written without
**And** a CAS that returns zero rows — because another counter's checkout already moved that unit off `IN_STOCK`, or because a unit's channel was actually `RENTAL` and this is checkout's second, authoritative check — rolls back the entire transaction, including the just-inserted `sale_lines` row, and returns a 409 naming that unit and its actual current status; no sale row, no sale line, and no other unit's status change survives the rollback (AD-8, AD-10)

**Given** a line commits successfully
**When** its `sale_lines` row is inserted
**Then** `buying_price_paise` is copied from the unit's own snapshot at that moment (AD-24 tier two) — never re-read later from `stock_intake_lines`
**And** the `sales` row carries `customer_name_snapshot` and `customer_whatsapp_snapshot` copied from the attached customer at commit time, not from any value the client sent — an edit to the customer's own record after this moment never rewrites this sale (AD-18, AD-24)

**Given** `paymentMethod` is `UPI` or `CASH`
**When** checkout commits
**Then** `payment_method` is stored on `sales.payment_method`, and `sales.payment_reference_code` is set from the request's `paymentReferenceCode` when present and left `NULL` otherwise — and nothing else happens with either value: no gateway call, no reconciliation check, no external request of any kind inside or outside the transaction

**Given** the cashier has priced the bill — per piece or as one negotiated total — and the client's own preview of that same computation (already described above, and rendered on the Price & checkout screen per `EXPERIENCE.md`) has produced a total
**When** the cashier picks **UPI** as the payment method
**Then** the client calls the shared `POST /api/payments/upi-qr` (AD-42, built by this story — see above) with `{ requestUuid, amountPaise }` — the same `requestUuid` this checkout attempt's commit call below reuses — and `amountPaise` equal to that previewed total
**And** the response's `upiLink` renders as a QR on the checkout screen; nothing is written to any table while it is displayed — no `sales` row, no `sale_lines` row, no `request_keys` row — matching CAP-14's own "writes nothing to the database while it is displayed"

**Given** the QR is on screen and a `paymentReferenceCode` has been allocated for this checkout attempt
**When** the cashier sees the customer's phone show payment success and taps **Mark as received**
**Then** `POST /api/sales/checkout` is called with the same `requestUuid` plus `{ customerUuid, paymentMethod: 'UPI', pricingMode, lines, negotiatedTotalPaise, paymentReferenceCode }`, and the service re-runs the floor-check/spread computation itself from `pricingMode`/`lines`/`negotiatedTotalPaise` — exactly as every acceptance criterion above already describes — rather than trusting the previewed `amountPaise` the QR was drawn from (AD-41's "neither call ever accepts a client-supplied total in place of running that computation itself")
**And** because nothing about a priced bill changes between the QR rendering and this tap — the cashier may only switch to cash or cancel from here, never reprice with the QR already up — the server-computed total this commit produces is guaranteed to equal the previewed total the QR encoded, by construction, not by re-validation against it (AD-41)

**Given** the QR is on screen
**When** UPI is unavailable on either side and the cashier switches the payment method to cash instead
**Then** the QR is dismissed client-side and `POST /api/sales/checkout` is called with the same `requestUuid` and `paymentMethod: 'CASH'`, carrying no `paymentReferenceCode` at all — the reference allocated for the abandoned QR is simply never sent, never stored, and never reused; `payment_ref_seq` gaps by one, which is expected and harmless (AD-39)

**Given** the QR is on screen, or no QR was ever drawn because the cashier chose cash from the start
**When** the customer decides not to buy and the cashier cancels the checkout
**Then** the cart clears client-side and no request is sent to `POST /api/sales/checkout` at all — because nothing was ever written in any of these three branches until the moment of commit, there is no `sales` row, no `sale_lines` row, and no `request_keys` row to delete or roll back; a UPI reference drawn for the cancelled attempt simply gaps, exactly as the cash-switch branch above

**Given** a `requestUuid` minted once when the cashier taps *Price & checkout* (`EXPERIENCE.md` Flow 4) and reused unchanged across every retry of this same checkout attempt, and across this attempt's own `POST /api/payments/upi-qr` call when UPI is chosen
**When** the service handles the commit as the `SALE_CHECKOUT` gesture (already enumerated by Story 1.4's `gesture-type.js`)
**Then** it inserts the `request_keys` row last, inside the same transaction, after the sale exists — `result_kind: 'SALE'`, `result_uuid` set to the committed sale's `uuid` (AD-22's insert-last ordering)
**And** a replay carrying a `request_uuid` already committed against `SALE_CHECKOUT` performs no second `transitionUnit()` call, writes no second `sales`/`sale_lines` row, and returns the original committed sale — including its `paymentReferenceCode` when the original commit carried one — with **200, never 409**
**And** a cart changed after a failed attempt — a line removed because the previous acceptance criterion's race refused it — is a different gesture and is submitted with a freshly minted `requestUuid`, not a replay of the failed one; the earlier `POST /api/payments/upi-qr` call needs no idempotency treatment of its own either way, per AD-42

**Given** AD-10's rule that nothing inside a transaction may do I/O that is not Postgres
**When** this story is reviewed
**Then** the checkout route renders no receipt, no PDF, and calls no external service inside the transaction — the response returns the committed sale's `uuid` and its lines, and the receipt itself is Epic 6's concern, rendered after commit from the committed rows
**And** `POST /api/payments/upi-qr` is never called from inside this transaction either — it is a separate, earlier client request that has already completed (or was never made, for a cash sale) before *Price & checkout*'s commit call is ever sent

**Given** `SALES.CREATE` already exists and is already held by `CASHIER` and `MANAGER` (the existing seeder)
**When** `POST /api/sales/checkout` is authorized
**Then** it requires `authenticate` and `authorize(PERMISSIONS.SALES.CREATE)` — no new permission constant is introduced by this story
**And** `POST /api/payments/upi-qr`, though it lives in its own `modules/payments/` module, requires `authenticate` plus any one of AD-29's four money-in verbs (`SALES.CREATE`, `RENTALS.BOOK`, `RENTALS.HANDOVER`, `RENTALS.EXTEND`) — for this story's own call site it is reached under `SALES.CREATE`, the same permission already gating `POST /api/sales/checkout` — no new permission constant is introduced

