## Epic 1: Foundation & Barcode Remediation

Staff can generate correct, uniquely-numbered A4 barcode sheets, and the database carries the extensions and tables every later epic depends on. Sequencing inside this epic follows the spine's binding migration order first (`btree_gist` → `barcode_seq` → `app_settings` → `request_keys`), then the four brownfield defects in the order they gate each other (D1's layout rework needs `app_settings`; D2's counter needs `barcode_seq`; D3's auth and D4's validation are independent of both), then the standalone frontend dependency fix.

**Flagged, not fixed, for whoever writes this epic's next stories (Raviraj, this run):** this epic is about to gain the frontend foundation, including login, in a later run. AD-37 states that `/auth/login` (and `/auth/me`) return a `preferences` field, sourced from `user_preferences`. This run's re-sequencing moved the owner dashboard — and with it, `user_preferences` and AD-37's pinned-card persistence — to **Epic 12**, the final epic in the build (see Epic 12's own implementation notes for the full account). `user_preferences` therefore does not exist when this epic's login story is written or shipped: the table, and the `preferences` field it backs, arrive only when Epic 12 ships, at the very end of the build. Whoever writes Epic 1's login story next must write it knowing that gap exists — the `preferences` field is simply **absent** from the login and `/auth/me` response envelopes for the entire span between this epic shipping and Epic 12 shipping, not defaulted to `{}` by this epic's own code, since there is no accessor for a table that doesn't exist yet to default from. Epic 12's Story 12.4 is the story that finally adds the field to both handlers, exactly as AD-37 requires, and its own acceptance criteria state that the field is unconditionally new work from that story's own commit forward. This note records the dependency; it does not resolve it, since resolving it means writing Epic 1's login story, which is out of scope for this organisational run.

**Resolved by this run's own next eight stories (Stories 1.10–1.17):** the frontend foundation flagged above is now written. Story 1.14's login story honours the AD-37 gap exactly as instructed — neither `/auth/login` nor `/auth/me`'s response carries a `preferences` key of any kind, in any form, anywhere in this epic's span. One further gap surfaced while writing these stories and is raised upstream rather than resolved here: `SPEC.md` carries no capability for sign-in or permission-scoped navigation — every other story in this document maps to a `CAP-n`, and Stories 1.14 and 1.15 do not. This is flagged for `bmad-spec` to decide whether and how to number it; inventing a `CAP` id here would pre-empt that call.

**Two decisions Raviraj made explicitly, not left to this run's default judgement, when this note was reviewed:** first, the refresh token is delivered as an httpOnly cookie (Story 1.13), not a JSON body field stored in `localStorage` — the drafted-and-superseded localStorage approach is recorded in Story 1.14's own text purely as the alternative that was rejected, so a later reader understands why the cookie path exists. Second, Epic 5's own Story 5.1 (`epic-05-cart-customer-checkout.md`), which still built the full `platform/` module including `cart.js`, has been rewritten in this same run to add only `cart.js` to the module Story 1.10 below establishes — despite this run's own instruction to touch only this epic file, Raviraj asked for that fix now rather than leaving it flagged.

### Story 1.1: Enable the btree_gist Postgres extension

As a developer,
I want the `btree_gist` extension enabled as the very first, standalone migration,
So that a hosting provider that forbids it fails immediately, before fifteen unrelated tables have been built on top of it (AD-19, AD-20).

**Acceptance Criteria:**

**Given** a database with no migrations yet applied
**When** migration `01-enable-btree-gist` runs
**Then** it executes `CREATE EXTENSION IF NOT EXISTS btree_gist` and nothing else — no table, no other statement, in that same migration file
**And** it is the first migration file in the sequence, with no earlier migration

**Given** a hosting provider that does not permit `CREATE EXTENSION`
**When** migration `01-enable-btree-gist` runs against it
**Then** the migration fails loudly with the database's own permission error, and no later migration runs

**Given** the migration has been applied locally
**When** its `down()` is run in local development
**Then** it drops the extension — `down()` is never intended to run against a hosted database (AD-20)

### Story 1.2: Create the barcode_seq sequence

As a developer,
I want a dedicated, never-reset Postgres sequence for barcode numbering,
So that barcode uniqueness can rely on a durable, non-transactional counter instead of the colliding `Date.now()`-based generator (FR-D2, AD-17).

**Acceptance Criteria:**

**Given** migration `01-enable-btree-gist` has already run
**When** migration `02-create-barcode-seq` runs
**Then** it executes `CREATE SEQUENCE barcode_seq` — a plain Postgres sequence, not a counter table or column, and not wrapped in any application-level allocation table

**Given** the sequence exists
**When** `SELECT nextval('barcode_seq')` is called repeatedly, including across rolled-back transactions
**Then** it returns strictly increasing integers, and a rollback burns the numbers it consumed rather than reissuing them — this is expected and matches CAP-2's "no register of issued values" requirement

**Given** the sequence exists
**When** `SELECT nextval('barcode_seq') FROM generate_series(1, :n)` is called once with `:n` = 20
**Then** it returns 20 distinct, consecutive values in a single round trip (this call shape is exercised functionally in Story 1.6, not tested standalone here)

**And** no application code anywhere calls `ALTER SEQUENCE ... RESTART` or otherwise resets `barcode_seq` during normal operation

### Story 1.3: Create the app_settings table and typed accessor

As a developer,
I want a typed key/value settings table with a single read accessor,
So that later stories can make runtime-tunable values — starting with barcode label geometry — retunable by an admin without a code deploy (AD-28).

**Acceptance Criteria:**

**Given** migration `02-create-barcode-seq` has already run
**When** migration `03-create-app-settings` runs
**Then** it creates `app_settings` with `key VARCHAR PRIMARY KEY`, `value_text TEXT`, `value_int BIGINT`, `value_type VARCHAR` under a CHECK constraint restricting `value_type` to a fixed set (at minimum `TEXT` and `INT`), plus `created_at`/`updated_at` timestamps per the mutable-master-data tier
**And** the migration seeds no rows — this story creates the empty table and its accessor only; the specific label-geometry keys are seeded by Story 1.5, which is the first story that needs them

**Given** the table exists
**When** a new `app-settings.service.js` accessor module's `get(key)` function is called for a key with an existing row
**Then** it returns the value parsed according to that row's `value_type` (an integer for `INT`, a string for `TEXT`) — never the raw unparsed column

**Given** the table exists
**When** `get(key)` is called for a key with no row
**Then** it throws an error rather than returning `null`, `undefined`, or a silent default

**And** `value_int` is documented (in code comment or module doc) as the column money-typed settings use, storing paise per AD-2 — no money-typed setting is seeded in this story, since none is needed until a later epic

### Story 1.4: Create the request_keys table and shared idempotency helper

As a developer,
I want one `request_keys` table and a shared idempotency helper, keyed on gesture type rather than on the row each gesture writes,
So that every future mutating gesture — including barcode generation in this same epic — can guarantee exactly-once commit under AD-19's mandatory client retry-on-cold-start behaviour (AD-22).

**Acceptance Criteria:**

**Given** migration `03-create-app-settings` has already run
**When** migration `04-create-request-keys` runs
**Then** it creates `request_keys` with columns `id SERIAL PRIMARY KEY`, `uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()`, `gesture_type VARCHAR(40) NOT NULL`, `request_uuid UUID NOT NULL`, `result_kind VARCHAR(40) NOT NULL`, `result_uuid UUID NOT NULL`, `actor_user_id INTEGER NOT NULL REFERENCES users(id)`, and `created_at`/`updated_at`/`deleted_at`
**And** a partial unique index `request_keys_gesture_request` exists on `(gesture_type, request_uuid) WHERE deleted_at IS NULL`
**And** no other table in the schema gains a `client_request_uuid` (or equivalent) column as part of this or any later story — AD-22 names this as the anti-pattern the table replaces

**Given** the table exists
**When** a new `gesture-type.js` constants module is added
**Then** it enumerates every mutating gesture named in AD-22 — `SALE_CHECKOUT`, `SALE_EXCHANGE`, `RENTAL_BOOK`, `RENTAL_HANDOVER`, `RENTAL_AMEND`, `RENTAL_CANCEL`, `RENTAL_SETTLE`, `RENTAL_WRITE_OFF`, `UNIT_RECOVER`, `UNIT_TRANSITION`, `EXPENSE_CREATE`, `EXPENSE_REVERSE`, `INTAKE_SCAN`, `BARCODE_GENERATE` — even though only `BARCODE_GENERATE` is implemented by this epic; the rest exist as named constants for later epics to consume

**Given** the table and constants exist
**When** a new `idempotency.js` helper module's lookup function is called with a `gesture_type` and `request_uuid`
**Then** it returns the matching non-deleted `request_keys` row's `result_kind`/`result_uuid` if one exists (a replay), or a clear "not found" signal if none exists (a first attempt)
**And** the helper does not itself open, commit, or roll back a transaction — inserting the `request_keys` row remains the caller's responsibility, performed last, inside the caller's own transaction, per AD-22's insert-last ordering rule

**Given** two concurrent requests carrying the same `gesture_type` and `request_uuid`
**When** both attempt to insert their own `request_keys` row inside their own transaction
**Then** an automated test proves exactly one commits and the other fails on the partial unique index and rolls back its entire transaction, including any other work it performed

### Story 1.5: Rework the barcode label layout for A4 with configurable geometry

As an inventory manager,
I want barcode sheets printed correctly on A4 paper with an accurately sized label,
So that the sheet I print physically fits my printer and the barcode scans reliably at the counter (FR-D1, FR1/CAP-1).

**Acceptance Criteria:**

**Given** `barcode.constants.js` currently sets `PDF_CONFIG.size` to `'A2'` and defines a `BARCODE_LAYOUT` block (4 columns × 6 rows, point-based paddings, `barcode.height: 7`, `text.fontSize: 8`) sized for that page
**When** this story is implemented
**Then** `PDF_CONFIG.size` is changed to `'A4'`
**And** every layout dimension previously hard-coded in `BARCODE_LAYOUT` — barcode width, barcode height, human-readable text font size, clear space, page margins, and the derived column/row grid — is removed as a literal and instead read at render time from `app_settings` via the Story 1.3 accessor

**Given** `app_settings` exists and is empty of barcode-geometry keys
**When** this story's migration/seeder runs
**Then** it seeds one `app_settings` row per geometry value, modelled on `BARCODE_TEST_CONFIG` (already A4 and millimetre-based) rather than the old `BARCODE_LAYOUT` block — per `brownfield.md`'s confirmed unit interpretation: barcode dimensions in millimetres (35mm × 8mm), text font size and clear space in PDF points (5pt and 15pt respectively)

**Given** the reworked constants file
**When** it is inspected
**Then** it retains only what AD-28 says is structurally fixed — the `'A4'` page-size literal and the two legal barcode digit-count layouts from AD-17 (12-digit default, 10-digit alternate) — and no geometry value

**Given** the reworked layout is deployed
**When** `/test-sheet` is called and the resulting PDF is measured with a caliper or ruler against a precisely-scaled print
**Then** the rendered barcode measures 35mm × 8mm (±0.5mm), as CAP-1's stated success criterion requires — this is a manual physical-print check, not something a unit test alone can certify

**Given** a value in `app_settings` (e.g. clear space) is changed directly in the database
**When** the next sheet is generated, with no code change and no redeploy
**Then** the new sheet reflects the changed value

**And** an automated test renders a sheet and asserts the resulting PDF's page size is A4 and the label count per page matches the grid derived from the currently configured dimensions

### Story 1.6: Replace the barcode value generator with a persistent counter

As an inventory manager,
I want every generated barcode value guaranteed unique across server restarts and database restores,
So that I never print two labels bearing the same number, and a printed-but-unscanned sheet stays valid after an outage (FR-D2, AD-17, FR2/CAP-2).

**Acceptance Criteria:**

**Given** `generateBarcodeValues` in `barcode.service.js` currently builds values from `Date.now()` plus a zero-padded index
**When** this story is implemented
**Then** each barcode value is instead built in a single Postgres statement as a 7-digit prefix (whole minutes elapsed since 2026-01-01 00:00 `Asia/Kolkata`, computed via `extract(epoch FROM now() AT TIME ZONE 'Asia/Kolkata')::bigint / 60`, never via Node's `Date.now()` or `new Date()`) concatenated with a 5-digit within-minute counter drawn from `nextval('barcode_seq') % 100000`
**And** one statement of the shape `SELECT ..., nextval('barcode_seq') FROM generate_series(1, :n)` allocates an entire N-page sheet's values in a single round trip
**And** the resulting value is exactly 12 digits, zero-padded, digits-only — no letter prefix — keeping the Code 128 encoder in subset C

**Given** the service is starting up
**When** it initializes
**Then** it runs a boot-time guard that refuses to issue any barcode value until the current Postgres minute exceeds `max(left(barcode, 7))` over the `units` table (or proceeds immediately if `units` has no rows), preventing reissue of an already-claimed minute after a restore

**Given** `units.barcode` already carries a unique constraint
**When** this story is implemented
**Then** that constraint remains the sole binding guard against the two named residual collisions (more than 100,000 labels issued inside one minute; a backwards server clock jump) — no new register of issued values, and no `BarcodeBatch`/`BarcodeIssue`-style table, is added anywhere

**Given** the Story 1.4 `request_keys` table and idempotency helper exist
**When** a sheet-generation request arrives with a `requestUuid`
**Then** the service treats it as the `BARCODE_GENERATE` gesture: on a first request it allocates the run, streams the PDF, then inserts the `request_keys` row last (`result_kind = 'BARCODE_SHEET'`, `result_uuid = gen_random_uuid()`, addressing nothing) inside the same transaction — never persisting the allocated range itself, since that would recreate the register CAP-2 forbids

**Given** a request replays a `requestUuid` already recorded in `request_keys`
**When** it is received
**Then** the service calls no `nextval`, generates no second PDF, and returns 200 telling the client the sheet was already generated

**Given** a request carries no `requestUuid`
**When** it is received
**Then** it is rejected at validation before any sequence value is allocated

**And** an automated test generates two sheets back-to-back and asserts no duplicate 12-digit value appears across them, and a second automated test calls the same request twice with the same `requestUuid` and asserts the sequence's current value only advanced once

### Story 1.7: Authenticate and authorize barcode routes

As an admin,
I want barcode generation restricted to authorized roles,
So that an unauthenticated or unauthorized user cannot generate or waste sheets of barcode labels (FR-D3, AD-29).

**Acceptance Criteria:**

**Given** `barcode.routes.js` currently mounts `/generate` and `/test-sheet` with no auth middleware
**When** this story is implemented
**Then** a new permission constant `INVENTORY.BARCODE_GENERATE` (`'inventory.barcode_generate'`) is added to `backend/src/constants/permissions.js`
**And** both routes are mounted behind `authenticate` and `authorize(PERMISSIONS.INVENTORY.BARCODE_GENERATE)` middleware

**Given** the new permission constant exists
**When** a scoped seeder migration runs
**Then** it grants `INVENTORY.BARCODE_GENERATE` to exactly the `ADMIN`, `MANAGER`, and `INVENTORY_MANAGER` roles, per AD-29's matrix — this migration is scoped to this one permission only, not the full `seed-new-permissions` migration that later epics contribute their own permission groups to (`RENTALS.*`, `CUSTOMERS.*`, `SETTINGS.MANAGE`, `INVENTORY.RECOVER_LOST`)

**Given** the guard is in place
**When** a `CASHIER` or `ACCOUNTANT` user (who hold neither the permission nor a role granted it) calls either route
**Then** the response is 403

**Given** the guard is in place
**When** a request carries no auth token
**Then** the response is 401

**Given** the guard is in place
**When** an `ADMIN`, `MANAGER`, or `INVENTORY_MANAGER` user calls either route
**Then** the request succeeds as before

**And** the route's authorization check tests only the `INVENTORY.BARCODE_GENERATE` permission constant — never a role name and never a string literal — per `backend/AGENTS.md`, and deliberately does not reuse the existing `INVENTORY.CREATE`-style permission, since `MANAGER` already holds broader inventory permissions that shouldn't be conflated with this specific gate

### Story 1.8: Zod validation for barcode routes

As a developer,
I want barcode request validation to follow the repo's standard error-shaping convention,
So that barcode error responses are consistent with every other module instead of hand-built JSON (FR-D4).

**Acceptance Criteria:**

**Given** `barcode.controller.js` currently returns a hand-built `{ success: false, message }` 400 response for an invalid `pages` query parameter
**When** this story is implemented
**Then** a new `barcode.validation.js` module defines a Zod schema validating the `pages` parameter (and any other barcode-route input) as a positive integer within the same bound the route already enforces

**Given** the schema exists
**When** the barcode routes/controller validate incoming requests
**Then** they use the repo's standard validation middleware pattern and call `next(error)` on a validation failure, rather than constructing a response inline
**And** `barcode.controller.js` contains no hand-built `{ success: false, message }` error object

**Given** `error.middleware.js` already shapes every other module's validation failures
**When** an invalid `pages` value (non-numeric, zero, or negative) is sent to `/generate`
**Then** an automated test asserts the response matches the same error shape every other validated module in the repo returns

**And** an automated test sends a valid `pages` value and asserts the request proceeds to generate a sheet exactly as it did before this story

### Story 1.9: Declare @zxing/library as an explicit frontend dependency

As a developer,
I want `@zxing/library` declared directly in `frontend/package.json`,
So that a future version bump of `@zxing/browser` cannot silently break the scanner by dropping the transitive dependency `BarcodeScanner.jsx` actually imports (FR-D5).

**Acceptance Criteria:**

**Given** `frontend/package.json` does not currently list `@zxing/library`, which resolves today only because `@zxing/browser` pulls it in transitively
**When** this story is implemented
**Then** `@zxing/library` is added to `frontend/package.json`'s `dependencies`, pinned to the version currently resolved in the lockfile/`node_modules` — not a newer or looser range

**Given** the dependency is declared
**When** the frontend's install command is run
**Then** the resolved `@zxing/library` version is unchanged from before this story

**Given** the dependency is declared
**When** `BarcodeScanner.jsx` is exercised
**Then** its decode behaviour is unchanged — this story is a manifest fix only, with no code changes to the scanner component

**And** the frontend build and test suite pass unchanged after the dependency is declared

### Story 1.10: Establish the `platform` module — idempotency, cold-start retry, envelope, money, and the API client

As a developer,
I want the four client-side obligations `ARCHITECTURE-SPINE.md`'s Deferred section assigns to `frontend/src/platform/` built once, plus the shared API client every route call goes through,
So that every later frontend story imports one shared implementation instead of each epic reinventing idempotency keys, retry-on-cold-start, collection parsing, or money formatting (AD-2, AD-19.1, AD-22, AD-26).

**Originally slated for Epic 5's Story 5.1, moved into this epic by this run's re-sequencing** so every module Epic 2 onward ships is testable as it lands rather than waiting until story 28. `cart.js` deliberately stays out of this story and out of this epic — nothing built before Epic 5 has a cart to manage (AD-25) — and Epic 5's own Story 5.1 must be rewritten to add only `cart.js` to this same module rather than standing up a second one (see this epic's implementation notes above).

**Acceptance Criteria:**

**Given** no `frontend/src/platform/` directory exists yet
**When** this story is implemented
**Then** it creates exactly four files — `requestKey.js`, `wakingRequest.js`, `envelope.js`, `money.js` — and deliberately no `cart.js`
**And** a fifth file, `apiClient.js`, provides the one axios instance (already a declared dependency in `frontend/package.json`) every one of the above, and every future frontend story, issues its HTTP calls through — no other module constructs its own axios instance or calls `fetch` directly

**Given** `platform/requestKey.js`
**When** its exported `createRequestKey()` is called
**Then** it returns a UUIDv4 via `crypto.randomUUID()`, matching AD-22's "client generates a UUIDv4 per counter gesture" rule, with no server round trip

**Given** `platform/wakingRequest.js`
**When** its exported request wrapper is called with a function that performs one HTTP call
**Then** a call still unanswered at 1200ms surfaces a `waking` status the caller can render as `{components.waking-banner}` (EXPERIENCE.md → Cold Start and Retry Contract), retries with exponential backoff and jitter, and at 90 seconds surfaces a `failed` status with the same key retained rather than a new attempt being minted
**And** the wrapper never itself blocks the caller's own UI thread or state updates — a component can stay responsive to anything else it manages while a wrapped call is waking, per "only the commit waits"

**Given** `platform/envelope.js`
**When** its exported parser is called against a response shaped `{ success, data: { items, page, pageSize, total } }`
**Then** it returns `{ items, page, pageSize, total }` unwrapped, and calling it against a bare array or a non-collection `data` payload throws rather than silently returning a guessed shape, per AD-26's "never a bare array"

**Given** `platform/money.js`
**When** its exported `formatPaise(paise)` is called with an integer paise value
**Then** it returns a string of the form `₹1,299.50` — division by 100, half-up rounding to exactly two decimals, Indian digit grouping — and this function is the only place division-by-100 money-formatting logic exists anywhere in the frontend codebase; no later story implements its own
**And** `formatPaise` throws on a non-integer or negative input rather than silently formatting a wrong figure

**Given** `platform/apiClient.js`
**When** it is inspected
**Then** it exports one configured axios instance whose base URL comes from a build-time env var (`VITE_API_BASE_URL`), never a hard-coded relative path — AD-19 puts the frontend static build and the backend container on different hosts in production, unlike today's scaffolding's relative `/api/...` fetches in `barcodeApi.js`
**And** the instance is created with `withCredentials: true`, so the browser attaches Story 1.13's httpOnly refresh-token cookie to any call whose path matches the cookie's own `/api/auth` scope — this story ships only the axios-level setting; the cookie itself does not exist until Story 1.13's backend work lands, so this AC is checked here via a request-config assertion in this story's own tests, not by proving an actual cookie round-trip
**And** it exposes `setAccessTokenGetter(fn)`, an injection point Story 1.14 wires up; every outgoing request attaches `Authorization: Bearer <token>` from whatever the currently-registered getter returns, and a request carries no `Authorization` header at all when no getter is registered or the getter returns nothing — this story ships the mechanism with a no-op default, not the getter itself, so this story's own tests exercise it with a stub getter rather than depending on Story 1.14 existing

**And** this story is the first in the frontend codebase to run automated tests under a real test runner: `vitest`, `@testing-library/react`, and `@testing-library/jest-dom` are added to `frontend/package.json`'s `devDependencies`, a `vitest.config.js` is added, and `"test": "vitest run"` is added to `package.json`'s `scripts` — the existing `StockIntakeForm.test.js` imports these same packages today without either being declared, so nothing currently runs it; this story is what first makes `npm test` a real, passing command, and Story 1.16 deletes that orphaned test file
**And** an automated test for each of `requestKey.js`, `wakingRequest.js`, `envelope.js`, and `money.js` covers the behaviour stated above

### Story 1.11: Establish the DESIGN.md token theme — typography, colour, and the three surface treatments

As a developer,
I want DESIGN.md's typefaces, type scale, colour tokens, and three surface treatments implemented once as the app's theme,
So that every later screen consumes the same tokens instead of a second builder re-deriving a hex value, a font size, or a shadow (DESIGN.md → Colors, Typography, Elevation & Depth).

**Acceptance Criteria:**

**Given** DESIGN.md specifies Bricolage Grotesque (display only) and Instrument Sans (everything else), both free on Google Fonts, with a `[NOTE FOR BUILD]` explicitly leaving self-hosting vs CDN "not decided here; raised for the first frontend epic"
**When** this story is implemented
**Then** both variable fonts are self-hosted via `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/instrument-sans`, imported once at the app's entry point — resolving the note's open decision in favour of removing the render-blocking third-party request DESIGN.md itself names as the reason to self-host, on a slow shop connection, at the one moment (first paint at the till) it costs the most
**And** no `<link>` to `fonts.googleapis.com` (or any third-party font host) exists anywhere in the built app

**Given** DESIGN.md's `colors` and `typography` token blocks
**When** this story is implemented
**Then** every token — both light and dark variants — is declared as a CSS custom property on `:root` (light) with a `prefers-color-scheme: dark` override block (dark) in a new `frontend/src/theme/tokens.css`, and no component file anywhere hard-codes a hex value or a font-size that DESIGN.md names as a token
**And** `{typography.money}`, `{typography.money-lg}`, `{typography.money-sm}`, `{typography.counter}`, and `{typography.barcode}` each set `font-variant-numeric: tabular-nums lining-nums` in their CSS class, matching DESIGN.md's "not a preference" rule
**And** `{typography.label}` at 13px is the smallest font-size declared anywhere in `tokens.css` or any component file — no 12px caption role exists, per DESIGN.md's "true floor" statement

**Given** the app has no in-app theme toggle (EXPERIENCE.md → Foundation: light and dark "follow the device")
**When** this story is implemented
**Then** dark mode is driven entirely by `prefers-color-scheme`, with no toggle control, no stored theme preference anywhere (including `localStorage`), and no `data-theme` attribute anywhere in the codebase

**Given** DESIGN.md's three named surface treatments and their binding table
**When** this story is implemented
**Then** three CSS classes — `.surface-flat`, `.surface-soft`, `.surface-glass` — are added to `tokens.css`, each matching its token block's background/border/shadow/radius values in both light and dark, and `.surface-glass` additionally sets its `fallback-background` under `@media (prefers-reduced-transparency: reduce)` and under `@supports not (backdrop-filter: blur(1px))`, per DESIGN.md's Performance note
**And** a short doc comment above the three classes states the binding table's assignment rule in one line each (flat = default / money-deciding / refusals; soft = cards / chrome; glass = dashboard shell / scanner overlay / modal backdrops only) so a later story's reviewer can check a screen's surface choice against it without reopening DESIGN.md

**Given** `platform/money.js`'s `formatPaise()` (Story 1.10)
**When** any future story renders a rupee figure
**Then** it does so only by calling `formatPaise()` inside an element carrying `.money`, `.money-lg`, or `.money-sm` from `tokens.css` — this story renders no money figure itself, since nothing in Epic 1 shows one, but states the binding rule here because this is the story that builds the typography classes a rupee figure must render inside, and no ad hoc `(paise / 100).toFixed(2)` is permitted anywhere the review checks against this rule

**And** an automated test renders each of the three surface classes and asserts the computed background/border/shadow match `tokens.css`'s declared values under a simulated light-mode and dark-mode media query

### Story 1.12: Expose the signed-in user's permission set on login and session restore

As a developer,
I want `/auth/login` and `/auth/me` to return the caller's resolved permission set,
So that the frontend can drive navigation and route guards from permission constants exactly as AD-29 requires — "Navigation renders only what the signed-in user holds... never a role-name test" — instead of having no source for this at all.

**Not a new capability.** This wires the existing `getUserPermissions(userUuid)` accessor (`backend/src/modules/auth/permission.service.js`, already used by the `authorize()` middleware) into two existing response envelopes. AD-29 already binds "the frontend's permission-driven navigation"; this story is that binding's first concrete consequence.

**Acceptance Criteria:**

**Given** `auth.controller.js`'s `login` handler currently returns `{ uuid, username, email, firstName, lastName, status, lastLoginAt, accessToken, refreshToken, refreshTokenExpiresAt }` with no permission information at all
**When** this story is implemented
**Then** the response's `data` gains a `permissions` field: a sorted array of permission-name strings, produced by calling the existing `getUserPermissions(user.uuid)` and spreading its returned `Set` into a sorted array — no new query, no new table, no duplicated permission-resolution logic

**Given** `getCurrentUser` (`GET /auth/me`) currently returns `{ uuid, username, email, firstName, lastName, phone, status, lastLoginAt, createdAt, updatedAt }` with the same omission
**When** this story is implemented
**Then** its response gains the identical `permissions` field, sourced the same way — both routes call the same accessor so the two arrays can never drift apart from having two separate implementations

**Given** AD-37's `preferences` field is explicitly out of scope for this entire epic (see this epic's implementation notes above)
**When** this story's two response envelopes are inspected
**Then** neither carries a `preferences` key at all — not `{}`, not `null`, not omitted by a conditional — because the accessor and table AD-37 describes do not exist yet; a key that doesn't exist is different from a key defaulted to empty, and this story ships the former

**And** an automated test logs in as a seeded `CASHIER` user and asserts the returned `permissions` array is exactly `['inventory.view', 'sales.create', 'sales.view']` — today's actual seeded grant (`20260807175248-seed-role-permissions.js`), not AD-29's eventual full matrix, which arrives only as later epics run their own `seed-new-permissions` migrations — and does not contain `inventory.barcode_generate`
**And** a second automated test logs in as a seeded `INVENTORY_MANAGER` user and asserts the array is exactly `['inventory.barcode_generate', 'inventory.create', 'inventory.delete', 'inventory.update', 'inventory.view']`, confirming Story 1.7's barcode-permission seeder is reflected
**And** a third automated test calls `GET /auth/me` with an existing `CASHIER` session and asserts an identical `permissions` array to that role's login response

### Story 1.13: Move refresh-token delivery to an httpOnly cookie, with the CORS policy that makes it deliverable

As a developer,
I want the refresh token delivered as an httpOnly, cross-site cookie instead of a JSON body field, plus the CORS policy that makes that delivery possible at all,
So that a 7-day-lived credential (`JWT_REFRESH_EXPIRES_IN=7d`) is never readable by any script running in the page — closing the exposure a `localStorage`-held refresh token would otherwise carry.

**Genuinely new backend infrastructure, not a wiring exercise like Story 1.12.** `app.js` mounts no CORS middleware today, and nothing anywhere in the codebase sets or reads a cookie. Both are added here, scoped tightly to what auth needs — this is not a general hardening pass over every route. This story exists because Raviraj chose it explicitly over the cheaper alternative (a `localStorage`-held refresh token, accepted as a documented trade-off) when this epic's stories were reviewed.

**Acceptance Criteria:**

**Given** `app.js` currently mounts no CORS middleware at all
**When** this story is implemented
**Then** the `cors` package is added to `backend/package.json` and configured with a single explicit origin read from a new `FRONTEND_ORIGIN` env var — never a wildcard, since a wildcard origin is incompatible with the `credentials: true` this story requires — and `FRONTEND_ORIGIN` is added to `.env.example` alongside the existing `JWT_*` variables
**And** without this configured, a cross-origin request from the deployed frontend to this backend fails outright — AD-19 puts the two on different hosts in production, so this is not optional hardening but the thing that makes any cross-origin call, cookie or not, work at all once deployed

**Given** `POST /auth/login`'s handler currently returns `refreshToken` as a plain field in its JSON `data` body, alongside `accessToken` and `refreshTokenExpiresAt`
**When** this story is implemented
**Then** the response's `data` no longer includes a `refreshToken` field at all — only `accessToken` and `refreshTokenExpiresAt` remain — and instead the handler calls `res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'none', path: '/api/auth', expires: session.expiresAt })`, reusing the same `session.expiresAt` `Date` the JSON body's `refreshTokenExpiresAt` already carries rather than computing a second, independent expiry
**And** the cookie's `path` is restricted to `/api/auth` — it is never attached to any other route, keeping its exposure to the smallest surface that needs it

**Given** `POST /auth/refresh`'s handler currently reads its input via `refreshTokenSchema.parse(req.body)`
**When** this story is implemented
**Then** it instead reads the token from `req.cookies.refreshToken`, populated by a new `cookie-parser` middleware mounted in `app.js`; a request with no such cookie is rejected at validation exactly as a request with no `refreshToken` body field was rejected before
**And** its response sets a new rotated cookie with the same attributes (using the rotated session's own `expiresAt`), and — like login — no longer returns a `refreshToken` field in the JSON body

**Given** `POST /auth/logout` and `POST /auth/logout-all`
**When** either is called
**Then** it calls `res.clearCookie('refreshToken', { path: '/api/auth' })` in addition to its existing session-revocation behaviour, so the browser drops the cookie the moment the server revokes the session it names

**Given** a `SameSite=None` cookie is attached by the browser to any cross-site request that targets its path, not only ones the frontend itself initiates
**When** this story is implemented
**Then** a small `requireSpaHeader` middleware is added ahead of `refresh`, `logout`, and `logout-all`, rejecting with 403 any request that does not carry a fixed custom header (`X-Requested-With: IMPOC-SPA`) — a plain cross-site form or image tag cannot set a custom header, and a genuine cross-origin `fetch`/XHR attempting to would first have to clear this story's own CORS preflight, which only `FRONTEND_ORIGIN` passes
**And** this is documented in the code as a nuisance-request mitigation (an attacker forcing a spurious cookie rotation or a forced logout) rather than a data-exposure CSRF defence, since CORS already prevents any other origin from reading either route's response body regardless of this header

**And** an automated test confirms `POST /auth/login`'s response body carries no `refreshToken` field, and its `Set-Cookie` header carries `HttpOnly`, `Secure`, `SameSite=None`, and `Path=/api/auth`
**And** an automated test confirms `POST /auth/refresh` succeeds when the cookie is present and is rejected (however the request body is populated) when it is absent
**And** an automated test confirms `POST /auth/refresh` and `POST /auth/logout` both reject a request missing `X-Requested-With: IMPOC-SPA` with 403, and both succeed when it is present on a request from the configured `FRONTEND_ORIGIN`

### Story 1.14: Sign-in screen and token lifecycle

As a staff member,
I want to sign in once and stay signed in across a reload without the access token going stale mid-task,
So that a 15-minute access-token expiry (`JWT_ACCESS_EXPIRES_IN=15m`) never interrupts a scan or a sale at the counter.

**Token storage, resolved by Story 1.13, not this story:** the access token lives in memory only, inside a new `frontend/src/auth/AuthContext.jsx`, never written to `localStorage`, `sessionStorage`, or any persisted store. The refresh token is never held or read by this code at all — it arrives and departs entirely as Story 1.13's httpOnly cookie, invisible to JavaScript, attached automatically by the browser on any call within its `/api/auth` scope because Story 1.10's `apiClient.js` sets `withCredentials: true`. (An earlier draft of this story held the refresh token in `localStorage['impoc.refreshToken']` as a documented trade-off against the cost of the cookie-based work Story 1.13 does; Raviraj chose the cookie instead, so that draft is recorded here only as the alternative that was rejected.) No AD-37-owned data (preferences, pinned cards) is ever written here in any case — this concern is auth state, not user-preference state.

**Acceptance Criteria:**

**Given** no `frontend/src/auth/` module exists yet
**When** this story is implemented
**Then** it creates `frontend/src/services/authApi.js` (thin wrappers over `platform/apiClient.js` for `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`), `frontend/src/auth/AuthContext.jsx` (the provider holding `accessToken` in memory, `currentUser`, `permissions`, and a `status` of `signed-out` | `restoring` | `signed-in` | `session-expired`), and `frontend/src/auth/useAuth.js` (the consuming hook)
**And** `AuthContext` calls `platform/apiClient.js`'s `setAccessTokenGetter()` (Story 1.10) once, at provider mount, wiring its own in-memory token as the getter every future authenticated call reads from

**Given** a new `frontend/src/screens/SignIn.jsx` with username/password fields and a submit action, styled on `.surface-flat` per DESIGN.md's unnamed-default rule — no named token exists for a sign-in form
**When** a staff member submits valid credentials
**Then** it calls `POST /auth/login`, stores `accessToken` and `permissions` in `AuthContext` state only, and transitions `status` to `signed-in` — the response's `Set-Cookie` header is handled entirely by the browser, never read or written by this code; no `preferences` field is read from the response or defaulted to `{}` anywhere in this code, per this epic's AD-37 constraint
**And** on an invalid-credentials response the screen shows the server's own message inline on the form, per EXPERIENCE.md Voice and Tone (name the specific thing), never a generic "login failed"

**Given** a valid httpOnly refresh-token cookie exists in the browser from a prior session
**When** the app boots — a fresh load or tab reattach
**Then** `AuthContext` sets `status` to `restoring` and calls `POST /auth/refresh` (the cookie is attached automatically; the call supplies no token itself, since it has none to read) before rendering any protected screen; on success it sets the new access token in memory, calls `GET /auth/me` to hydrate `currentUser` and `permissions`, and reaches `signed-in`
**And** on failure (an expired, revoked, or absent cookie) it sets `status` to `signed-out` — never `session-expired`, since a boot with no valid session is the ordinary signed-out state, not an interruption of anything already in progress; there is no client-side storage to clear on this path, since none was ever written

**Given** `platform/apiClient.js`'s axios instance (Story 1.10)
**When** any authenticated request receives a 401
**Then** a response interceptor attempts exactly one `POST /auth/refresh` (again, the cookie travels automatically), and on success retries the original request once with the new access token attached — the original request's body, including any `requestUuid` an AD-22 gesture already minted, is replayed unchanged, so a token expiring mid-gesture never mints a second idempotency key for the same attempt
**And** if that single refresh attempt itself fails, the interceptor does not retry again, does not loop, and rejects with a distinct `SESSION_EXPIRED` error

**Given** a `SESSION_EXPIRED` error — this is this story's explicit answer to "what happens when a refresh fails mid-task," which on this app means mid-scan at a counter
**When** it is caught by `AuthContext`
**Then** it clears the in-memory access token — there is no client-held refresh token to clear — and sets `status` to the distinct `session-expired` value (never silently collapsed into `signed-out`) carrying the message "Your session expired. Sign in again to continue." for whatever consumes `status` to render — Story 1.15's app shell renders that message before returning to `SignIn.jsx`
**And** this transition clears no other module's client-side state — nothing in `platform/` is touched — so a future epic's cart or in-progress form is not wiped by an auth failure that has nothing to do with it; this is the contract later epics build on, stated here so it is not invented ad hoc per screen

**Given** a signed-in session
**When** the exported `signOut()` action on `useAuth()` is called (later wired to a button in Story 1.15's app shell)
**Then** it calls `POST /auth/logout` — which is what actually clears the httpOnly cookie server-side, per Story 1.13 — clears the in-memory access token, and sets `status` to `signed-out`

**And** automated tests cover: successful login; invalid-credentials message display; boot-time session restore, both success and failure; one-shot 401-triggered refresh-and-retry; refresh failure surfacing `session-expired` with its message and without a retry loop; `signOut()` calling `POST /auth/logout` and clearing the in-memory token; and that `POST /auth/login`, `POST /auth/refresh`, and `POST /auth/logout` are all issued through `platform/apiClient.js`'s `withCredentials: true` instance

### Story 1.15: Route guard, app shell, and permission-driven navigation

As a staff member,
I want every screen unreachable until I've signed in, and to see only the sections my role actually holds,
So that no surface in the app is ever visible-but-forbidden, and the phone I'm handed at the counter shows me exactly what I'm allowed to touch (AD-29, EXPERIENCE.md → Information Architecture).

**Routing decision, stated explicitly:** `react-router-dom` is added to `frontend/package.json` and used for all routing from this story forward — `ARCHITECTURE-SPINE.md`'s Deferred section names no router precisely because no story before this one needed multi-screen navigation, and this is that story. No general client-side state management library is introduced alongside it: `AuthContext` (Story 1.13) remains the only cross-cutting client state this epic adds, consistent with the Deferred bullet's own revisit condition being scoped to "navigation or shared state," not to a library covering both.

**Acceptance Criteria:**

**Given** `frontend/src/App.jsx` currently renders the MVP scaffolding directly (`<h1>Barcode Scanner MVP</h1>` plus a bare `<BarcodeScanner />`)
**When** this story is implemented
**Then** `App.jsx` is rewritten to render a `BrowserRouter` wrapping `AuthContext`'s provider, itself wrapping a new `frontend/src/app/RouteGuard.jsx`
**And** `RouteGuard.jsx` renders its children only when `useAuth()`'s `status` is `signed-in`; for `signed-out` or `restoring` it renders `SignIn.jsx` instead (showing a brief loading state for `restoring`); for `session-expired` it renders `SignIn.jsx` carrying Story 1.13's message — there is no route reachable without a signed-in session, including by typing a URL directly

**Given** a new `frontend/src/app/navigation.js` registry, structured as an ordered list of `{ permission, label, path, element }` entries
**When** this story is implemented
**Then** the registry contains exactly one entry — `{ permission: PERMISSIONS.INVENTORY.BARCODE_GENERATE, label: 'Print labels', path: '/barcode-sheets', element: BarcodePrintScreen }` (Story 1.17) — because that is the only screen this epic ships; this mirrors Story 1.4's `gesture-type.js` precedent of enumerating a shared registry's shape now and letting each future epic's first story add its own entry to this same list, rather than building a parallel navigation system
**And** a new `frontend/src/constants/permissions.js` mirrors `backend/src/constants/permissions.js`'s string values exactly — there is no shared package between the two apps, so this duplication is accepted, not resolved, by this story

**Given** a new `frontend/src/app/AppShell.jsx`
**When** a signed-in user's `permissions` array is checked against `navigation.js`'s registry
**Then** only entries whose `permission` is present in the user's array render as navigation items — an entry the user's permissions don't cover does not render disabled or greyed out, it does not render at all, matching "a withheld surface is absent, never a disabled entry" (AD-29, EXPERIENCE.md)
**And** the check reads each entry's `permission` constant and nothing else — no code path anywhere in `AppShell.jsx` or `RouteGuard.jsx` compares a role-name string

**Given** the same registry
**When** a signed-in user whose permissions match no registry entry views the app shell
**Then** the navigation chrome renders with zero items rather than erroring — a legitimate state in this epic's span for a role like `ACCOUNTANT`, since no screen this epic ships is reachable to them, and this story invents no placeholder or empty-state message for it, since EXPERIENCE.md specifies none

**Given** DESIGN.md's chrome tokens and EXPERIENCE.md's Responsive & Platform table
**When** `AppShell.jsx` renders navigation
**Then** it renders as a bottom tab bar below `tablet` (600px) and a left rail from `tablet` up, both on `.surface-soft` per DESIGN.md's "navigation chrome... SOFT" rule, and the tab bar caps at four visible items regardless of how many registry entries a user's permissions unlock — this story's own registry has only one entry so the cap does not bind yet, but the component enforces it now rather than each future epic re-deciding it
**And** the app shell exposes a sign-out control wired to `useAuth()`'s `signOut()` (Story 1.14)

**Given** a user navigates directly to a path the registry does not grant them
**When** `RouteGuard.jsx` resolves the route
**Then** it redirects to the first registry path the user's permissions do grant, or to a bare "nothing here yet" screen if none — it never renders the requested screen and never renders a "Forbidden" page, which would itself be a visible-but-forbidden entry

**And** automated tests cover: an unauthenticated visit to any path renders `SignIn.jsx`; a signed-in `INVENTORY_MANAGER` sees "Print labels" in navigation and can reach it; a signed-in `CASHIER` (today's seeded set — `inventory.view`, `sales.create`, `sales.view`, none of which is `inventory.barcode_generate`) does not see "Print labels" in navigation and is redirected away from `/barcode-sheets` if visited directly; the tab bar renders bottom-fixed under a 375px viewport and as a left rail under a 1024px viewport; and a `session-expired` status renders `SignIn.jsx` carrying Story 1.14's message

### Story 1.16: Retire the MVP scaffolding

As a developer,
I want the throwaway MVP UI removed while the barcode decode core survives untouched,
So that the codebase reflects `frontend/AGENTS.md`'s own instruction — "treat the scanner's UI as scaffolding to replace and its ZXing decode logic as the asset to preserve" — instead of carrying dead demo code alongside the real app shell Story 1.15 just built.

**Acceptance Criteria:**

**Given** `frontend/src/components/StockIntakeForm.jsx` and `frontend/src/components/__tests__/StockIntakeForm.test.js` are the throwaway lot-intake demo `frontend/AGENTS.md` and this epic's brief both name as replaced by Epic 3's real intake screens
**When** this story is implemented
**Then** both files are deleted

**Given** `frontend/src/services/barcodeApi.js` exports a `scan()` function whose only caller was `StockIntakeForm.jsx`
**When** `StockIntakeForm.jsx` is deleted
**Then** `barcodeApi.js` is deleted too, since nothing imports it any longer — a grep for `barcodeApi` across `frontend/src` after this story returns no result; Epic 3's real intake-scan story builds its own service on `platform/apiClient.js` rather than reviving this file

**Given** `frontend/src/components/BarcodeScanner.jsx` holds the working native-`BarcodeDetector`-with-ZXing-fallback decode pipeline `frontend/AGENTS.md` names as the asset to preserve
**When** this story is implemented
**Then** the file is untouched — no line of its decode logic changes — and it is deliberately left unmounted, since no story before Epic 3 has a real scan screen to mount it into; an unused-file lint warning is expected and accepted here, not suppressed, since suppressing it risks masking a real unused-import warning elsewhere later

**Given** Story 1.15 already rewrote `App.jsx` to render the router/auth/shell stack instead of the old `<h1>Barcode Scanner MVP</h1>` wrapper
**When** this story is implemented
**Then** any rule in `frontend/src/App.css` that only ever styled that deleted MVP wrapper markup is removed, and `frontend/src/BarcodeScanner.css` is left untouched, since `BarcodeScanner.jsx` still depends on it

**And** this story's own verification confirms: `StockIntakeForm.jsx`, its test, and `barcodeApi.js` no longer exist; `BarcodeScanner.jsx` is byte-for-byte unchanged from before this story; `npm run build` and `npm test` both still pass

### Story 1.17: Barcode print screen

As an inventory manager,
I want to request and receive a sheet of blank barcode labels from the app I already carry,
So that this epic ships something I can actually use at the shop — the acceptance bar this epic's own brief sets — instead of ending on infrastructure alone (CAP-1, CAP-2, driving the `/generate` endpoint Stories 1.5–1.8 built).

**Acceptance Criteria:**

**Given** the app shell's navigation registry (Story 1.15) already reserves the one entry this story fills — `{ permission: PERMISSIONS.INVENTORY.BARCODE_GENERATE, label: 'Print labels', path: '/barcode-sheets' }`
**When** this story is implemented
**Then** it adds `frontend/src/screens/BarcodePrintScreen.jsx` as that entry's `element`, reachable only to a signed-in user whose permissions include `inventory.barcode_generate` — `ADMIN`, `MANAGER`, `INVENTORY_MANAGER` today, per Story 1.7's seeder — and absent from navigation for anyone else, exactly as Story 1.15's binding rule requires

**Given** the screen has a single numeric "pages" input (positive integer) and a primary submit action in `{components.thumb-action-bar}` on phone
**When** the staff member submits a value
**Then** the screen calls `platform/requestKey.js`'s `createRequestKey()` once, minted when the screen is entered — matching EXPERIENCE.md's "the key's lifetime is the sheet's lifetime" rule — reused unchanged across every retry of this same attempt, with a fresh key minted only if the staff member navigates away and back
**And** the call is made through `platform/wakingRequest.js` to `GET /api/barcodes/generate?pages={n}&requestUuid={key}` via `platform/apiClient.js`, so a cold-started backend surfaces `{components.waking-banner}` at 1200ms without blocking the rest of the screen, and a 90-second stall surfaces the retained-key "Try again" state, per this epic's inherited AD-19.1/AD-22 contract

**Given** the backend's first-attempt response for this endpoint is a raw `application/pdf` binary stream, not a JSON envelope (`barcode.controller.js`'s `generateBarcodePdf`)
**When** a first-attempt call succeeds
**Then** the screen reads the response as a blob, triggers a download named `barcodes.pdf`, and shows a success state naming the page count requested — "Sheet generated — {n} page(s)."

**Given** the same endpoint's replay response — a `requestUuid` already recorded in `request_keys` — is instead `{ success: true, message, data: { resultUuid } }`, JSON carrying no PDF bytes at all, per AD-22's "on replay, the service does not regenerate a sheet at all"
**When** a replay response is received
**Then** the screen does not attempt to read it as a blob or trigger any download, and instead shows "This sheet was already generated in your last attempt. Nothing new was printed — use the copy you already have." — matching EXPERIENCE.md's rule that a replayed gesture is shown as a success, never a warning or a duplicate, and the user is never told something failed when it actually committed

**Given** a validation or server error unrelated to the idempotency path — a non-positive page count, or a 403 reached by a direct URL despite Story 1.14's nav gating
**When** it occurs
**Then** the screen shows the server's own error message inline, per EXPERIENCE.md Voice and Tone, and a 403 specifically redirects through Story 1.15's `RouteGuard`, exactly as any other permission-withheld route does

**Given** `/test-sheet` — Story 1.5's fixed one-page calibration sheet
**When** this story is scoped
**Then** it deliberately builds no UI for it — the IA table names only "Barcode sheets... Request N pages" as the staff-facing surface, and `/test-sheet` remains reachable only by direct API call, for the physical caliper check Story 1.5's own acceptance criteria already specify

**And** automated tests cover: a permitted role reaching and submitting the screen; the blob/download path on a first-attempt PDF response; the "already generated" path on a JSON replay response; the waking-banner appearing on a delayed response; and the screen being absent from an unpermitted role's navigation (already covered by Story 1.15's own test, cross-referenced rather than duplicated here)

