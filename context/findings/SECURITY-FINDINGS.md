# IMPOC Security & Vulnerability Review — Findings

**Reviewer:** worker-security-lead-r23 (Application Security Lead / Dwight)
**Scope:** existing app code in this tree — `backend/` (Express 5 + Sequelize 6 + PostgreSQL, vanilla JS ESM) and `frontend/` (React 19 + Vite)
**Date:** 2026-09-07
**Method:** assumption-of-breach; authorization over authentication; money & stock treated as crown jewels. Every input traced entry → sink. Line-level review plus `npm audit` (backend/ and frontend/, plain and `--omit=dev`) against lockfiles generated from the committed `package.json` files.

---

## Severity summary

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 3 | CR-1 (double refund/void race), CR-2 (MANAGER→ADMIN privilege escalation), CR-3 (JWT forgery: session not bound to `sub` + weak/default secret) |
| **High** | 10 | H-1 … H-10 |
| **Medium** | 10 | M-1 … M-10 |
| **Low** | 8 | L-1 … L-8 |
| **Hardening** | 5 | HN-1 … HN-5 |

**FINAL VERDICT: BLOCK.** Three Critical and ten High findings; money-loss and full-takeover paths are reachable by a low-privilege authenticated user today.

---

## CRITICAL

### CR-1 — Double refund / double void / double expense-cancel (TOCTOU, no CAS on lifecycle status)
- **file:line:** `backend/src/modules/sales/sales.service.js:238-309` (`cancelSale`), `:315-361` (`refundSale`); `backend/src/modules/expenses/expenses.service.js:114-155` (`cancelExpense`)
- **OWASP:** API10 — Unsafe Consumption of Resources / A04:2021 — Insecure Design (concurrency), business-logic flaw; money integrity
- **How reached:** `POST /api/sales/:uuid/refund` (`SALES.REFUND`), `POST /api/sales/:uuid/cancel` (`SALES.CANCEL`), `POST /api/expenses/:uuid/cancel` (`EXPENSES.UPDATE` — agent-confirmed seeded perms). Two concurrent requests for the same completed sale/expense: both `SELECT` under READ COMMITTED and see `status === 'completed'` (the guard at `sales.service.js:326-330` is a plain read), both insert a **full-value reversal row**, both do an unconditional `save()` (last-write-wins). No compare-and-swap on `status` — contrast with the correct CAS used for units at `backend/src/modules/units/units.service.js:392-406`.
- **Yields:** Duplicate reversal rows — the money ledger records the refund/void twice while cash changes hands once (direct revenue loss on reconciliation). The unit-CAS incidentally protects `cancelSale`'s unit rollback, but **the refund path never touches units**, so it is fully exposed; same for the expense path.
- **What stops it:** Nothing. Replay of the same request body is also unthrottled (see M-2, M-3).
- **Fix:** Conditional UPDATE `SET status='refunded' WHERE id=:id AND status='completed'` (CAS, mirror `transitionUnit`); on 0 rows → 409. Do the reversal-row insert under the same `FOR UPDATE` lock. Add request-key idempotency (existing `request_keys` infra) to reversal routes.

### CR-2 — Privilege escalation: MANAGER (users.update) assigns ADMIN role to self / to any user
- **file:line:** `backend/src/modules/users/user.routes.js:30-34`; `backend/src/modules/users/user-role.service.js:36-101` (assign), `:103-161` (remove); seeder `backend/database/seeders/20260807175248-seed-role-permissions.js:32-34` (MANAGER = `users.view`,`users.update`)
- **OWASP:** A01:2021 — Broken Access Control / API1 Broken Object-Level Authorization; also IDOR-adjacent privilege escalation
- **How reached:** MANAGER (a seeded, non-admin role) → `GET /api/users` (enumerate, incl. admin), `GET /api/users/{adminUuid}/roles` (obtain ADMIN role UUID), `POST /api/users/{selfUuid}/roles` `{roleUuid:"<ADMIN>"}` → full admin. Same endpoints let MANAGER *strip* the admin's ADMIN role (`DELETE .../roles/:roleUuid`) and suspend the admin (`PATCH /:uuid/status`) → admin lockout (availability + DoS).
- **Yields:** Full horizontal privilege escalation to ADMIN; delegated `users.create` (H-3) then minting backdoors; admin DoS.
- **What stops it:** Only the `users.update` permission gate. No self-vs-other check, no privileged-target check, no privileged-role list, no last-admin guard, no separation between "manage users" and "manage roles".
- **Fix:** Create a dedicated `roles.assign` permission NOT granted to MANAGER; forbid assigning/removing roles on privileged accounts and assignment of privileged roles by non-admins; protect the last active admin; do not let `users.update` mutate status of self/priviledged users.

### CR-3 — Forgeable JWTs: session not bound to `sub` + no `algorithms` pin + default-secret deployment risk
- **file:line:** `backend/src/middleware/auth.middleware.js:55-62` (`jwt.verify` without `algorithms`), `:89-120` (session looked up by `payload.sessionId` only — **`session.user_id` never compared to `payload.sub`**); `backend/src/modules/auth/token.service.js:16-35`; `backend/.env.example:14,17` (placeholder `JWT_ACCESS_SECRET=your-long-random-access-secret`)
- **OWASP:** A07:2021 — Identification & Authentication Failures; A02:2021 — Cryptographic Failures
- **How reached:** Token payload is `{sub:userUuid, sessionId, type:'access'}`. If the secret is known (placeholder copied verbatim from `.env.example` into production is explicitly plausible — nothing enforces secret strength/rotation; `getRequiredEnv` only checks presence), any active low-privilege user can: take one of their **own** session UUIDs, run `jwt.sign({sub:'<adminUuid>', sessionId:'<ownSession>', type:'access'})`, and present it. `authenticate` finds their valid session, `authorize` now runs against the admin's UUID → **complete impersonation of any user, including ADMIN**. `algorithms:['HS256']` is not pinned, widening the accepted-algorithm surface.
- **Yields:** Total account takeover / auth bypass with one leaked or defaulted secret.
- **What stops it:** Secrecy/strength of `JWT_ACCESS_SECRET` only. The refresh cookie being httpOnly does not help (access tokens are self-contained).
- **Fix:** Bind the session to the subject — after fetching `AuthSession`, assert `session.userId === (from payload.sub lookup)`; pin `algorithms:['HS256']`; enforce min secret length at boot; rotate secrets; remove placeholder secret from committed example (fail fast if secret equals the example value).

---

## HIGH

### H-1 — No rate limiting / lockout / failed-attempt tracking on login (and refresh)
- **file:line:** `backend/app.js:30-85` (no `express-rate-limit`/`helmet`), `backend/src/modules/auth/auth.routes.js:22` (`POST /api/auth/login` public)
- **OWASP:** A07 — AuthN failures; OWASP API 9 — Improper Inventory/Excessive Data Exposure; brute-force
- **How reached:** unlimited credential guessing against seeded `admin` and any known staff username (usernames are believable, cf. L-2).
- **Yields:** Credential-stuffing/brute-force account takeover; compounds L-1 (timing enumeration) and HN-1 (no MFA).
- **Stops it:** only Argon2id cost.
- **Fix:** per-IP and per-account rate limit + exponential lockout on `/login`, `/refresh`; optional 2FA for admin; CapRPC/helmet.

### H-2 — IDOR: 12 GET routes are authenticate-only and leak the entire cost book
- **file:line:** `backend/src/modules/intake/trip.routes.js:18,22,28`; `stock.routes.js:20,26`; `template.routes.js:18,22`; `vendors/vendor.routes.js:18,22,24`; `units/units.routes.js:23,27,34`
- **OWASP:** API1 Broken Object-Level Authorization; A05 Access Control
- **How reached:** any authenticated user (no `authorize()`): `GET /api/trips`, `/api/trips/:uuid`, `/api/vendors`, `/api/vendors/:uuid/history`, `/api/trips/:tripUuid/stocks`, `/api/stocks`, `/api/templates`, `/api/units/by-barcode/:barcode`, `GET /api/trips/:tripUuid/clone-last-stock`, etc.
- **Yields:** complete purchasing cost book — `buying_price_paise`, `floor_price_paise`, quantity per stock line/template/unit (`units.service.js:104-106`, `vendor.service.js:283-305`, `trip.service.js:454-461`), full vendor purchase history, trip bills incl. base64 receipt images (`trip.service.js:431`), barcode→stock metadata. Breaks least-privilege for any low-privileged operator; leaks commercial pricing intelligence. The `inventory.view` permission exists (`backend/src/constants/permissions.js:9-15`) but these reads never require it.
- **Stops it:** nothing.
- **Fix:** `authorize(PERMISSIONS.INVENTORY.VIEW)` (and picklist/unit equivalents) on all read routes; add ownership/tenant scoping beyond role gates.

### H-3 — IDOR: `users.update`/`users.create` target any user incl. admins; arbitrary privileged role at create
- **file:line:** `backend/src/modules/users/user.routes.js:22-26`; `user.service.js:73-84,153-228`; `user.validation.js:41-43`
- **OWASP:** A01 broken access control / mass-assignment-adjacent
- **How reached:** `PATCH /api/users/{adminUuid}` rewrites admin email/username/phone (hijack priming, PII tampering); `POST /api/users` accepts any `roleUuid` incl. ADMIN (`users.create` currently seeded only to ADMIN → latent; instantly exploitable if ever delegated). Status change via `PATCH /:uuid/status` suspends anyone.
- **Yields:** admin-account hijack setup, backdoor account minting, admin DoS.
- **Stops it:** the `users.update`/`users.create` gates only; zod strips unknown keys (no mass-assignment of `status`/`password`/`roleId` inline — positive).
- **Fix:** privileged-target guard, privileged-role guard, distinct role-assignment permission, last-admin protection.

### H-4 — IDOR: trip/stock ownership check is a stub; scan path ignores the trip boundary entirely
- **file:line:** `backend/src/modules/intake/trip.service.js:206-223` (`verifyTripAccess` — only "trip exists", `user` param unused; doc-comment admits "all authenticated users have access to all trips"); `stock.controller.js:129-151` (`scanIntoStock` never calls it and never parses `req.params.tripUuid`); `stock.service.js:410-414` (lookup by `{uuid}` only)
- **OWASP:** API1 broken object-level authorization
- **How reached:** `POST /api/trips/:tripUuid/stocks/:uuid/scan` lets any `inventory.create` holder scan units into **any stock line in the DB** by supplying a target stock UUID, regardless of the trip the URL claims. Writes are role-gated but never ownership-gated; reads (H-2) are neither.
- **Yields:** cross-trip/vendor stock attribution corruption; every authenticated user reaches every trip/stock record.
- **Stops it:** nothing ownership-wise.
- **Fix:** implement real ownership in `verifyTripAccess`; scope scan lookup to `where:{uuid, trip: {uuid: tripUuid}}`; enforce on all stock/scan/template controllers.

### H-5 — IDOR: receipts expose any transaction + customer PII by enumerable UUID
- **file:line:** `backend/src/modules/receipts/receipts.routes.js:13,16` (`REPORTS.VIEW` gate only); `receipts.service.js:82-87,138-143` (lookup by `{uuid}`), `:60-76` (`customerBlock` returns name/phone/email)
- **OWASP:** API1 broken object-level authorization; A01; GDPR-ish sensitive-data exposure
- **How reached:** `GET /api/receipts/preview?entityType=SALE&entityUuid=<any>` / `/print`. No check the caller is entitled to or owns the target.
- **Yields:** full ledger disclosure — every sale/rental's line items, prices, payment method, status, plus linked customer name/phone/email. UUIDs are enumerable → dump the customer directory at `reports.view`.
- **Stops it:** nothing.
- **Fix:** scope by creator/ownership/role-of-caller; restrict `reports.view` holders; consider masking customer PII unless entitlement proven.

### H-6 — Sale/rental item with neither `barcode` nor `unitUuid` sells the first unit in the table
- **file:line:** `backend/src/modules/sales/sales.validation.js:16-21`; `rentals/rental-agreement.validation.js:5-8`; `sales.service.js:82-88` (`resolveSellableUnit` → `where = { uuid: unitUuid } : { barcode }`; when both undefined Sequelize drops the key → `WHERE deleted_at IS NULL`)
- **OWASP:** A01/A04, business logic & data-integrity flaw
- **How reached:** `POST /api/sales` with `"items":[{}]`. Sells/rents an arbitrary unit (first RETAIL/RENTAL in_stock row) — wrong item, wrong stock attribution, receipt/db mismatch. Two racing empty-item requests grab two units. Deliberate use = arbitrary-stock sale machine for any cashier-with-create.
- **Yields:** stock & money misattribution; operator fraud vector.
- **Stops it:** the sellability checks only (`sales.service.js:96-106`).
- **Fix:** zod asserts exactly one of `barcode`/`unitUuid` per item (`.refine`), and service rejects `where` with neither key.

### H-7 — int8 (BIGINT paise) parsed to JS Number — silent money corruption above 2^53
- **file:line:** `backend/src/database/pg-pool-config.js:51-62` (global `pg.types.setTypeParser(20, parseInt)`); all money columns are BIGINT (e.g. `database/migrations/20260903000001-create-sales.js:30-33`); recomputation in float: `intake/trip.service.js:82-91,154,162-163,375-401`; `vendors/vendor.service.js:218-228,260,268-269`; `receipts/receipts.service.js:103-106,163-171`
- **OWASP:** A04 insecure design / money-integrity (POS crown-jewel)
- **How reached:** any endpoint returning money for values above 9,007,199,254,740,991 — parseInt rounds silently; every SUM/variance is then recomputed in float space. Max int8 is ~2.2% above MAX_SAFE_INTEGER, so cumulative totals/karts routinely cross the boundary.
- **Yields:** wrong totals, wrong variances, wrong receipts — silent, unreconcilable.
- **Stops it:** nothing at parse time (doc-comment even admits guards are "elsewhere" — they aren't).
- **Fix:** keep money as strings/`BigInt` until rendering; or cap inputs at `Number.MAX_SAFE_INTEGER` and perform sums in Decimal/BigInt; add integer-cents discipline throughout.

### H-8 — JWT access token persisted to localStorage (XSS-exfiltratable), contradicting its own comment
- **file:line:** `frontend/src/auth/AuthProvider.jsx:56` (`localStorage.setItem('accessToken',…)`), `:107-113` (boot fallback reads it), `:47` comment says "memory only, never persisted"
- **OWASP:** A02 cryptographic failures (token storage); A03 injection escalation channel
- **How reached:** any XSS/DOM-injection on the origin reads `localStorage.getItem('accessToken')` and exfiltrates the bearer credential of the current session. Persisted across sessions; ~15-min TTL bounds but not removes the risk. No XSS sink found today (positive) — this is the highest-value hardening-to-eliminate.
- **Yields:** full API impersonation as the victim, stealing money/stock admin surface.
- **Stops it:** no current XSS sink; httpOnly refresh cookie exists and can restore sessions without localStorage.
- **Fix:** memory-only token; restore via `/auth/refresh` cookie only; remove localStorage fallback.

### H-9 — Suspended/deleted user keeps a live access token and session
- **file:line:** `backend/src/middleware/auth.middleware.js:89-110` (checks session revocation/expiry only, never `user.status`); `backend/src/modules/users/user.service.js:250-253,276-278`
- **OWASP:** A07 authN failures (session lifecycle)
- **How reached:** admin suspends/deletes an employee; their last access token (≤15 min TTL) and the session remain valid until expiry; they keep operating the register mid-shift.
- **Yields:** continued authenticated access after deactivation.
- **Stops it:** refresh-time status check (`auth-token.service.js:69`) only.
- **Fix:** check `user.status === 'ACTIVE'` inside `authenticate`; optionally revoke all sessions on status change.

### H-10 — Refresh-cookie `secure` flag off outside production; LAN-HTTP deployment documented
- **file:line:** `backend/src/modules/auth/auth.controller.js:21-34` (`secure: isProduction`, `sameSite: isProduction?'strict':'lax'`)
- **OWASP:** A02 (in-transit exposure); A07
- **How reached:** documented LAN deployment over plain HTTP (non-production): refresh cookie — the credential for `/auth/refresh` — transits/cleartext on the wire and is sent on any same-site path=/, `path:'/'`.
- **Yields:** session hijack via network sniffing on the LAN.
- **Stops it:** httpOnly + sameSite=lax partially; the SPA-Header CSRF guard on `/refresh` (see positives).
- **Fix:** serve TLS in every environment; require `secure` on cookie or refuse non-production refresh cookies; scope cookie path.

---

## MEDIUM

### M-1 — Money zod ceiling set to int8 max instead of `Number.MAX_SAFE_INTEGER`
- **file:line:** `backend/src/modules/intake/trip.validation.js:5-9`; repeated in `stock.validation.js:34,40,48,54,64,72,80`)
- Values between 9,007,199,254,740,991 and 9,223,372,036,854,775,807 pass validation but cannot be represented precisely → stored amount differs from entered amount. Fix: cap at `Number.MAX_SAFE_INTEGER`.

### M-2 — Template money fields accept float/string with no `.int()` and no upper bound
- **file:line:** `backend/src/modules/intake/template.validation.js:5-11,13-24,26-41`
- `100.5` or `1e21` passes refinement → Postgres `bigint` rejects or the JS value is rounded → 500s / silent rounding on a money input. Fix: `.int().max(MAX_SAFE_INTEGER)`.

### M-3 — No idempotency protection on any money-writing POST (double-processing)
- **file:line:** `sales.routes.js:23,32,35`; `rental-agreement.routes.js:23,32,35`; `expenses.routes.js:22,31`; infra exists but is wired only for barcodes (`backend/src/modules/idempotency/idempotency.service.js:12-40`, `barcode.controller.js:22-43`)
- Retry/double-click/malicious replay → N sale documents / N reversal rows (feeds CR-1). Fix: gesture-key idempotency (`request_uuid`) on create/cancel/refund.

### M-4 — Document-number generation races (`S-####`/`R-####`)
- **file:line:** `backend/src/modules/sales/sales.service.js:30-39` (`nextSaleNumber`), `rentals/rental-agreement.service.js:44-53`
- Two concurrent checkouts compute same `max+1`; unique index aborts the loser's whole transaction → failed checkout / user retries (double-charge risk). Fix: DB sequence or `INSERT ... RETURNING` with conflict handling.

### M-5 — `createdBy` recorded but never used to scope reads (no per-creator authorization)
- **file:line:** `sales.service.js:148,201-231`; `rental-agreement.service.js:216,272-308`; `expenses.service.js:39,48-72` (column `created_by INTEGER` exists on models `Sale.js:80-84`, etc.)
- Any holder of the entity's VIEW sees the entire multi-cashier book. Fix: creator/tenant-scoped visibility entitlement.

### M-6 — Delivery logs accept arbitrary `receiptPayload` JSON and free `entityUuid`
- **file:line:** `backend/src/modules/delivery/delivery.validation.js:17` (`z.unknown()`), `delivery.service.js:10,26-42,47-59`
- Stores/echoes arbitrary blobs (incl. receipt PII by re-posting I-5 payloads); logs can reference non-existent entities; 15 MB body limit means large exfil. Fix: shape-validate and cap `receiptPayload`.

### M-7 — 4xx error responses echo internal row details verbatim
- **file:line:** `backend/src/middleware/error.middleware.js:19-24` (passthrough of `error.message` for `<500`); producers: `stock.service.js:499-505` (leaks existing unit uuid/status/colour/size UUIDs), `sales.service.js:102-106`, `units.service.js:425-430`, `rental-agreement.service.js:99-101,387-389`
- **Yields:** free reconnaissance of valid UUIDs + statuses to chain with CR-1/H-4/H-5. Fix: message allow-list / generic 4xx text; log details server-side.

### M-8 — `paymentMethod` / `customerSource` are free-form on the financial ledger
- **file:line:** `sales.validation.js:13-14`, `rental-agreement.validation.js:18-19`
- Arbitrary strings persist into money records and receipts (`receipts.service.js:115,179,267-268`), corrupting payment-channel reporting; no `.enum()` / lookups against `payment_methods`/`customer_sources` picklists. Fix: validate against picklists.

### M-9 — Frontend dependency: react-router-dom < 7.18.0 (open redirect + `deserializeErrors` constructor injection)
- **file:line:** `frontend/package.json:28` (`react-router-dom ^6.28.0`)
- **npm audit (prod, `--omit=dev`):** 2 moderate — `react-router` GHSA-wrjc-x8rr-h8h6 (open redirect via backslash in `<Link>`/`useNavigate`, CVE-2025-68470 bypass) and GHSA-337j-9hxr-rhxg (`deserializeErrors()` constructor injection, CVSS 6.1 — SSR-hydration-only, this app is client-rendered so low practical exposure). Fix: upgrade react-router-dom to 7.18.x.

### M-10 — Dev-only toolchain: vitest <3.2.6 (critical GHSA) + old vite/esbuild
- **file:line:** `frontend/package.json:44-45` (`vitest ^1.0.4`, `vite ^8.1.1`); audit tree resolves vitest 1.x → GHSA-5xrq-8626-4rwp "arbitrary file read + execution when Vitest UI server listening" (CVSS 9.8), plus vite GHSA-4w7w-66w2-5vf9 / GHSA-fx2h-pf6j-xcff (dev-server path traversal / `server.fs.deny` bypass) and esbuild GHSA-67mh-4wv8-2f99.
- These are dev-time tools (never reach production), but a developer running `vitest` with the UI server on a shared network is exploitable. Fix: drop `--ui` usage/never bind to non-loopback; upgrade vitest to ≥3.2.6.

---

## LOW

- **L-1 — Login timing enumerates usernames** (`auth.service.js:8-36`): argon2 verify runs only for existing users → valid-username oracle. Fix: always run a dummy argon2 compare. (OWASP A07)
- **L-2 — Staff email/phone visible to any `users.view` holder** (`user.controller.js:17-28`); hashes correctly never exposed. (A01)
- **L-3 — Internal sequential `customerId` serialized into sale/rental DTOs** (`sales.service.js:51`, `rental-agreement.service.js:123`), violating the codebase's own "internal id never leaves process" invariant (`units.service.js:298`). Fix: uuid-only. (A01/exposure)
- **L-4 — Postman dev credentials committed** (`postman/.env.template:6-7`, `.env.example:24-25`, `ENV_SETUP_GUIDE.md:22-23`): `admin / password123`. Dev-only but a classic prod-breach seed; rotate and mark dev-only.
- **L-5 — `Op.iLike`/`Op.like` wildcard inputs** (`customers.service.js:86-88`, `units.service.js:24`, `stock.service.js:642-646`): parameterized (not SQLi) but `%`/`_` act as wildcards → query-inefficiency/DoS-ish and fuzzy-result data exposure. (Lower)
- **L-6 — `req.user.id` bare deref in scan controller** (`stock.controller.js:141`): if `authenticate`'s user fetch fails, `req.user` undefined → 500. Sibling controllers use `req.user?.id`. Fix: optional-chain.
- **L-7 — `scanIntoStock`/server error strings forwarded to the UI** (`frontend/src/services/*Api.js buildError` pass-through): depends on backend masking (it does for 5xx); keep backend 4xx allow-list in lockstep.
- **L-8 — `frontend/vite.config.js:14` dev server `host: true`** binds 0.0.0.0; dev proxy reachable from the LAN. Fix: `host: 'localhost'`.

---

## HARDENING

- **HN-1 — No MFA / no account-lockout / no password-reset flow** anywhere → compounds CR-2/H-1. (A07)
- **HN-2 — Password policy is `min(8)` only** (`user.validation.js:19-21`); add complexity/breach-list checks and min length for seeded admin.
- **HN-3 — Missing security headers/helmet** (`app.js` mounts none); add `helmet`, CSP, `X-Frame-Options` etc. (LOW practical today — JSON API).
- **HN-4 — `.env.example` documents a default admin password style** `SEED_ADMIN_PASSWORD=Admin@12345` (`backend/.env.example:23`); seeder hard-fails if unset (positive), but a copy-paste deploy seeds `admin/Admin@12345`. Remove the sample value and enforce strength.
- **HN-5 — Theme settings read from `localStorage` into DOM `data-*` attributes** (`frontend/src/theme/ThemeProvider.jsx`, `index.html` inline script): attribute-value writes only, no script execution today; guard when these are ever consumed as URLs.

---

## Dependency audit results (`npm audit`)

| Scope | Critical | High | Moderate | Notes |
|---|---|---|---|---|
| `backend` (all) | 0 | 0 | 2 | `sequelize`→`uuid` <11.1.1, GHSA-w5hq-g745-h8pq (buffer bounds, CWE-787; CVSS 7.5). Requires passing `buf` to uuid v3/v5/v6 — not reached by any app code path found; treat as hardening, pin/override `uuid` if feasible |
| `backend` (`--omit=dev`) | 0 | 0 | 2 | identical (sequelize is a prod dep) |
| `frontend` (all) | 1 | 1 | 4 | **critical:** `vitest` <3.2.6 (dev-only, UI-server path); high: `vite` dev-server path traversal (dev-only); see M-10 |
| `frontend` (`--omit=dev`) | 0 | 0 | 2 | `react-router`/`react-router-dom` <7.18.0 (see M-9) |

Note: audits run against lockfiles generated in a temp dir from the committed `package.json`s (the tree itself has no `package-lock.json` committed and no `node_modules`), so exact transitive versions may drift from a real install.

---

## Verified positives (no findings)

- **Argon2id** with auto-salt and timing-safe verify (`password.service.js:3-11`); password hashes never serialized to any DTO.
- **Zod validation at every input boundary** in auth/users/roles/permissions/sales/rentals/expenses/intake/receipts/delivery; no raw `req.body` accepted.
- **No SQL injection** found: the only `sequelize.query` calls are parameterized with `replacements` (`barcode.service.js:68-75`, `app-settings.service.js:57-64`, `units.service.js:393-406`, migration/seed queries); the lone `literal()` is a hardcoded constant (`trip.service.js:85`).
- **No OS/path/command injection**: no `child_process`/`exec`/`spawn`; no fs writes to attacker-controlled paths.
- **No XSS sinks**: no `dangerouslySetInnerHTML`/`eval`/`new Function`/`document.write`/`innerHTML`; React auto-escapes all rendered data; backend returns JSON only; receipts are plain-text.
- **CSRF structurally mitigated**: state changes ride `Authorization: Bearer` headers, not cookies; cookie-only `/auth/refresh`, `/logout*` are wrapped in `requireSpaHeader` (`X-Requested-With: impoc-spa`, preflight-gated), and the frontend only sets that header on auth calls.
- **Clean logout/session lifecycle**: server-side session revocation on logout; refresh-token rotation with reuse-revocation; access-token/session enforcement makes logout actually invalidate.
- **Concurrency done right in one place**: unit `transitionUnit` uses CAS (`units.service.js:392-406`) and `scanIntoStock` rows-locks (`stock.service.js:437,508-522`) — the pattern CR-1 must adopt.
- **Error 5xx fully masked** as generic `Internal server error`; only intentional app-authored 4xx messages are echoed (see M-7).
- **CORS pinned** to a single validated `FRONTEND_ORIGIN` (`app.js:36-53`).
- **Admin seeder hard-fails** if `SEED_ADMIN_PASSWORD` is absent (no default fallback).
- `express.json({limit:'15mb'})` with zod-tight consumers; no prototype-pollution path found.

---

## Recommended remediation priority

1. **CR-1** double-refund/void CAS + reversal idempotency.
2. **CR-2** lock down role assignment (separate permission; privileged-role/self/last-admin guards).
3. **CR-3** bind session to `sub`, pin algorithms, enforce secret strength, rotate, kill the placeholder.
4. **H-2/H-4/H-5** object-level authorization on all reads (inventory cost book, receipts/PII).
5. **H-6** item identity assertion; **H-7** integer-cents money discipline.
6. **H-1** login rate limiting; **H-8** memory-only token; **H-9/H-10** session lifecycle + TLS everywhere.
7. Then M-1…M-10, then Low/Hardening.

Re-verify after remediation via `security-verifier` (fixes were not authored by this review).