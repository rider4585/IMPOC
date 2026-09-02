# Epic 1 Context: Foundation & Barcode Remediation

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Staff can generate correct, uniquely-numbered A4 barcode sheets, and the database carries the extensions, sequences and tables every later epic depends on. This epic establishes the first four binding migrations (`btree_gist` → `barcode_seq` → `app_settings` → `request_keys`), fixes five known barcode defects (A2 page size, colliding `Date.now()` generator, unauthenticated routes, hand-built error JSON, undeclared frontend dependency), and builds the shared frontend foundation all subsequent frontend epics depend on — a `platform/` module with idempotency, cold-start retry, collection parsing, and money formatting, plus theme tokens and authentication flows. The backend is delivery-complete at Story 1.9; Stories 1.10–1.17 deliver the frontend layers.

## Stories

- Story 1.1: Enable the btree_gist Postgres extension
- Story 1.2: Create the barcode_seq sequence
- Story 1.3: Create the app_settings table and typed accessor
- Story 1.4: Create the request_keys table and shared idempotency helper
- Story 1.5: Rework the barcode label layout for A4 with configurable geometry
- Story 1.6: Replace the barcode value generator with a persistent counter
- Story 1.7: Authenticate and authorize barcode routes
- Story 1.8: Zod validation for barcode routes
- Story 1.9: Declare @zxing/library as an explicit frontend dependency
- Story 1.10: Establish the `platform` module — idempotency, cold-start retry, envelope, money, and the API client
- Story 1.11: Establish the DESIGN.md token theme — typography, colour, and the three surface treatments
- Story 1.12: Expose the signed-in user's permission set on login and session restore
- Story 1.13: Move refresh-token delivery to an httpOnly cookie, with the CORS policy that makes it deliverable
- Story 1.14: Sign-in screen and token lifecycle
- Story 1.15: Route guard, app shell, and permission-driven navigation
- Story 1.16: Retire the MVP scaffolding
- Story 1.17: Barcode print screen

## Requirements & Constraints

**Sheet output.** A request for N pages returns one A4 PDF of N pages. Printed at 100% scale each barcode measures 35mm × 8mm (±0.5mm), its human-readable number renders at 5pt directly beneath it, and 15pt of blank space sits below that for handwriting a price. Every page carries the same whole number of labels. The success criterion is a caliper reading against a physical print, not a viewer's zoom level — a unit test alone cannot certify it.

**Every label dimension is runtime-configurable** — barcode width and height, text size, clear space, margins, and the derived grid — so the layout is tuned against a physical print with no code change and no redeploy.

**Uniqueness without a register.** Values come from a single persistent counter, strictly increasing, zero-padded to a fixed width. Ten concurrent 100-page requests must produce zero duplicates across the whole set and across every sheet printed before them, and the sequence must never rewind after a process restart or a database restore. No table may record which values were printed, which sheets they appeared on, or whether they were ever used.

**Access.** Sheet generation is restricted by permission (`INVENTORY.BARCODE_GENERATE`), never by a role-name or string-literal test in a route.

**Frontend foundation.** The `platform/` module is the single shared source for five client-side obligations that all later frontend epics depend on: client-generated idempotency keys (UUIDv4), 1200ms cold-start detection with exponential backoff retry, collection envelope parsing `{ items, page, pageSize, total }`, money formatting (paise → ₹ with Indian grouping, half-up to 2dp), and a single configured axios instance with access-token injection points. Every later frontend epic imports these rather than reimplementing them.

**Authentication and session.** Refresh tokens are delivered as httpOnly, cross-site cookies scoped to `/api/auth`. Access tokens are injected via `Authorization: Bearer` by `platform/apiClient.js`. The `/auth/login` and `/auth/me` endpoints return the signed-in user's resolved permission set as a sorted string array. Neither endpoint carries a `preferences` field in this epic — `user_preferences` does not exist until Epic 12 ships.

**Theme and accessibility.** Typography (Bricolage Grotesque + Instrument Sans, self-hosted from @fontsource), color tokens, and three surface treatments (flat/soft/glass) are declared once as CSS custom properties with light/dark variants driven by `prefers-color-scheme` only — no toggle, no stored preference. Money figures render only via `.money`/`.money-lg`/`.money-sm` typography classes paired with `formatPaise()`.

**Navigation and route guards.** Every route is permission-gated through a shared navigation registry; a surface a signed-in user cannot reach is absent from navigation, never present and disabled. Route guards refuse access before any component renders.

## Technical Decisions

- **Migration order is binding and forward-only.** `01-enable-btree-gist` is first and alone; a host that forbids `CREATE EXTENSION` fails on step one before fifteen tables land. Then `02-create-barcode-seq`, `03-create-app-settings`, `04-create-request-keys`. `down()` is written for local development only and never runs against hosted databases.
- **Barcode value shape (12 digits, zero-padded):** a 7-digit prefix of whole minutes elapsed since 2026-01-01 00:00 `Asia/Kolkata`, concatenated with a 5-digit within-minute counter from `nextval('barcode_seq') % 100000`. The minute prefix is computed in Postgres, never from Node's `Date.now()`.
- **`barcode_seq` is a Postgres `SEQUENCE`, never a counter row.** Non-transactional, so rolled-back sheets burn their numbers; gaps are harmless since nothing registers what was printed.
- **Boot-time guard:** the barcode service refuses to issue until the current Postgres minute exceeds `max(left(barcode, 7))` over `units` — one SELECT, no new table, no new state.
- **`app_settings` is a typed key/value table:** `key VARCHAR PRIMARY KEY`, `value_text TEXT`, `value_int BIGINT`, `value_type VARCHAR` under a named CHECK, plus created/updated timestamps (mutable-master-data tier). An accessor module returns a parsed value by `value_type` and throws on a missing key — never null, undefined, or a silent default. The table is cached in-process for the request only, never longer.
- **`request_keys` is one table for every mutating gesture, keyed on the gesture rather than the row it writes:** `(gesture_type, request_uuid)` under a partial unique index `WHERE deleted_at IS NULL`. No table anywhere gains a `client_request_uuid` column. The row is INSERTed last, inside the gesture's own transaction, so key and work commit or roll back together.
- **Table conventions:** integer `SERIAL` primary key and `uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()`; the API speaks `uuid` only. Every new table carries `deleted_at TIMESTAMPTZ NULL`. Constrained strings are `VARCHAR(n)` + a **named** CHECK constraint, never `ENUM`, with values `UPPERCASE_SNAKE`.
- **CORS and cookies:** `cors` middleware with explicit origin from `FRONTEND_ORIGIN` env var (never wildcard, since `credentials: true` is required); httpOnly, cross-site refresh-token cookie scoped to `/api/auth`.
- **Frontend tooling:** `vitest`, `@testing-library/react`, and `@testing-library/jest-dom` added to `frontend/package.json`'s `devDependencies`; `vitest.config.js` created; `"test": "vitest run"` added to scripts. This is the first story in the frontend codebase to run automated tests under a real test runner.
- **Fonts and tokens:** Bricolage Grotesque and Instrument Sans are self-hosted via `@fontsource-variable/*` (resolving a DESIGN.md note in favour of removing the render-blocking third-party request). CSS custom properties on `:root` with `prefers-color-scheme: dark` override, no `data-theme` attribute.
- **Single axios instance:** `platform/apiClient.js` exports one configured instance with `withCredentials: true` and base URL from `VITE_API_BASE_URL` env var. It exposes `setAccessTokenGetter(fn)` for access-token injection; requests carry `Authorization: Bearer` from the getter or no header at all when no getter is registered.
- **Permissions:** add `INVENTORY.BARCODE_GENERATE` and mount routes behind `authenticate` + `authorize(PERMISSIONS.INVENTORY.BARCODE_GENERATE)`. Grant to exactly `ADMIN`, `MANAGER`, and `INVENTORY_MANAGER` in a scoped seeder migration. Route guards use permission constants, never role-name tests. Permission set is returned from `/auth/login` and `/auth/me` as a sorted string array.

## UX & Interaction Patterns

**Backend only (Stories 1.1–1.9).** No screen changes beyond the existing print trigger. Two behaviours it must not foreclose: human-readable digits under every label are the manual-entry fallback used on every downstream scan surface, so they must be legible at 5pt; and a barcode already bound to a unit is refused at intake with a message naming the existing unit.

**Frontend flows (Stories 1.10–1.17).** Cold-start wake/retry banner surfaces after 1200ms if a request remains unanswered, retries with exponential backoff, and at 90s surfaces a failed state with the same request key retained. Sign-in screen captures username and password; refresh-token cookie persists the session across app restarts. Route guards redirect unsigned-in visitors to `/auth/login` and prevent access to routes the signed-in user's permission set doesn't include. App shell renders a permission-gated navigation sidebar; a surface a user cannot reach is absent from navigation. Barcode print screen is a standalone UI for generating and downloading PDF sheets, accessible only to users holding `INVENTORY.BARCODE_GENERATE`.

## Cross-Story Dependencies

**Backend chain:** Migrations run strictly 1.1 → 1.2 → 1.3 → 1.4; each story assumes its predecessor has applied. Story 1.5 depends on Story 1.3's `app_settings` table. Story 1.6 depends on Story 1.2's sequence and Story 1.4's `request_keys` table. Stories 1.7, 1.8, 1.9 are independent of the migration chain and each other.

**Frontend chain:** Story 1.10 (`platform/` module) is foundational; all later frontend stories import from it. Story 1.11 (theme tokens) is foundational; all later screens consume its CSS variables. Story 1.12 (permission set exposure) gates Story 1.15's permission-driven navigation. Story 1.13 (httpOnly cookie + CORS) gates Story 1.14's sign-in flow. Story 1.14 (sign-in) gates Story 1.15's route guards. Story 1.15 (route guard + app shell) is the structural frame every later screen sits inside. Story 1.16 (retire scaffolding) removes the MVP test file. Story 1.17 (barcode print screen) is the first real consumer of the platform module and theme tokens.

**Downstream:** Story 1.1's `btree_gist` extension is what Epic 7's rental-availability exclusion constraint relies on. Story 1.4's `request_keys` table and idempotency helper serve every later mutating gesture. Story 1.3's `app_settings` later holds the exchange-window setting. The `platform/` module (Stories 1.10–1.11) and authentication flows (Stories 1.12–1.15) are imported by every later frontend epic without modification.
