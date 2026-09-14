# IMPOC — Completion Plan (Hive Board)

**Goal:** Complete the IMPOC shop-management app (Inventory, POS, Rental, Expenses, Reports) for SHREE Fashion Store. Backend (Express/Sequelize/Postgres) is ~70% done; frontend (React 19 + Vite) is ~10% done. This board tracks the full completion effort.

**Guiding decisions (2026-09-03, from human):**
- Not using bmad for this work; god orchestrates directly via hive agents.
- Follow bmad epic priority order: **Intake UI → Sales → Rentals → Expenses → Dashboard/Reports**.
- UI: **modern, light-mode only**, Tailwind/shadcn-style + micro-interaction libs (framer-motion).
- God has full filesystem authority; may delete unnecessary files and improve logic.
- Autonomy: human is asleep; work should proceed without intervention.
- Progress visible on this kanban (tasks.json).

**Env setup (done):** PostgreSQL 16.15 installed (dev+test DBs), backend `.env` created, backend booted on :3000, migrations+seed ran. Auth login/refresh verified working via API.

---

## Phase 0 — Foundation & Auth fix (DO FIRST — unblocks everything)
- Fix auth refresh bug (backend cookie path/domain/cleanup + frontend vite proxy + AuthProvider getter + apiClient token propagation).
- Add `.gitignore` (root + verify backend/frontend). Seed, if absent.
- Verify full auth flow end-to-end in a browser-less test; fix any Vite proxy/baseURL issues.
- Clean dead scaffolding files.

## Phase 1 — Reference data & admin UI
- Users / Roles / Permissions management screens.
- Picklists management screens (product types, colours, sizes, damage grades).
- Vendors management screen.
- Tailwind/shadcn design system foundation + AppShell nav for all these.

## Phase 2 — Intake workflow UI
- Trips (stock intakes) + Lots (lines) screens; wire the barcode scanner into intake scan.
- Units list + status/transition UI (needs backend transition routes first).

## Phase 3 — Sales / POS
- Backend: sales module (not implemented yet) — orders, lines, checkout, refunds/cancels (reversing rows).
- Frontend: POS screen (scan/determine items, cart, checkout, receipt).

## Phase 4 — Rentals
- Backend: rental agreements module (not implemented) — create agreement, rent per day, deposit, overdue, return, damage grading.
- Frontend: rental screens.

## Phase 5 — Expenses
- Backend: expenses module (not implemented).
- Frontend: expenses screens.

## Phase 6 — Dashboard & Reports
- Backend: dashboard aggregates + reports queries. (DONE — T-14 backend, /api/reports/*)
- Frontend: dashboard + reports screens. (DEFERRED TO VERY END by human)

---

# UI/UX REVAMP (Phase R — human-directed, 2026-09-03)

Human reviewed the webapp and asked for a **full UI/UX revamp**. Confirmed decisions:
- **Visual language:** Tailwind + shadcn-style, **light-mode only**. The existing custom-token warm-retail CSS (bmad DESIGN.md) is replaced as the *styling* layer by Tailwind/shadcn. (Money/status semantics from bmad still apply via tokens mapped into the Tailwind theme.)
- **Landing areas (role-gated):** Inventory management, POS, Dashboard, Expenses. Plus admin.
- **Inventory:** keep the bmad **separate Trips/Lots/Units** screens but **restyle** them, grouped under an "Inventory" section.
- **POS:** retail checkout + **switch to a rental mode** at the register; Rentals also keeps its **own dedicated section** (deposit/due-date/return workflow).
- **Nav:** regroup by **role** into labelled sections with icons (not a flat list). Admin = all; Inventory manager = inventory pages; Cashier = POS screens.
- **Role-gating:** pages shown/absent by permission; nav renders only what a role holds (AD-29).
- **Dashboard is LAST** — frontend dashboard/reports screens are deferred to the very end of the revamp (T-15).

## Revamp task plan
- **R-01 (Foundation):** Tailwind v4 + shadcn-style design system, light-only; role-grouped AppShell nav with sections/icons; rewrite `navigation.js`; migrate base `ui/` components; update affected tests. Land this first — unblocks all screen restyles.
- **R-02:** Restyle auth/SignIn + AppShell polish.
- **R-03:** Restyle admin screens (users/roles/perms/picklists/vendors).
- **R-04:** Restyle Inventory screens (Trips/Lots/Units/Scan) + Barcode print.
- **R-05:** Restyle POS (cart/checkout/receipt/sales) with rental-mode switch + Rentals screens.
- **R-06:** Restyle Expenses screen. (DONE)
- **R-07:** Inventory WORKFLOW REVAMP (Trips/TripDetail/LotForm/LotIntake/VendorDetail + Size-run). Human chose full rewrite, not just reskin. (DONE)
- **T-15 (LAST):** Frontend Dashboard + reports screens (deferred to very end per human). Backend T-14 ready. (DONE — worker-t15-dashboard, commit a76f9ee)
- **T-16:** Final QA (DONE — god). Backend 424 pass / 3 pre-existing auth.test fails; frontend 195/195 + build PASS; light-only; orphaned intake/* removed; all nav sections reachable + role-gated; R-07 Scan Primitive tests added (commit 8209d82). master @ 8209d82.

---
## T-16 QA — FINAL STATE (2026-09-03, god)
All revamp tasks R-01..R-07 + T-15 + T-16 are DONE and integrated on master (`8209d82`).
- Backend: 424 pass / 3 pre-existing auth.test failures (cookie Path + 2× requireSpaHeader X-Requested-With) — documented, NOT regressions.
- Frontend: 195/195 vitest + `npm run build` PASS.
- Light-only confirmed (theme.test asserts no dark tokens); orphaned `screens/intake/*` removed; AppShell stale `'/intake'` map fixed → `/trips`.
- Nav grouped + role-gated: Inventory (Trips/Vendors/Print labels), Counter (POS/Sales), Rentals, Expenses, Admin (Users/Roles/Permissions/Picklists), Dashboard. All reachable.
- Backend `app.js` mounts all modules; no dead imports.
- R-07 gap closed: added `lotIntake.test.jsx` covering the Scan Primitive (counter-on-save-not-decode, refusal re-arm w/o increment, lot-full close, colour/size prefill).

## SHIFT CLOSE (2026-09-03, god) — CLOSING TIME
Entire completion plan delivered. IMPOC backend + frontend fully built, revamped (R-01..R-07), dashboard (T-15), and QA (T-16) all DONE on master (`8209d82`). No workers on the floor; nothing in-flight, blocked, or unowned. Safe to close.

---

# UI/UX REVAMP 2 — minimals.cc design language (Phase M — human-directed, 2026-09-04)

Human asked to adapt the **minimals.cc** design language and make the app **mobile-first** (usable on both mobile + desktop). Human will supply a logo file; full name **SHREE Fashion Store** shown with logo on login + homescreen.

## M-01 Foundation (DONE, god)
- Design tokens (`frontend/src/index.css` @theme + :root): primary → minimals indigo `#2065D1` (hover `#1849A9`); neutral surfaces (`#F4F6F8` base, white raised); ink scale `#212B36/#637381/#919EAB`; borders `#E4E8EC/#C4CDD5`; refined radii. Semantic money/status tokens kept (meanings unchanged), tones shifted (`money-in #118D57`, `money-out #B71D36`, `money-held #6D5BD0`, focus-ring `#2065D1`).
- `theme.test.js` expectations updated to the new palette (was the intended consequence).
- New reusable `frontend/src/components/ShopLogo.jsx` (logo img + "SHREE Fashion Store"; falls back to monogram 'S' until a logo file is provided; export `SHOP_NAME`).
- `AppShell.jsx` rewritten **mobile-first**: bottom tab bar + compact brand header by default (<768px), desktop sidebar (logo pinned top) + top header (current page title + brand) at ≥768px (JS innerWidth-driven, tests preserve contract).
- `SignIn.jsx`: minimals clean centered card with logo + store name on top.
- `Dashboard.jsx`: shop logo added to header; KPI card polish.

## M-02 Screen-wide polish (DONE, god + 2 spawned sub-agents)
- Deleted hardcoded legacy colors across ~27 screens: 31× `bg-[rgba(179,38,30,0.1)]` → `bg-[var(--danger)]/10`; 18× `bg-white` → `bg-[var(--surface-raised)]`; `Button.jsx` danger hover → `hover:brightness-95`; `Card.jsx` bg-white → token; `admin.css` `.admin-error` → `color-mix(...)`.
- Structural: `SaleReceipt.jsx` → shared `Table` primitive (mobile overflow fix); `TripsScreen.jsx` hand-rolled modal → shared `Dialog`.
- Excluded by design: `LotIntake.jsx` (dark scan screen, whites/blacks intentional).
- Verified: frontend vitest **195/195 PASS**, `npm run build` PASS.

## M-01/M-02 STATUS — IN-FLIGHT / UNCOMMITTED
All M work is DONE + tested in the working tree but **NOT yet committed** (33 modified files + new `ShopLogo.jsx`). Awaiting: human to drop the logo file; god decides commit timing (won't commit unasked). No other agents on the floor; nothing blocked/unowned.

---
# SCHEMA V2 — full restructure (human-approved 2026-09-04)

Human confirmed the schema audit and approved the FULL rebuild. **Free hand: no backward-compat; DB/migrations/seeders get reset and rebuilt fresh** (system not yet in production).

**Canonical entity naming (finalized system-wide):**
- **Trip** (`trips`, was `stock_intakes`) — one dated buying outing.
- **Vendor** (`vendors`) — supplier bought from on a trip.
- **Stock** (`stocks`, was `stock_intake_lines`/"lot") — one product type, from one vendor, in one trip, with quantity + prices.
- **Unit** (`units`) — one physical piece (barcode).

**Relation:** Trip (1) → Vendors (N, via `trip_vendors` junction: per-vendor `bill_reference`/`total_paid`) → Stock (N per vendor) → Unit (N per stock). Every unit traces to exact stock / vendor / trip.

**Decisions folded in:**
1. Entity names = trip / vendor / stock / unit (confirmed).
2. Intake templates kept as **per-vendor buying templates** inside the Stock model.
3. Old `intake_records` screen FOLDED into Trips.
4. **customers** table: name, phone, email, DOB, address, consent flags (whatsapp/email/sms/whatsapp_group), consent_recorded_at. Captured on POS + rentals.
5. **Receipt renderer** — one source producing (a) 58/80mm printer format and (b) customer digital payload (self-contained JSON for future WhatsApp/email/SMS).
6. WhatsApp / SMTP / SMS infra → designed into `delivery_logs` (channel, status, provider tracking); integration itself deferred.

## Task plan (tickets in tasks.json)
- **T-17** backend restructure (schema V2, DB reset) — **DONE** + integrated, master merge `3ef2e90` (commit `b8f83db`). DB reset + 29 migrations + seed verified; backend suite 446 pass / 3 pre-existing auth fails; `/api/trips` live.
- **T-18** customers + delivery_logs + receipt renderer + customer linkage + reports analytics — **DONE** + integrated on master (merge `70741d0`, commit `4cd09b3`, + fixes `c2b6b32`/`f8fa581`/`251e02d`).
- **T-19** frontend rename + fold IntakeRecords into Trips + buying templates — **DONE**, worker-schema-v2-frontend, master `25b0b89` (build PASS, vitest 200/200), worker archived.
- **T-20** frontend customers + POS/rental capture + consent + receipts view — **DONE** + integrated, master merge `4088fe4` (commit `b85420a`). Build PASS + vitest 213/213.
- **T-21** god final QA + integration + DB reset verify + full suites — **DONE** (god), master `bb1eb08`. See below.

## Schema V2 status (2026-09-05 — FINAL, all complete)
- **T-17/T-19/T-20** integrated earlier (see task cards).
- **T-18 integrated + verified**: customers CRUD + consent, delivery_logs + `/api/delivery` (polymorphic, JSONB payload, provider ids), receipt renderer (`/api/receipts/preview` digital JSON + `/print` 58/80mm text), sales/rentals `customer_id` FK, reports analytics (`/trip-pnl`, `/vendor-sell-through`, `/stock-levels` + low-stock, `/margins`).
- **T-21 QA DONE (god)**: `db:refresh` (35 migrations) + fresh seed verified; full backend suite **479 pass / 3 pre-existing auth fails** (documented non-regressions); frontend vitest **213/213** + vite build PASS. Live E2E: multi-vendor trip → stock → scanned units → sale `S-0001` (2 units, Rs 1,000.00) → customer+consent → receipt (both formats) → delivery log → reports all correct. **Found + fixed one bug**: receipt store name fell back to `Munder Difflin` → now `SHREE Fashion Store` (commit `bb1eb08`, + `STORE_NAME/ADDRESS/PHONE` in `backend/.env`).
- QA fixture data present in dev DB (`QA Vendor`, `QA Trip 1`, `QA Customer`, sale `S-0001`, sample product-type/colour/size) — left in place as a live demo; run `npm run db:refresh` in `backend/` to wipe.
- master = `bb1eb08`. Working tree clean. All Schema V2 tasks done; no in-flight/blocked/unowned work.

# DARK-PRIMARY + AUDIT FIXES (Phase R-08, 2026-09-05 — DONE, COMMITTED)

Human directed the minimals theme further: **DARK-FIRST with gold #FAAF00 primary**. Committed `4e55c3a` (2026-09-06).

## R-08 revamp (DONE + verified in working tree)
- `frontend/src/index.css`: `:root` = dark minimals palette (canvas `#141A21`, raised `#1C252E`, sunken `#10151B`, gold `--primary/--accent #FAAF00` + `--primary-foreground #201604`, ink `#FFFFFF/#919EAB/#637381`, borders `#1C252E/#28323D`, dark-tuned statuses/money/feedback, focus-ring `#FAAF00`, Inter heading + Public Sans body); `html[data-theme='light']` light override keeps the gold brand; `html[data-theme='dark']` = root defaults; PRIMARY_PRESETS default → `#FAAF00`.
- `theme-config.js`: COLOR_SCHEMES Dark-first, `DEFAULT_SETTINGS.colorScheme = 'dark'`, FONT_PRESETS "(Public Sans + Inter)".
- `index.html`: pre-hydration FOUC script now defaults to **dark** and resolves `'system'` via `matchMedia`.
- SignIn "Restoring your session..." removed (session restore is instant).

## Audit fixes from 3 spawned review sub-agents (DONE + verified)
- **HIGH** — `ThemeProvider.jsx` runtime now re-applies `data-primary`/`data-font` on documentElement (was only setting `data-theme`; settings-drawer color/font controls had no effect until reload).
- **MEDIUM** — `auth.controller.js` logout/logoutAll now clear the refresh cookie with a `cookieClearOptions()` that mirrors path/domain/sameSite/secure of `cookieOptions()`.
- **MEDIUM** — `BarcodeScanner.css`: unscoped `body { background: #fff; position: fixed; ... }` → `var(--surface-base)` (this rule was white-outing the whole app body in dark mode; scoped `.barcode-scanner` white overlay left as-is).
- **LOW** — RouteGuard session-expired banner now themed (`--danger` color-mix, light/dark safe); SettingsDrawer System swatch renders the gradient + active Check uses `--primary-foreground`; StockIntake waking banner → `--accent`/`--accent-foreground`.

## Verification (all green, working tree)
- Backend auth suite **35/35** (Jest).
- Frontend vitest **217/217** (18 old files + new `themeRuntime.test.jsx` locking the runtime attribute sync).
- `npm run build` PASS; bundle verified: `body` uses `--surface-base`, FOUC script has matchMedia + data-primary/data-font, Inter woff2 present.

## R-08 status
DONE + COMMITTED (`4e55c3a`, 2026-09-06). Human approved; no longer in-flight.

---

# INVENTORY MODEL V2 (Phase R-V2 — human-directed, 2026-09-05)

Human re-described the inventory model: **Trip** (create with just name + date) → add **Vendors** (name, address, contact) under the trip → under each vendor add **Stocks** (multiple) → under each stock add **Units** (multiple, scanned). Nav tabs: **Trips, Vendors, Stocks, Units + Barcode generation**.

**Confirmed decisions (2026-09-05):**
- Stock & its template carry BOTH a **whole-stock** buying total AND a **per-unit** buying price; unit scan auto-fills buying price from the template's per-unit price.
- Template builds on the **type + subtype** picklist relation (two selects: parent type e.g. 'Sari', child subtype e.g. 'Paithani').
- **Standalone Units tab** listing all units (searchable), plus a standalone Stocks tab.

## Task plan (tickets in tasks.json)
- **R-09** backend schema V3 intake (subTypeId + whole/per-unit buying price on StockTemplate & Stock; bare GET /stocks + GET /units list endpoints; migration; tests) — **DONE** + integrated by god on master (commit `59dd31d`, ff-merge bb1eb08). Dev DB migration verified up; god added regression suite `backend/tests/intake/inventory-v2.test.js` (16 tests; full backend suite 495 pass / 3 pre-existing auth fails). Worktree auto-reclaimed.
- **R-10** frontend create-trip = name+date, then add vendors inline under trip (name/address/phone). **DONE** + integrated by god (ff-merge, master `b19420f`). TripsScreen name+date(+notes) dialog posting `{name, purchasedOn, notes, vendors:[]}`; TripDetailScreen Add-vendor dialog (existing searchable OR inline new vendor, per-vendor bill, DTO camelCase fix, 409/money errors in-dialog). Worker vitest 219/219 + build PASS; main-tree verify 223/223 (R-08+R-10 coexist). NOTE: R-08's local `TripDetailScreen.jsx` change (hooks fix) DROPPED at integration — fully subsumed by R-10's committed memoization.
- **R-11** frontend stock/template builder (type+subtype selects + whole/per-unit buying price; scan prefill). **DONE** + integrated by god (ff-merge, master `8e29673`). StockForm two-level Type/Subtype cascade + optional whole-stock price + template/clone prefill (subtype+whole); new TemplateForm at `/trips/:tripUuid/templates` (per-vendor list/PATCH/DELETE, 400s inline); StockIntake decoded card shows type/subtype. Worker vitest 229/229 + build PASS; main verify 233/233 + build PASS. StockIntake overlap with R-08 resolved via stash+pop (no conflict, R-08 styling preserved).
- **R-12** frontend nav tabs Trips/Vendors/Stocks/Units + Print labels; standalone Stocks & Units screens (bare GET /stocks + /units). **DONE** + integrated by god (ff-merge, master `c6eee10`). Inventory section = Trips, Vendors, Stocks, Units, Print labels; StocksScreen (trip/vendor/search filters, type/subtype via getProductTypes, N-of-M scanned, whole+per-unit buying, Scan + Units actions) + UnitsScreen (search/status/stockUuid, mono barcode, --status-* badges + legend, reads ?stockUuid=) + listAllStocks/listAllUnits wrappers + LIST_ALL/LIST routes. Worker vitest 240/240 + build PASS; main verify 244/244 (22 files) + build PASS. Zero R-08 overlap.
- **R-13** god integration + final QA (db:migrate, backend+frontend suites, live E2E scan prefill). **DONE** (god, 2026-09-05). Dev DB: 35 migrations all UP. Backend suite **498/498 PASS** (30 suites). Frontend vitest **244/244 PASS** (22 files) + vite build PASS. Live E2E full flow verified: login → picklists → trip (name+date) → vendor (name/address/phone) → attach vendor to trip → template (subtype + per-unit 25000 + whole 500000) → stock (buyingPricePaise from template) → scan 2 units (buying auto-filled from stock) → Units tab (status=stockName=vendorName correct) → Stocks tab (unitsScannedCount=2) → trip variance=0 (whole 500k - paid 500k). **R-V2 COMPLETE.**

BOW: backend first (R-09), then sequential frontend (R-10 → R-11 → R-12) to avoid shared-file conflicts (navigation.js/AppShell.jsx/routes.js/App.jsx); single frontend worker at a time.

## Status legend
- `todo` / `doing` / `blocked` / `done` tracked in tasks.json (kanban, who-did-what).

---

# CLOSING TIME (2026-09-05 ~15:05Z, god)
Human pressed closing time. Floor clear (only god live; all workers archived; 0 pending spawn; inbox drained). Master = `c6eee10`. All committed work (T-00..T-21, R-01..R-07, R-09..R-13) is DONE. Only open item: **R-08 dark-primary revamp** is done + verified in the working tree but UNCOMMITTED awaiting the human's commit go-ahead (17 files + `themeRuntime.test.jsx`). Logo file still pending at `frontend/public/shop-logo.png` (ShopLogo falls back to monogram 'S' until then).


---

# VENDOR-TO-TRIP POLISH (Phase R-V3 &mdash; human-reported UX gaps, 2026-09-05)

Human tested the app, flagged gaps in the Add-vendor-to-trip popup and the global dropdown UX:

1. **No receipt image upload** when adding a vendor to a trip. Wants a file input for the bill photo &rarr; convert to base64 &rarr; save to DB.
2. **Vanilla dropdowns everywhere** &mdash; wants a React dropdown lib with built-in search matching the UI/UX, used across the whole system.
3. **Merge Existing/New vendor tabs into ONE tab** &mdash; the dropdown lists existing vendors (searchable, excludes vendors already on the trip) and offers &quot;+ Create &lt;query&gt;&quot; inline for a new name.
4. **Auto-populate address** when an existing vendor is selected (new vendor enters it on first inline create).

Decisions (god): adopt **cmdk** (shadcn Command-style, React 19 OK, tiny, matches our shadcn-ish design system); receipt image stored as optional 	rip_vendors.receipt_image TEXT (base64 data-URI); bump express.json() body limit (~15mb) since 100kb default would reject base64 photos.

## Task plan (tickets in tasks.json)
- **R-14** backend: receipt-image support (migration 20260906000001, model, schema, service persist + DTO, app.js body-limit bump, tests). &rarr; **DONE, INTEGRATED** (master 3c312e7, fast-forward from c6eee10). Worker verified intake 115/115 + full backend 499 pass/3 fail (the 3 = pre-existing auth cookie tests, green only with uncommitted R-08 auth fixes at HEAD). God re-verified in MAIN: **502/502 PASS (30 suites, 0 failures)**; migration applied and recording `up 20260906000001-...` on dev DB. Worktree auto-reclaimed.
- **R-15** frontend: reusable ui/SearchableSelect combobox on cmdk + Add-vendor-to-trip dialog revamp (single tab, inline-create, address autofill, receipt upload + thumbnail). &rarr; **DONE, INTEGRATED** (rebase onto 3c312e7 + ff-merge, master **8eb8d62**). cmdk ^1.1.1 installed in main; package.json stash/fold dance because R-08 keeps it dirty (cmdk committed, R-08 inter line preserved). Full commit suite 242/242 (worktree) / 246 in MAIN incl. R-08 themeRuntime tests; tripsFlow 8/8; vite build PASS both. Worktree auto-reclaimed.
- **R-16** frontend: system-wide dropdown replacement with the new combobox. Exact scope = 13 vanilla ui/Select consumers: admin/ProductTypesManager, FlatPicklistManager, UserFormDialog, RolesScreen, UsersScreen, expenses/ExpensesScreen, inventory/StockForm, StockIntake, StocksScreen, TemplateForm, UnitsScreen, rentals/ReturnUnitsDialog, RentalsScreen. NOTE: StockIntake.jsx is also R-08-dirty in god's tree — combined merge handled at integration. First spawn attempt rejected (wrong schema: id/agentName/baseBranch + no cwd, mojibake) -> rewritten to proven schema (objective/cwd/name/command/isolate/character) -> accepted. &rarr; **DONE, INTEGRATED on master 2553a28** (2026-09-06). Original worker (worker-vendor-combobox-r16) reaped mid-work by the CLOSING-TIME window leaving 11/13 converted + 12 failing tests; finish worker **worker-r16-finish** (isolate:false in the preserved worktree) converted the last 2 rentals screens and rewrote all 12 failing tests to drive SearchableSelect (click trigger -> search -> option row; content assertions, never .value; async findByLabelText for conditionally-rendered combos). **Zero `<Select>` consumers remain** (only the primitive ui/Select.jsx definition). Worktree verif + god re-verify: 242/242 + build PASS; MAIN: 246/246 + build PASS. StockForm vendor/type/subtype, TripDetail add-vendor (already had it), StockIntake colour/size, all admin/expenses/rentals filters — everything searchable combobox.

Parallel: R-14 (backend) + R-15 (frontend) run concurrently &mdash; disjoint files. R-16 follows R-15 integration. R-08 dark-primary batch still uncommitted (human go-ahead pending) &mdash; R-15/R-16 workers build on committed master c6eee10 and use only ar(--...) tokens (palette-agnostic).

---

# UI BUG FIXES (Phase R-V4 --- human-reported UX regressions, 2026-09-06)

Human tested after R-16 integrated and reported 3 UI bugs:

1. **Combobox takes layout space instead of overlapping** --- opening a SearchableSelect pushes the labels/fields below it downward (popover renders in normal flow) instead of overlaying them. Needs: popover absolutely positioned over page content + option list capped (max-height, scroll inside) when many options.
2. **Add-stock vendor dropdown is empty** --- StockForm reads `trip?.trip_vendors` (nested `{ vendor: { uuid, name } }`) but the backend DTO emits `vendors` as flat `mapTripVendorDTO` objects (`uuid`/`vendorUuid`/`vendorName`) --- options never render. Needs dual-shape consumption; selected value must be the REAL vendor UUID (createStock uses it as vendorUuid).
3. **Tall modals clip header/footer/buttons** --- Dialog panel has no max-height/overflow. Needs capped panel (max-h ~85vh) with scrollable body + pinned header/footer.

## Task plan (tickets in tasks.json)
- **R-17** frontend: all 3 fixes. --- **DISPATCHED 2026-09-06** to worker **worker-ui-bugs-r17** (isolated worktree `worktrees/worker-ui-bugs-r17` on `agent/worker-ui-bugs-r17`, base master `2553a28`). God pre-diagnosed root causes: (1) SearchableSelect.jsx renders the open popover as an in-flow sibling (`relative z-30` after the trigger in the flex-col root); (2) trip.service.js `mapTripDTO` sets `dto.vendors` flat vs StockForm expecting nested `trip_vendors`; (3) Dialog.jsx un-capped `fixed p-6` panel. Contract = BUG 1 (absolute-overlay popover under trigger + max-height/overflow-y-auto list), BUG 2 (defensive `vendors ?? trip_vendors` + real-vendor-UUID value + stockForm.test.jsx mock updated to real shape), BUG 3 (flex-col max-h-[85vh] scrollable body, pinned header/footer). &rarr; **DONE, INTEGRATED on master 32c8706** (2026-09-06). worker-ui-bugs-r17 delivered all 3 fixes: SearchableSelect popover now `absolute left-0 right-0 top-full z-50 mt-1` inside a `relative` trigger wrapper (overlays page content, list stays `max-h-60 overflow-y-auto`; rootRef spans trigger+popover so outside/Escape close intact; props + cmdk structure untouched); StockForm consumes `trip?.vendors ?? trip?.trip_vendors` via `mapTripVendor(tv)` (value = real vendor UUID, label = vendorName||vendor?.name) with single-vendor autofill on the helper; Dialog panel `flex max-h-[85vh] flex-col` with `shrink-0` pinned header/footer + `min-h-0 flex-1 overflow-y-auto` scrollable body (framer/portal/Escape unchanged). New coverage: SearchableSelect.test.jsx (5 tests) + Dialog.test.jsx (2 tests); stockForm.test.jsx TRIP mock updated to real `vendors` shape. Worktree verify 249/249 + build PASS (worker) === god re-verify 249/249 + build PASS; MAIN 253/253 (24 files) + build PASS. Clean ff-merge (files disjoint from R-08 dirty set); worktree + branch removed. Baseline 242 vitest in worktree; frontend only, uncommitted (god integrates), var(--...) tokens only, no R-08 files. Parallel with the R-08 batch still parked (human commit go-ahead pending). WORKER OBSERVATION (next tasks): TripsScreen/VendorDetail/VendorsScreen also read `trip.trip_vendors` but from DIFFERENT endpoints (trips LIST DTO → `vendorSummary` flat; vendor history nests stocks with `tripVendorUuid`) — needs its own reconciliation task, NOT the R-17 dual-shape pattern.

---

# ADD-STOCK 400 (Phase R-V5 --- human-reported API error, 2026-09-06)

Human reported: adding stock fails with \POST /api/trips/:tripUuid/stocks 400 (Bad Request)\ in the console (fired from tripsApi.js:176). The \eportAllChanges startTime\ TypeError in the same console is unrelated web-vitals noise.

## Root cause (god, verified live against :3000)
Backend zod \createStockSchema\ (backend/src/modules/intake/stock.validation.js:4-8) **requires \	ripUuid\ in the request BODY**. But frontend \createStock(tripUuid, payload)\ (frontend/src/services/tripsApi.js ~line 176) posts only \payload\, putting tripUuid **only in the URL path** (STOCK_ROUTES.CREATE = \/trips/:tripUuid/stocks\). \stock.controller.js\ does \createStockSchema.parse(req.body)\, so every UI submission 400s with \Invalid input: expected string, received undefined\ on field \	ripUuid\. Reproduced: POST without body tripUuid -> 400; with it -> 201.
- This was broken for the React UI since Schema V2 (backend b8f83db). R-13 E2E passed only because god called the API directly with tripUuid in the body. It surfaced only now because R-17 fixed the previously-EMPTY vendor dropdown - the user can finally submit add-stock.

## Task plan (tickets in tasks.json)
- **R-18** frontend: \createStock\ sends \{ ...payload, tripUuid }\ in the body + NEW \rontend/src/services/__tests__/tripsApi.test.js\ regression test (mock apiClient, assert body includes tripUuid + passthrough of all original payload fields). Worker: **worker-stock-create-400-r18** (kevin, isolate:true, worktrees/worker-stock-create-400-r18 on agent/worker-stock-create-400-r18, base master 32c8706, baseline 242 vitest). FRONTEND ONLY; uncommitted (god integrates); no R-08 files.


- **R-18** frontend: add-stock 400 fix (createStock sends tripUuid in body). &rarr; **DONE, INTEGRATED on master 00a7fba** (2026-09-06, ff from 32c8706). Worker **worker-stock-create-400-r18** (kevin, isolate:true) delivered: 	ripsApi.js createStock now posts { ...payload, tripUuid } (+ JSDoc) and NEW rontend/src/services/__tests__/tripsApi.test.js (2 tests per BarcodePrintScreen apiClient-mock convention). Worktree verify: 251/251 vitest (249 baseline + 2 new) + build PASS; god re-verify MAIN: **255/255** + build PASS. Live 201 confirmed against :3000 (left a stock row in dev DB; no DELETE route). Clean ff-merge (only tripsApi.js + new test; R-08 dirty set untouched); worktree removed + pruned, branch deleted. Frontend only, uncommitted (god integrated). The \eportAllChanges startTime\ TypeError in the console is unrelated web-vitals plugin noise.

---

# STOCK SCAN 404 (Phase R-V6 --- human-reported route 404, 2026-09-06)

Human reported: after saving a stock and clicking "Start scanning", the StockIntake screen mount fires `GET /api/stocks/09c9490e-c50b-45cd-9054-477717f0114e` -> 404 (Not Found) from tripsApi.js:158.

## Root cause (god, verified by reading backend mounts + controller + tests)
The 404 is a frontend/backend **route contract mismatch** (same latent class as R-18; exposed only now that R-18 let add-stock succeed and reach the scan screenmount).

- Backend mounts the stock router **NESTED**: `backend/src/app.js:69` `app.use('/api/trips/:tripUuid/stocks', stockRoutes)`. Single-stock GET (`getStockByUuid`) and scan (`scanIntoStock`) live ONLY there (`GET /:uuid`, `POST /:uuid/scan`), and both controllers verify trip access (`verifyTripAccess(tripUuid)`).
- The **bare** `/api/stocks` mount (`app.js:70`, `stockListRouter`) has ONLY `GET /` (listAllStocks).
- But frontend route constants are **BARE**: `STOCK_ROUTES.GET(uuid)` = `/stocks/:uuid` and `STOCK_ROUTES.SCAN(uuid)` = `/stocks/:uuid/scan` (frontend/src/platform/routes.js ~line 38), called by `getStock(uuid)` / `scanBarcodeIntoStock(stockUuid, {...})` (tripsApi.js ~156/214). So the frontend hits `/api/stocks/:uuid`, which does NOT exist -> Express 404.
- All backend tests (stocks.test.js:504 `GET /trips/:tripUuid/stocks/:uuid`; units/sales/rentals scan tests) use the NESTED path. R-13 E2E passed because it used it directly. Broken for the React UI since Schema V2.

## Task plan (tickets in tasks.json)
- **R-19** frontend: make `STOCK_ROUTES.GET/SCAN` trip-scoped `(tripUuid, uuid)` mirroring LIST/CREATE/UPDATE; `getStock(tripUuid, uuid)` + `scanBarcodeIntoStock(tripUuid, stockUuid, {...})`; StockIntake.jsx call sites (~56/65/147) pass `tripUuid` from useParams (App route `/trips/:tripUuid/stocks/:stockUuid/scan`); update routes.test.js GET+SCAN + stockIntake.test.jsx mock + `toHaveBeenCalledWith('t1','S1',{...})`; add tripsApi.test.js regression for both nested calls. Worker: **worker-stock-scan-404-r19** (kevin, isolate:true, worktrees/worker-stock-scan-404-r19 on agent/worker-stock-scan-404-r19, base master 00a7fba, baseline 255 vitest). FRONTEND ONLY; uncommitted (god integrates); no R-08 files.


- **R-19** frontend: "Start scanning" 404 fix (trip-scoped STOCK_ROUTES.GET/SCAN). &rarr; **DONE, INTEGRATED on master 87b1339** (2026-09-06, ff from 00a7fba). Worker **worker-stock-scan-404-r19** (kevin, isolate:true) delivered: STOCK_ROUTES.GET/SCAN now (tripUuid, uuid) => /trips/{tripUuid}/stocks/{uuid} and /trips/{tripUuid}/stocks/{uuid}/scan (encodeURIComponent both, JSDoc updated; LIST/CREATE/UPDATE untouched); tripsApi.getStock/scanBarcodeIntoStock signatures + call nested routes; StockIntake call sites pass tripUuid from useParams (deps now [tripUuid, stockUuid]); routes.test.js GET+SCAN assertions nested + both-param encode; stockIntake.test.jsx mock + toHaveBeenCalledWith('t1','S1',{barcode,colourUuid,sizeUuid}); tripsApi.test.js +2 regression tests (exact route + exact body). Worktree verify 253/253 vitest + build PASS === god re-verify 253/253 + build PASS. GOD LIVE PROOF against :3000: GET /api/stocks/09c9490e-c50b-45cd-9054-477717f0114e -> 404 (the user'"'"'s exact error), GET /api/trips/6082e02e-e0ec-4e8c-8821-70c8a35cc7f8/stocks/09c9490e-c50b-45cd-9054-477717f0114e -> 200 with the stock DTO (StockIntake now uses this path). MAIN re-verify: **257/257** (25 files, 255 baseline + 2 new) + build PASS (pre-existing chunk warning only). Merge used the R-08 stash/pop trick (StockIntake.jsx present in both dirty sets; hunks disjoint lines 53-147 R-19 vs 327-435 R-08, restored clean; ThemeProvider.jsx + theme-config.js stash CRLF warnings benign). Worktree removed + pruned; branch deleted. R-08 batch intact, still awaiting human commit go-ahead. Frontend only, uncommitted (god integrated).

---&mdash;

# UI POLISH BATCH — NAMES-ONLY + SCAN-NEXT + POS NAMES (Phase R-V7, 2026-09-06 — DONE, COMMITTED)

Human reported (while testing after R-16..R-19): product ids/uuids appear in the UI, the stock-intake flow closes prematurely after the 2nd unit of a 3-unit stock, and the POS cart/toast shows barcode instead of a product name. All direct god work, verified in the working tree, committed `4e55c3a` (2026-09-06).

## R-21 work (DONE + verified in working tree)
1. **Names-only (no uuids in UI)** — backend `vendor.service.js` history query + DTO now add `stockName` (new `deriveStockName` helper), `subTypeUuid`, `colourName`, `sizeName` (legacy `colour`/`size` uuid keys kept for back-compat). `VendorDetail.jsx` StockBlock title + unit rows use names; `VendorsScreen.jsx` history Product column uses `stockName`; `StocksScreen.jsx` removes uuid prefixes (`fallbackName` → generic 'Type'/'Subtype'/'—', `tripLabel` = `trip.name || 'Trip <date>'` used in both dropdown + row chip); `UnitsScreen.jsx` stock filter is now a `SearchableSelect` of names (via `listAllStocks` + `getProductTypes`).
2. **StockIntake scan-next** — off-by-one fixed (`post-refresh unitsScannedCount`, guarded by `quantity > 0`) so 3-unit stocks no longer close after the 2nd unit; IDLE state shows "Unit saved — scan the next one." + **Scan next unit** button when `scannedCount > 0`, else "Tap to arm the camera" + "Scan barcode".
3. **POS product names** — `units.service.js` `mapUnitDTO` + `getUnitByBarcode` add `stockName`/`colourName`/`sizeName`; `POSScreen.jsx` cart row shows product name first, barcode · colour · size below; toast names the product (fallback `Item <barcode>`).

## Verification (all green)
- Frontend vitest **258/258 PASS** (25 files); backend **vendors 53/53, intake+vendors 168/168, units+barcode 31/31**; eslint only pre-existing noise.
- `stocksUnits.test.jsx` updated to name-based fixtures/assertions; `posIntake.test.jsx` updated + new barcode-fallback test.
- tasks.json R-21 added (doing, god, uncommitted).

## R-21 status
DONE + COMMITTED (`4e55c3a`, 2026-09-06). Human approved the accumulated working-tree batch. No other agents on the floor; nothing blocked/unowned.

---

# POS/CUSTOMER + PAYMENT METHODS (Phase R-V8, 2026-09-06 — DONE, COMMITTED)

Human-reported POS gaps (customer shown as blank after inline-create; phone/email not searchable; no payment-method choice; receipts missing customer/contact + payment info). All direct god work, verified in the working tree, committed `4e55c3a` (2026-09-06).

## R-22 work (DONE + verified in working tree)
1. **Customer picker display + search** — backend `customers.service.js` search `Op.or` now includes `email` (name/phone/email); frontend `customersApi.js` unwrap fixed (`data.customers[]` on lists, `data.customer` on create/get/update/consent) so an inline-created customer appears in the input with its name (was rendering blank — the wrapper has no `name`); `CustomerPicker.jsx` placeholder "Search by name, phone, or email…", rows + selected chip show **phone + email**. **Dropdown no longer auto-opens on page load** (human: "customer drop down is initially opened, but it should only open when specifically clicked on input") — the mount-time debounced `runSearch('')` was calling `setOpen(true)`; added a `touched` flag (set on input focus/change), debounce is skipped until touched, and `runSearch` no longer force-opens. New regression test: closed on mount + opens after focus.
2. **Payment-methods picklist** — new `payment_methods` table + Cash/UPI seed (migration `20260906000002`, partial unique index on active names — deactivated names reusable), module mounted at `/api/picklists/payment-methods` (POST/PATCH gated `INVENTORY.CREATE/UPDATE`, GET auth-only); migration `20260906000003` adds `sales.payment_method` + `rental_agreements.payment_method` (VARCHAR(50) name snapshot); model/validation/service/controller/DTO wiring in sales + rentals; frontend `picklistsApi.getPaymentMethods()` + Admin "Payment methods" tab; POS payment-method `Select` defaults **Cash** (falls back to first method if Cash absent), sent in sale AND rental payloads, reset on clearCart + post-checkout.
3. **Receipts customer + payment info** — `receipts.service.js` customer block falls back to `customerName`/`customerMobile` snapshot when no linked customer; SALE+RENTAL receipt payloads + text receipt include `paymentMethod` ("Payment · …"); `SaleReceipt` customer phone fallback + payment line, POS rental receipt block, `ReceiptPreview` Payment row.
4. **POS camera barcode scan** — (human: "no button or way to open camera to scan the barcode on POS screen") add-item card gets a **"Scan barcode with camera"** button opening a `Dialog` that mounts `BarcodeScanner` (mounted only on demand, so the camera doesn't auto-start on page load); a detected barcode routes into the same `addByBarcode` handler as the text field (same rental/sellable + toast logic), then the dialog auto-closes. `posIntake.test.jsx` adds a `vi.mock` for BarcodeScanner + a scanner test (open → scan → cart row + total, dialog closed).
5. **Custom Select standard** — (human: "for the payment method don't use simple select… every select element should be the custom select") `ui/Select.jsx` REWRITTEN from the native `<select>` wrapper into the cmdk custom combobox (was `SearchableSelect`); `ui/SearchableSelect.jsx` is now just a re-export alias of `Select` — **one** custom-select implementation, `Select` is the standard for all present + future selects. POS payment-method now uses it (options/value/onChange API, no `<option>`), `data-testid pos-payment-method` preserved.
6. **Customer-source picklist** — (human: "POS should ask if they came via instagram, whatsapp group posts, or pamphlet") new `customer_sources` table + seed **Instagram / WhatsApp group / Pamphlet / Word of mouth / Walk-in / Other** (migration `20260906000004`, same partial-unique pattern as payment_methods), module mounted at `/api/picklists/customer-sources` (+13-test suite), migration `20260906000005` adds `sales.customer_source` + `rental_agreements.customer_source` (VARCHAR(50) snapshot); Sale + RentalAgreement models, sales/rentals validation/service/controller/DTO carry `customerSource`; frontend `picklistsApi.getCustomerSources()` + Admin "Customer sources" tab; POS checkout card adds a **"How did the customer hear about us?"** custom Select (optional — includes a "Not selected / Walk-in" option to clear), sent as `customerSource` in sale + rental payloads, reset on clearCart + post-checkout.

## Verification (all green)
- Backend **529/529** full suite (new `backend/tests/customer-sources/` 13/13 + sales `customerSource:'Instagram'` assert + rentals `customerSource:'WhatsApp group'` assert).
- Frontend **261/261** full suite (posIntake: picklists mock += `getCustomerSources`, custom-select no-vanilla-combobox assert, new customer-source checkout test; `/customer/i` label queries tightened to `/^customer$/i` because the new select label contains "customer").
- eslint: only pre-existing `React` unused false-positives (must keep `import React` for vitest classic runtime).
- vite build PASS (pre-existing chunk-size warning only).

## R-22 status
DONE + COMMITTED (`4e55c3a`, 2026-09-06). **Dev DB migrations `20260906000002`–`_05` APPLIED this session** (payment_methods + customer_sources + column snapshots; fixed the live `/api/picklists/payment-methods 500` the human hit). No other agents on the floor; nothing blocked/unowned. Standup 2026-09-06T06:40Z + 07:40Z filed to `.done/`.
---

# SHIFT CLOSE (2026-09-06 ~08:33Z)

Floor safe to close: only god live, all workers archived, no pending spawn requests, inbox drained. Master = `4e55c3a` (all tasks T-00..T-22 + R-01..R-22 done + committed). Working tree clean except untracked human design assets (`colors.zip`, `colors/`, `frontend/doc/`). Backend 529/529, frontend 261/261 + build PASS. CLOSING-TIME-COMPLETE sent to human.

---

# NAV COLLAPSIBLE + FOCUS BORDER WIDTH (2026-09-06 â€” PARKED AT CLOSING TIME, NOT STARTED)

Human requested live in chat just before closing time was pressed (2026-09-06): (1) make the AppShell desktop NAV **sections collapsible** (Inventory / POS / Counter / Rentals / Expenses / Admin / Dashboard); (2) if a CSS variable exists for **border width**, reduce it â€” the current after-focus border/outline highlight is too strong; reduce only the post-focus outlines.

## Next steps (resume at next opening)
- `frontend/src/app/AppShell.jsx`: make `railSection` collapsible â€” section header becomes a toggle button (chevron rotate; `aria-expanded`); body `space-y-0.5` animates/mounts; persist open state (e.g. `localStorage` key) so refresh keeps collapse state; keep role-gating intact.
- Focus-ring width: today it's Tailwind utilities `focus-visible:ring-2 ... ring-offset-2 ... ring-[var(--focus-ring)]` used in AppShell nav buttons + shared Button component â€” NO dedicated border-width CSS variable exists; the ask is "reduce the after-focus border outlines only": lower `ring-2 ring-offset-2` -> `ring-1 ring-offset-1` (keep resting `border` untouched). If a `--border-width` token is preferred, add one in `index.css` `:root` and drive those utilities from it.
- Files: `frontend/src/app/AppShell.jsx`, `frontend/src/components/ui/Button.jsx`, `frontend/src/index.css` (+ optional new token), AppShell test checks.
- Verify: `npx vitest run` (frontend; 261 baseline) + `npx vite build` PASS; eslint only pre-existing React-unused noise. Backend untouched.
- Repo is clean on master `4e55c3a` (batch R-08/R-20/R-21/R-22 committed); only untracked artifacts remain: `colors.zip`, `colors/`, `frontend/doc/` (intentionally NOT committed â€” design/palette reference files).

---

# SECURITY & VULNERABILITY REVIEW (Phase R-V9, 2026-09-07 â€” MD-FRAMEWORK FIRST LIVE TEST)

Human: "run the security and vulnerability finding agent and use related skill and flag any issues found in our system based on criticality" â€” before the md-framework branch goes live.

## Approach
- **Agent**: `security-lead` (Dwight persona, md-framework/agents/security/security-lead.md) â€” the vulnerability-finding owner: hunts broken object-level authorisation explicitly, treats money/stock as crown jewels, rates by exploitability x impact, escalates CRITICALs to god immediately, issues a verdict.
- **Worker**: `worker-security-lead-r23` (spawn security-lead-r23.json, isolate:true, worktree on framework/md-impoc cf8b468 â€” contains BOTH the app code and `md-framework/` skills). Consumes the framework's security skills: owasp-top-10, owasp-api-top-10, authentication-security, authorization-security, session-security, secrets-detection, attack-surface-analysis, trust-boundaries, security-verification, threat-modeling, secure-code-review, injection, sql-injection, xss, csrf, input-validation, output-encoding, insecure-deserialization, project-permissions.
- **Scope**: READ-ONLY review of `backend/` + `frontend/` app code (NOT md-framework = the library under test; NOT colors/ frontend/doc/ node_modules) + `npm audit` (prod + dev) in both trees. NO code changes.
- **Deliverable**: `SECURITY-FINDINGS.md` at worktree root â€” every finding with ID + CRITICALITY (Critical/High/Medium/Low/Hardening), file:line, how it is reached / what it yields / what stops it, OWASP ref, fix; summary table by severity; verdict (PASS / PASS WITH CONDITIONS / BLOCK). CRITICALs escalated to god via `inform` before completion. `done` message with verdict + counts + top findings.
- **Tickets**: tasks.json **R-23** (doing, worker-security-lead-r23). God verifies after done; findings stay uncommitted pending human review.

## Status
**DONE (2026-09-07). Verdict: BLOCK.** worker-security-lead-r23 delivered `SECURITY-FINDINGS.md` (worktree root; copy preserved at `hive/SECURITY-FINDINGS.md`), escalated the 3 Criticals to god via `inform` before completing, sent `done`, and the harness preserved its worktree for integration (worktree dirty = report only, 0 commits ahead; worker read-only contract honored perfectly).

### Findings summary (per criticality)
| Severity | Count | Headlines |
|---|---|---|
| **Critical** | 3 | CR-1 double refund/void/expense-cancel TOCTOU (no CAS, replay inserts duplicate reversal rows => ledger money loss); CR-2 MANAGER->ADMIN privilege escalation via seeded `users.update` + unguarded role-assignment routes (assign admin role / strip admin / suspend admin => total takeover + DoS); CR-3 forgeable JWTs (session never bound to `payload.sub` + `algorithms` not pinned + `.env.example` ships placeholder secret => impersonate any user incl. admin with one signed token) |
| **High** | 10 | H-1 no login rate-limit/lockout; H-2 IDOR cost-book leak (12 GET routes auth-only, not `authorize(INVENTORY.VIEW)`); H-3 `users.update/create` hit admin users, arbitrary privileged roles; H-4 `verifyTripAccess` is a stub + scan ignores trip boundary; H-5 receipts expose any transaction + customer PII by uuid (REPORTS.VIEW gate only); H-6 empty item sells first unit; H-7 int8(BIGINT paise)->Number silently corrupts money >2^53; H-8 access JWT in localStorage (XSS-exfiltratable); H-9 suspended user keeps live session/token; H-10 refresh cookie `secure` off outside prod + LAN-HTTP deployment |
| **Medium** | 10 | M-1 money zod ceiling = int8 max not MAX_SAFE_INTEGER; M-2 template money accepts float/no bound; M-3 no idempotency on money POSTs; M-4 doc-number races; M-5 `createdBy` never scopes reads; M-6 delivery logs arbitrary receiptPayload/entityUuid; M-7 4xx echoes internal rows; M-8 paymentMethod/customerSource free-form on ledger; M-9 react-router <7.18 (open redirect, dev deps); M-10 vitest <3.2.6 (CVSS 9.8 dev-only) |
| **Low** | 8 | L-1 login timing enumerates usernames; L-2 staff email/phone to `users.view`; L-3 internal customerId serialized into DTOs; L-4 committed dev creds `admin/password123` in postman/.env.example; L-5 wildcard iLike; L-6 `req.user.id` bare deref; L-7 error strings to UI; L-8 vite `host:true` binds 0.0.0.0 |
| **Hardening** | 5 | HN-1 no MFA/lockout/reset; HN-2 password policy min(8); HN-3 no helmet/CSP; HN-4 SEED_ADMIN_PASSWORD sample; HN-5 theme settings localStorage->data-* |

**Dependency audit:** backend 2 moderate (`uuid` via sequelize); frontend prod 2 moderate (`react-router` <7.18); frontend dev 1 critical (`vitest` <3.2.6, dev-only UI-server) + high.

**Verified positives (no findings):** Argon2id; zod at every boundary; no SQLi (only parameterized `sequelize.query`/one literal constant); no XSS sinks; no OS/command injection; CSRF structurally mitigated (bearer headers + `requireSpaHeader` on cookie-only routes); clean logout+session lifecycle; unit `transitionUnit` uses CAS (the pattern CR-1 must adopt); 5xx fully masked; CORS pinned to `FRONTEND_ORIGIN`; admin seeder hard-fails without `SEED_ADMIN_PASSWORD`.

**Remediation priority (from report):** CR-1 (CAS + reversal idempotency) -> CR-2 (role-assign permission + guards) -> CR-3 (bind session to sub, pin algorithms, enforce secret strength) -> H-2/H-4/H-5 (object-level authz on reads) -> H-6/H-7 -> H-1 (login rate limit), H-8/-9/-10 -> M -> Low/Hardening. Re-verify via `security-verifier`.

### Awaiting human decision
Findings uncommitted (kept out of the app branch on purpose). Whether/how to remediate (CRITICALs are money-loss + full-takeover) is the human's call. REPO BRANCH untouched (framework/md-impoc clean; worktree holds only the report).

### DECISION (2026-09-07): "cover everything Critical through Low, ignore the Hardening items (HN-*)"
- **31 finding cards created** in tasks.json, all `todo`/unassigned: `SEC-CR-1..3` (critical), `SEC-H-1..10` (high), `SEC-M-1..10` (medium), `SEC-L-1..8` (low). Each carries file:line + impact + fix from SECURITY-FINDINGS.md.
- **R-24** = umbrella card (`todo`, deps R-23), humanQA answered. Hardening HN-1..HN-5 NOT tracked (explicitly ignored).
- **NO work started** — cards are parked pending human go-ahead to dispatch. No workers on the floor, no commits (repo + worktree untouched except the report).
- Report of record: `hive/SECURITY-FINDINGS.md`.

---

# UI/UX IMPLEMENTATION REVIEW (Phase R-V10, 2026-09-07 - MD-FRAMEWORK AGENT TEST #2)

Human: spawn an agent that can check the current UI/UX implementation, find UI/UX misalignments, issues in flows, styling issues in UI components, and give suggestions on improving the UI workflow.

## Approach
- **Agent**: uiux-designer (Erin persona, md-framework/agents/uiux/uiux-designer.md) - flow/workflow/usability owner; plus the design-system-guardian lens (md-framework/agents/uiux/design-system-guardian.md) for token/component/accessibility styling checks. character erin.
- **Worker**: worker-uiux-review-r25 (spawn uiux-review-r25.json, isolate:true, worktree on framework/md-impoc cf8b468). Consumes md-framework/skills/uiux/* (user-flows, interaction-design, visual-hierarchy, ui-design, accessibility, usability-review, design-review, responsive-design) + skills/design-system/* (design-tokens, typography, color-system, spacing-system, component-consistency, component-library, design-system-audit) + loading-states.
- **Scope**: READ-ONLY review of frontend/src (+ index.html, vite.config), current committed state = post-R-08 dark-primary revamp. NOT backend, NOT md-framework (library under test), NOT node_modules/build artifacts. NO code changes.
- **Deliverable**: UIUX-FINDINGS.md at worktree root - findings with ID + PRIORITY, file:line, why it is wrong (archetype/rules reference), suggested fix/improvement; tap-count + flow review of the most frequent journeys; UI workflow improvement suggestions. done message to god with counts + top findings.
- **Tickets**: tasks.json R-25 (doing, worker-uiux-review-r25). God verifies after done; findings uncommitted pending human review (parallels R-23 pattern). No fix work started.

## Status
**DONE (2026-09-07). Verdict: 25 findings — 3 Critical, 8 High, 10 Medium, 4 Low.** worker-uiux-review-r25 delivered `UIUX-FINDINGS.md` (worktree root; copy preserved at `hive/UIUX-FINDINGS.md`), sent `done`, harness preserved worktree (dirty = report only, 0 commits ahead; read-only contract honored).

### Findings summary (per criticality)
| Severity | Count | Headlines |
|---|---|---|
| **Critical** | 3 | UX-C1 no post-login landing route (`/` falls through `*` catch-all → "Nothing here yet"; sign-out→sign-in always dumps there); UX-C2 POS total not the largest element (`text-lg`+`<strong>`, POSScreen.jsx:498-504) + money bypasses `.typography-money*` (no tabular-nums/right-align); UX-C3 rental return commits deposit/late/damage with NO pre-submit refund preview (blind money move, ReturnUnitsDialog/RentalsScreen.jsx:379) |
| **High** | 8 | UX-H1 sub-44px touch floor app-wide (Button sm=h-8/md=h-10 = library failure); UX-H2 money not tabular/right-aligned; UX-H3 inventory lists are stacked cards not `ui/Table` (no sticky header/frozen col/right-align numerics); UX-H4 status colour-alone (Trips/Vendor/TripDetail/Stocks); UX-H5 stock scan loop ~3-5 taps/unit no auto re-arm; UX-H6 bare `<button>`/`<div onClick>` bypass primitives → lost focus-visible + semantics; UX-H7 POS no barcode-lookup loading (double-scan race) + silent picklist-fetch failure; UX-H8 rental line unitStatus forced neutral badge |
| **Medium** | 10 | UX-M1 StockIntake save-failure dumps to IDLE discarding barcode/c/s; UX-M2 raw-hex leaks (SignIn/Dashboard/StockIntake) vs var(--danger)/10; UX-M3 Table stale sticky + no frozen col; UX-M4 OS window.confirm() for destructive deletes; UX-M5 "Clear cart" no confirm + receipt "New transaction" bottom-only; UX-M6 Expenses bare "Loading…" no skeleton; UX-M7 Dashboard tabs no role="tab"/aria-selected/arrow keys; UX-M8 consent chips ~20px no focus-visible/in-flight guard; UX-M9 scanner errors internal card only no accessible retry/stop; UX-M10 arbitrary text-[13px] vs semantic typography tokens |
| **Low** | 4 | UX-L1 inline style={{...}} padding; UX-L2 duplicate STOCK_FULL blocks + hover override; UX-L3 ReceiptPreview no sale?.lines guard; UX-L4 Cancel-in-ARMED wipes prefilled state no confirm |
| **Hardening** | n/a | (design-system/a11y notes folded into High/Medium; no separate hardening set) |

**Top journeys & tap counts:** POS scan→pay **1 tap / 4-5 typical** (excellent; fix UX-C2 total hierarchy + UX-H7 lookup loading); inventory intake 3-5 taps/unit (UX-H5 friction, ~3N unnecessary); rental check-out ~7-9, return 5-6/unit w/ blind commit (UX-C3); expense 4; admin picklist 5. Login → role landing broken (UX-C1).

**UI workflow improvements (sequenced):** P0 UX-C1 landing redirect → UX-C3 refund preview → UX-C2/H2 POS money typography; P1 UX-H1 44px at Button primitive then sweep → UX-H5 scan-loop cadence → UX-H3/M3 adopt Table for inventory → UX-H4 colour-pairing; P2 UX-H6/M4/M7 primitives + Dialog migration → UX-M2 raw-hex → UX-M6 skeletons → UX-H7/M5 POS feedback.

**Verified positives:** token layer clean single-source-of-truth (Tailwind v4 @theme + semantic vars, themeRuntime.test.jsx locks re-skin); POS has no spurious confirmations; status Badges colour-with-text in admin/rentals/customers; thorough permission gating absent-not-disabled; loading/empty/error states largely designed; ui/Select single standard dropdown.

### Awaiting human decision
Findings uncommitted (kept out of the app branch, parallel to R-23 SEC). Whether/how to remediate (UX-C1-C3 are UX blockers + a financial blind-commit) is the human's call. REPO BRANCH untouched (framework/md-impoc clean; worktree holds only the report). No fix work started; cards may be created (parallel SEC-CR*/H*/... pattern) pending human go-ahead.

### DECISION (2026-09-07): "create tasks for these; work on them later"
- **25 finding cards created** in tasks.json, all `todo`/unassigned: `UX-CR-1..3` (critical), `UX-H-1..8` (high), `UX-M-1..10` (medium), `UX-L-1..4` (low). Each carries file:line + why-wrong + fix from UIUX-FINDINGS.md.
- **R-26** = umbrella card (`todo`, deps R-25), humanQA answered ("cover everything Critical through Low; NOT started yet - cards parked").
- **NO work started** — cards parked pending human go-ahead. No workers, no commits (repo + worktree untouched except the report).
- Report of record: `hive/UIUX-FINDINGS.md`. Task total now 104 (SEC 31 + UX 25 + R-22..26 + backlog).

---

# CLOSING TIME (2026-09-06/07 shift end) - FLOOR SNAPSHOT

## Shift state
- **Workers on floor: NONE** (god only). worker-security-lead-r23 + worker-uiux-review-r25 both ended; worktrees preserved (dirty = report only, 0 commits ahead), spawn-requests clean, fleet = god healthy.
- **Inbox: empty** (this closing-time message processed; prior standup/escalation/done/worker-end all filed to .done/).
- **Shutdown protocol followed:** no broadcast (no workers to ack); board.md updated; memory.md shift summary appended; CLOSING-TIME-COMPLETE sent to human.

## Open threads (all PARKED, nothing in flight)
1. **Security remediation (SEC-*):** R-23 review DONE (BLOCK verdict). 31 cards SEC-CR-1..SEC-L-8 todo/unassigned in tasks.json, umbrella R-24 todo. Human: cover Critical..Low, ignore Hardening, work later. Report: hive/SECURITY-FINDINGS.md. Repo untouched.
2. **UI/UX remediation (UX-*):** R-25 review DONE (25 findings: 3C/8H/10M/4L). 25 cards UX-CR-1..UX-L-4 todo/unassigned, umbrella R-26 todo. Human: cover Critical..Low, work later. Report: hive/UIUX-FINDINGS.md. Repo untouched.
3. **Parked app work (pre-existing backlog):** AppShell nav collapsible + focus-ring width reduction (ring-2/offset-2 -> ring-1/offset-1) - notes held, not started. Other backlog cards in tasks.json.
4. **Deliverable locations:** hive/SECURITY-FINDINGS.md, hive/UIUX-FINDINGS.md (reports of record). Worktrees hold originals.

## Repo/repo safety
- Branch framework/md-impoc @ cf8b468 (main + md-framework vendored). Sync'd with origin. Worker branches agent/* (2) exist only as preserved worktrees, 0 commits ahead - safe to reclaim by god later.
- NO commits made, nothing staged/dirty in main worktree at C:\projects\IMPOC-main (verified clean). Codebase untouched by all agent activity this shift.

---

# Phase R-V11 (2026-09-08) - R-27 Node backend review + R-28 Postgres review (human-requested)

## Directive
Human asked god to spawn two agents: one to check the node code, one to check postgres - improve SECURITY, SPEED, EFFICIENCY of each.

## Dispatch (both LIVE, parallel - disjoint surfaces, isolated worktrees)
- **R-27 -> worker-node-code-review-r27** (backend-engineer, jim). Spawn accepted (log ts 1788835115860); objective delivered 02:38:36Z. Worktree worktrees/worker-node-code-review-r27 (base framework/md-impoc cf8b468).
- **R-28 -> worker-postgres-review-r28** (postgres-specialist, stanley). First spawn FAILED: 'Could not parse spawn-request postgres-review-r28.json - SyntaxError: Bad escaped character in JSON at position 5230' - single-backslash Windows paths in the objective broke JSON. Rewritten with forward slashes (C:/projects/IMPOC-main/...), ACCEPTED 02:40:51Z; objective delivered 02:40:51Z. Worktree worktrees/worker-postgres-review-r28.
- SPAWN-JSON LESSON (re-confirmed): ASCII-only, no BOM, NO single-backslash paths in any string - forward slashes only.
- Contract = spawn objective (full spec) + god/outbox/r27-cleared-to-proceed.json + r28-cleared-to-proceed.json. Breaker steer/constrain msgs to both = known false-positive loop detector; cleared via nudge.

## Scope & deliverables
- R-27: READ-ONLY review of backend/ only (NOT md-framework/node_modules/doc). Categories SECURITY | SPEED | EFFICIENCY. Findings BACKEND-REVIEW-FINDINGS.md, ids NOD-<n>, dup-mark prior SEC ids (DUPLICATE-SEC-<id>). npm audit + static checks OK; no tests/server/writes.
- R-28: READ-ONLY review of migrations/ + models/ + Sequelize query sites + LIVE deve DB impoc_dev (localhost:5432, read-only SELECT/EXPLAIN (ANALYZE, BUFFERS)/catalog only; NO DDL/DML/migrations; throwaway backend/pgprobe.mjs allowed then must delete). Categories SECURITY | QUERY-PERFORMANCE | SCHEMA-DATA-INTEGRITY | CONCURRENCY-TX | MIGRATIONS. Findings POSTGRES-REVIEW-FINDINGS.md, ids PG-<n>.

## Monitor / next
- tasks.json: R-27 + R-28 = doing (assignees above). Nothing blocked; .env note handled in contract.
- When done: god verifies reports at worktree roots, copies to hive/ (BACKEND-REVIEW-FINDINGS.md, POSTGRES-REVIEW-FINDINGS.md), REV53 card updates, relays verdicts to human. Remediation = human's call (same pattern as SEC/UX).

### R-27 DONE (2026-09-08 03:00Z) - worker-node-code-review-r27
- Deliverable BACKEND-REVIEW-FINDINGS.md verified + preserved at hive/BACKEND-REVIEW-FINDINGS.md. 33 findings = 1CRIT/6H/15M/11L. SECURITY 2 new (NOD-23 completed-sale re-date/backdate no audit; NOD-31 X-Powered-By) + 19 DUPLICATE-SEC CONFIRMED STILL PRESENT (prior 3C+10H all live). SPEED 17 incl NOD-1 CRITICAL N+1 checkout (40-60 round trips/10-item sale, one wide tx), NOD-3 full-table JS reports, NOD-6 event-loop-blocking barcode rasterize holding tx+conn. EFFICIENCY 14. npm audit 0/0/2 moderate clean. **Verdict: BLOCK** (all prior security blockers + new speed blockers).
- tasks.json R-27 -> done (assignee retained). Worktree preserved, 0 commits ahead - fully uncommitted per contract. Nothing merged to repo.
- Pending: R-28 postgres review still in progress (~80%, informed earlier).

### R-28 DONE (2026-09-08 03:06Z) - worker-postgres-review-r28
- Deliverable POSTGRES-REVIEW-FINDINGS.md verified + preserved at hive/POSTGRES-REVIEW-FINDINGS.md (23.6KB). 24 findings PG-1..PG-24. All probe scratch files deleted; worktree otherwise clean; 0 commits ahead.
- Verdict by category: SECURITY PASS-WITH-CONDITIONS; QUERY-PERFORMANCE FAIL; SCHEMA-DATA-INTEGRITY PASS-WITH-CONDITIONS; CONCURRENCY-TX FAIL (PG-1 refundSale double-refund CRITICAL, PG-2 cancelExpense double-cancel CRITICAL, nextSaleNumber/nextAgreementNumber MAX-race 500s, rental completion lost-update); MIGRATIONS PASS-WITH-CONDITIONS. **OVERALL: BLOCK until PG-1/PG-2 (double money-out) fixed** - fix = SELECT FOR UPDATE on parent + partial-unique backstop index, 409 on conflict.
- tasks.json R-28 -> done (assignee retained). Both R-27 + R-28 reviews COMPLETE; both reports preserved at hive/. Repo untouched (findings only, no code merged). Remediation = human's call.

---

# CLOSING TIME (2026-09-08) - FLOOR SNAPSHOT

## Shift state
- **Workers on floor: NONE** (god only). worker-node-code-review-r27 + worker-postgres-review-r28 both ended DONE; worktrees preserved (dirty = report only, 0 commits ahead); spawn-requests clean; fleet.json = god healthy only.
- **R-27 + R-28 COMPLETE (both BLOCK verdicts).** Reports preserved: hive/BACKEND-REVIEW-FINDINGS.md (33 findings: 1CRIT/6H/15M/11L; NOD-1 N+1 checkout CRIT, NOD-3 full-table reports, NOD-6 sync barcode rasterize, NOD-23 sale re-date gap, NOD-31 x-powered-by; SEC BLOCK - prior 3C+10H all confirmed present; audit clean 0/0/2) + hive/POSTGRES-REVIEW-FINDINGS.md (24 findings PG-1..PG-24; PG-1/BG-2 double money-out CRITICAL; PERF FAIL - full-table reports, ~25 unindexed FKs, no date indexes; CONCURRENCY FAIL; OVERALL BLOCK).
- **Inbox: empty** (closing-time request filed to .done/). Outbox: CLOSING-TIME-COMPLETE sent to human.
- **Key cross-cut:** money-out race family flagged by 3 independent reviews (SEC-CR-1, NOD-*, PG-1/2) - remediate AS ONE coordinated fix (FOR UPDATE + partial-unique backstop + 409). No NOD-*/PG-* finding cards created yet (pending human GO, mirroring SEC/UX pattern).

## Open threads (all PARKED, nothing in flight)
1. **Security remediation (SEC-*):** 31 cards todo, umbrella R-24 todo. BLOCK. hive/SECURITY-FINDINGS.md.
2. **UI/UX remediation (UX-*):** 25 cards todo, umbrella R-26 todo. 25 findings (3C/8H/10M/4L). hive/UIUX-FINDINGS.md.
3. **Backend review remediation (R-27/NOD-*):** report preserved; 33 findings (NOD ids). No fix cards yet.
4. **Postgres review remediation (R-28/PG-*):** report preserved; 24 findings (PG ids). No fix cards yet. PG-1/PG-2 double-refund/cancel = highest priority money-out.
5. **Parked backlog:** AppShell nav collapsible + focus-ring width; other backlog cards in tasks.json.

## Repo/repo safety
- Branch framework/md-impoc @ cf8b468. Worker branches agent/* (2) = preserved worktrees only, 0 commits ahead, safe. NO commits made by any agent this shift; codebase untouched (reviews are find-only). Reports held at hive/ (uncommitted).
- Main worktree at C:\projects\IMPOC-main clean except untracked human design assets (colors.zip, colors/, frontend/doc/) + tunnels.json + worktrees/ (gitignored harness state).

---

# CLOSING TIME (2026-09-08 ~15:5xZ) - FLOOR SNAPSHOT (re-confirmed)

## Shift state
- **Workers on floor: NONE** (god only). All workers archived; spawn-requests clean (only .done/.failed); fleet = god healthy.
- **R-27 + R-28 COMPLETE (both BLOCK).** Reports preserved: hive/BACKEND-REVIEW-FINDINGS.md (33 findings, 1CRIT/6H/15M/11L; NOD-1 N+1 checkout CRIT, NOD-3 full-table reports, NOD-23 sale re-date gap, etc.) + hive/POSTGRES-REVIEW-FINDINGS.md (24 findings PG-1..24; PG-1/PG-2 double money-out CRITICAL; QUERY-PERF FAIL; CONCURRENCY FAIL; OVERALL BLOCK). Cross-cut: money-out race family (SEC-CR-1 + NOD + PG-1/2) = one coordinated fix (FOR UPDATE + partial-unique backstop + 409).
- **Inbox: empty** (standup + CLOSING-TIME processed, filed to .done/). **Outbox:** CLOSING-TIME-COMPLETE sent to human.

## Open threads (all PARKED, nothing in flight)
1. Security remediation: 31 cards (SEC-CR-1..SEC-L-8) todo, umbrella R-24 todo. hive/SECURITY-FINDINGS.md.
2. UI/UX remediation: 25 cards (UX-CR-1..UX-L-4) todo, umbrella R-26 todo. hive/UIUX-FINDINGS.md.
3. Backend review remediation (R-27/NOD-*): report preserved; no fix cards yet.
4. Postgres review remediation (R-28/PG-*): report preserved; no fix cards yet. PG-1/PG-2 highest priority money-out.
5. Parked backlog: AppShell nav collapsible + focus-ring width reduction.

## Repo safety
- Branch framework/md-impoc @ cf8b468 (sync'd with origin). Main worktree clean except untracked human design assets (colors.zip, colors/, frontend/doc/) + tunnels.json + worktrees/ (gitignored harness state). No commits this session; codebase untouched (reviews are find-only; reports at hive/).

---

# REMEDIATION START - MONEY-OUT RACE (Phase R-V12, 2026-09-08, human-directed)

Human: "we are going to work on the tickets, the UI/UX will be at last." Chose: **start with the money-out race critical first** (SEC-CR-1 + PG-1/2 + NOD double-refund as ONE coordinated fix). UI/UX (R-26/UX-*) deferred to last.

## The coordinated money-out fix (single backend worker, R-29)
Covers ALL 7 race paths independently flagged by the 3 reviews (SEC-R-23, PG-R-28, NOD-R-27):
1. refundSale double-refund - sales.service.js:315-361
2. cancelSale double-cancel - sales.service.js:238-309
3. cancelExpense double-cancel - expenses.service.js:114-156
4. processRentalReturn duplicate return (double deposit refund) - rental-agreement.service.js:340-485
5. cancelRental double-cancel - rental-agreement.service.js:492-562
6. nextSaleNumber read-MAX race - sales.service.js:30-39 (collision 500)
7. nextAgreementNumber read-MAX race - rental-agreement.service.js:44-53

**Fix pattern:** CAS on parent status (conditional UPDATE WHERE status = expected FROM; 0 rows -> 409; mirror units.service.js:392-406 transitionUnit) + partial unique backstop indexes (new migration + Sequelize model indexes[] so test-DB sync honors them, RequestKey.js:60-68 precedent) + 409 on index conflict + next-number generation under FOR UPDATE / retry-on-conflict. Keep reversal rows append-only (never mutate originals).

**Tests:** concurrency race tests per units/__tests__/transitionUnit.test.js:163-222 (2 real transaction, exactly one succeeds, other 409) + barcode.idempotency.test.js:63-120 (Promise.all, DB-level partial unique backstop).

**IMPORTANT test-DB fact:** backend tests build via sync({force:true}) (NOT migrations). Partial unique indexes must live in BOTH the migration AND the model indexes[] array (or test-setup.js manual CREATE UNIQUE INDEX) or concurrency tests won't enforce them.

**Report refs:** hive/SECURITY-FINDINGS.md (SEC-CR-1), hive/POSTGRES-REVIEW-FINDINGS.md (PG-1, PG-2), hive/BACKEND-REVIEW-FINDINGS.md (NOD audit).

## Tickets
- SEC-CR-1 -> doing (worker-money-out-r29) - coordinated money-out scope expanded to all 7 paths.
- R-29 -> doing (worker-money-out-r29) - the dispatch umbrella. deps R-23, R-28.
- UI/UX (R-26 + UX-CR-1..UX-L-4) DEFERRED TO LAST per human.
- SEC-H-2..SEC-L-8, NOD-*, PG-* remaining -> parked todo (after this critical).

## Queue (after R-29 money-out lands)
1. Security criticals remainder: SEC-CR-2 (role escalation), SEC-CR-3 (JWT forgery).
2. Security Highs: SEC-H-1..H-10 (authz, money corruption, authn).
3. Backend speed (NOD) + Postgres (PG) remediation.
4. Security Medium/Low.
5. UI/UX LAST.

Status: SEC-CR-1 + R-29 doing; dispatch imminent.

## WAVE: 3 security criticals in parallel (2026-09-08 ~16:1xZ)
Dispatched all 3 security criticals as separate backend workers (disjoint files - no shared-file conflict):
- **worker-money-out-r29** (R-29 / SEC-CR-1): money-out race family - 7 paths, CAS + partial-unique backstop + 409. [doing]
- **worker-sec-cr2-role-escalation** (SEC-CR-2): MANAGER->ADMIN privilege escalation - dedicated role-assign permission, privileged-role/target/last-admin guards, 403s. [doing]
- **worker-sec-cr3-jwt-forgery** (SEC-CR-3): forgeable JWT - pin algorithms HS256, bind session to payload.sub, enforce secret strength at boot, remove placeholder. [doing]
All contracts baked into spawn objectives + delivered to each worker inbox. Files disjoint: money-out (sales/rentals/expenses services+migrations+reversal models), SEC-CR-2 (users/roles), SEC-CR-3 (auth). All healthy/breaker-ok.

## R-29 INTEGRATED - SECURITY CRITICALS CLEARED (2026-09-08 ~16:55Z)
- worker-money-out-r29 DONE + integrated (9523749 -> merge c2b5c7e). Full plan executed: all 7 money-out race paths fixed via CAS status-flips + 5 partial-unique DB backstops + retry-on-collision for next-number races; 7 concurrency tests.
- MAIN backend suite 555/555 (33 suites) green on framework/md-impoc with SEC-CR-3 + SEC-CR-2 + R-29 all in.
- STATUS: SEC-CR-1, SEC-CR-2, SEC-CR-3, R-29 = DONE. R-24 umbrella (remaining H/M/L) = todo. R-26 UI/UX = todo (LAST per human).
- NEXT: SEC-H-1..10 (Highs: IDOR authz reads, trip-ownership stub, receipts PII, empty-item sell, money>2^53, token-in-localStorage, rate-limit/lockout, session-lifecycle, cookie security).

## SECURITY HIGHS WAVE - H-1/H-2/H-4/H-6/H-9/H-10 INTEGRATED (2026-09-09 ~02:15-02:55Z)
- **SEC-H-2 + SEC-H-4 DONE** (57fb56e ff, 601/601 green): 13 READ inventory routes gated `authorize(PERMISSIONS.INVENTORY.VIEW)` (trips/stocks/templates/vendors/units); `verifyTripAccess` upgraded 404/401/403 in both trip+stock service duplicates; `scanIntoStock` scoped to the URL trip (stock lookup includes Trip with required uuid); `getCloneLastStock` guarded. New tests: `tests/intake/read-authz.test.js` (14 routes x 401/403/200) + `tests/intake/trip-scoping.test.js` (4 scope tests).
- **SEC-H-6 DONE** (3a98a01 + merge 5b16161, 609/609 green): exactly-one-of-barcode/unitUuid `.refine()` in sales + rental-agreement validation schemas; service guards (400) in `sales.service.js resolveSellableUnit` + `rental-agreement.service.js resolveRentableUnit`; 8 new tests (4 sales + 4 rentals). Worktree-only batch pcf (worker delivered its own worktree; god discarded a superseded partial edit that had been sitting uncommitted in the main tree).
- **SEC-H-1 + SEC-H-9 + SEC-H-10 DONE** (1924b6d -> merge 13d12fc, 618/618 green): login rate-limit/lockout (NEW `rate-limit.middleware.js`: `LOGIN_IP_MAX=100`/900000ms window, `LOGIN_ACCOUNT_MAX_FAILED=5` exp backoff 1m/15m/1h/24h, counts account-not-found + wrong-password, resets on success, 429 locked; wired to `/login` + `/refresh`); suspended/deleted user -> 401 in `authenticate()` (joined `user.status === ACTIVE`); refresh cookie Secure in ALL envs + path `/api/auth` + `COOKIE_SECURE=false` override + refuses plain-HTTP in prod without override. 15 auth tests (9 new); 2 pre-existing header-policy tests updated to present the rotated refresh token (Secure cookie no longer echoes over http test transport) - intent unchanged. Note: test DB `impoc_test_h1` must not be shared by concurrent jest runs (sync force:true collides).
- MAIN backend suite now **618/618 (35 suites)** on framework/md-impoc.
- ACTIVE WORKERS: NONE (worker-sec-h1-auth-hardening DONE + archived; worker-sec-h6-sellable-unit DONE + archived). Next: SEC-H-5, SEC-H-7, SEC-H-8 (remaining Highs) then M/L tier.
- Standups (09-08 17:53Z + 09-09 02:01Z) reviewed: fleet healthy, board accurate, no stale/unowned work.

---

# SECURITY HIGHS WAVE - H-5/H-7/H-8 DISPATCHED (2026-09-09, god)

## Directive
Proceeding with the 3 remaining Security High fixes (H-1/2/4/6/9/10 already integrated). Human approved dispatch.

## Dispatch (3 parallel workers, disjoint files)
- **SEC-H-5 -> worker-sec-h5-receipts-pii** (character dwight): Receipts expose any transaction + customer PII by enumerable UUID. Backend-only. receipts.routes.js, receipts.service.js. Fix: creator/ownership/role scoping + restrict REPORTS.VIEW holders + mask PII unless entitled.
- **SEC-H-7 -> worker-sec-h7-bigint-money** (character dwight): int8 BIGINT parsed to JS Number -> silent money corruption >2^53. Backend-only. pg-pool-config.js global parser + all service files with Number() on money cols. Fix: keep money as string/BigInt through arithmetic, or cap at MAX_SAFE_INTEGER + Decimal/BigInt sums.
- **SEC-H-8 -> worker-sec-h8-jwt-localstorage** (character dwight): JWT access token persisted to localStorage (XSS-exfiltratable). Frontend-only. AuthProvider.jsx. Fix: memory-only token, restore via /auth/refresh httpOnly cookie only, remove localStorage fallback.

File disjointness: H-5 (receipts module), H-7 (pg-pool-config + service arithmetic), H-8 (frontend auth). No overlap.

## Tickets
- SEC-H-5, SEC-H-7, SEC-H-8 -> **DONE** (god verified: backend 622/622, frontend 261/261).
- R-24 umbrella -> remains todo (this wave is part of R-24 scope).

### DONE (2026-09-09 ~14:30Z)
- **SEC-H-5 DONE:** customerBlock masking (isPrivileged param), 4 new authorization tests, receipts test updated.
- **SEC-H-7 DONE:** BigInt arithmetic in 6 service files, 7 test assertions updated (string money values).
- **SEC-H-8 DONE:** localStorage removed from AuthProvider.jsx, token memory-only via httpOnly refresh cookie.
- ALL Security Highs now DONE: H-1/2/4/5/6/7/8/9/10 integrated.

## Next (after this wave)
- SEC-M-1..10 (10 medium), SEC-L-1..8 (8 low).
- Then NOD/PG remediation.
- UI/UX LAST (R-26 + UX-* cards).

---

# HOURLY OPS STANDUP (2026-09-09 ~16:20-16:35Z, god)

## Fleet
- Only god on the floor: breaker healthy, onHold false. All workers archived in registry. No pending spawn-requests (spawn-requests/ empty; 41 in .done).

## Floor status: NO workers active, nothing in-flight.

## Board reconciliation (drift found + fixed)
- SEC-M-3/5/6/7/8 were `doing` with PHANTOM assignees (worker-sec-m-idempotency / worker-sec-m-hardening / worker-sec-m-validation) that never existed in registry/fleet/spawn-requests, with ZERO code changes on disk. Reverted to `todo`, unassigned (details annotated).
- SEC-M-4 (doc-number races) was `doing` w/ phantom assignee -> marked `done` (already covered by R-29 retry-on-collision, worker-money-out-r29, commit 9523749).
- SEC-M-9 (react-router <7.18) was `doing` -> marked `done`: fix present in working tree (^6.28.0 -> ^7.18.0, installed 7.18.3).
- Net board: 107 tasks, 67 done / 40 todo / 0 doing / 0 blocked.
- SEC Status: M-1/2/4/9/10 done. Remaining SEC-M: 3/5/6/7/8 (todo, unassigned). SEC-L-1..8 todo. UX-* todo (R-26 last).

## UNCOMMITTED WORK IN MAIN TREE (surfaced for awareness)
- H-5/7/8 + M-1/2/9/10 changes verified green (backend 622/622, frontend 261/261 per records) but NOT COMMITTED: they sit as uncommitted diffs on top of master 13d12fc (SEC-H-1/9/10). No branch/stash contains them. Memory claimed H-5/7/8 "integrated" but no commit exists. FLAG: needs god commit+merge (or human decision) to persist this batch.

## Flags
- Closing time: request CANCELLED by human (2026-09-09T15:51Z) - normal ops resumed, no shutdown. Both closing-time inbox messages filed to .done.
- No stale/idle/blocked workers; no unowned `doing` cards remain after this reconcile.
- Next dispatch candidates (awaiting human GO): SEC-M-3/5/6/7/8, then SEC-L-1..8. UI/UX deferred LAST per human.
## INTEGRATION + DISPATCH (2026-09-09 ~22:15Z)
- Committed green H-5/7/8 + M-1/2/9/10 batch on framework/md-impoc as 796ea5b (post-commit verified: receipts 11/11, intake 161, frontend 261/261). UNCOMMITTED-WORK FLAG CLEARED.
- Spawned 2 agents on the floor per human directive (limit agent count): hardening (M-3+M-5+M-7) & validation (M-6+M-8), both character dwight. Spawn files in hive/spawn-requests/.
- Tasks stay todo/unassigned until workers actually appear in fleet (phantom-assignee lesson).

## TICKET PLANNED (2026-09-09 ~22:25Z)
- R-30 (todo, unassigned, priority medium): POS editable cart-item price after scan, validated against floor price. Backlog - not started. Research + implementation plan + test plan captured in tasks.json detail. No code changes made.
## INTEGRATED (2026-09-09 ~18:00Z) - SEC-M-6 + SEC-M-8
- worker-sec-m-validation-m6-m8 done: fb4b65b merged as d40104c on framework/md-impoc. Full suite 36/634 green (verified by god). Delivery receiptPayload shape+100KB cap + real SALE/RENTAL entity refs; paymentMethod/customerSource enforced against active picklists on sales+rentals write path. SEC-M-6/M-8 -> done. Worktree reclaimed.
- Still doing (hardening, on floor): SEC-M-3/M-5/M-7 by worker-sec-m-hardening-m3-m5-m7.

---

# SEC-M-3/5/7 INTEGRATED + FRONTEND REGRESSION (2026-09-10, god standup)

## SEC-M-3/5/7 (worker-sec-m-hardening-m3-m5-m7) - DONE + INTEGRATED
- Worker done message + preserved-worktree + reclaimed informs all received and filed.
- god verified + integrated on framework/md-impoc: merge a41f6fd (commit 3c559f9, 20 files, +1523/-158) + reconcile c15890b (M-8 test bodies send requestUuid; M-7 allow-list admits M-6/M-8 client-safe messages). Verified 37 suites / 658 tests green, frontend 261/261.
- M-3 request-key idempotency: RequestKey persisted in write txn; requestUuid REQUIRED on SALE_CHECKOUT/CANCEL/REFUND, RENTAL_BOOK/SETTLE/CANCEL, EXPENSE_CREATE/REVERSE; 23505 -> replay 200 'already processed (request replayed)'.
- M-5 createdBy read scoping: userHasBroadReadScope (ADMIN/MANAGER); sales/rentals/expenses lists scoped to actorUserId, GET-by-uuid 404 for foreign users.
- M-7 error masking: error.middleware rewritten; allow-listed client-safe phrases pass through, allowed 4xx carrying UUID/status fragment masked, else GENERIC_4XX.
- Dev DB migrations applied by god (were DOWN): 20260908000001 (money-out backstops), 20260908120000 (is_privileged), 20260909000001 (request_keys gesture CHECK). All UP now.

## NEW R-31 (todo, unassigned, priority high) - FRONTEND REGRESSION from M-3
- requestUuid is now REQUIRED on money-write POSTs. Frontend services salesApi/rentalsApi/expensesApi do NOT send requestUuid -> UI checkout/rental/expense/cancel/refund flows would 400. mint via platform/requestKey.js createRequestKey() in 8 service fns. NOT started.

## Standup (scheduler 00:25Z 09-10)
- Fleet: only god live (healthy), all workers archived, no pending spawn-requests. Board reconciled (M-3/5/7 done, R-31 added). Nothing stale/blocked/unowned.

## R-32 � DB read-layer (views + trigger/materialized summaries) � PLANNED (2026-09-10)
- Human request: reduce DB calls/improve perf via view tables + triggers for grids and dashboard items. ANALYSED -> FEASIBLE -> card R-32 (todo, medium, deps R-28).
- Phase A: grids = SQL views + missing date/FK indexes + pagination (list endpoints query views, DTO shapes unchanged).
- Phase B: dashboard/analytics = MATVIEW CONCURRENTLY or trigger-maintained reporting summary over append-only ledger; money stays BIGINT, derived-only, reversals subtracted.
- Evidence: reports.service.js aggregates whole tables in Node; R-28 already flags no-pushdown/unindexed-FK/no-date-index/unpaginated. Queued behind SEC-M/L + R-31.

## R-31 � SEC-M-3 requestUuid frontend � DONE + MERGED (2026-09-10)
- Worker finished but harness dropped its done/status msgs (malformed-json) - payloads recovered from outbox/.sent/bad-*, filed to god inbox/.done/.
- 8 money-write fns (salesApi/rentalsApi/expensesApi) now carry requestUuid (mint-or-honor); POS/Rentals/Expenses screens mint one key per intent, reuse on retry, reset on success/close.
- Verified by god: vitest 277/26 + build PASS in worktree AND main. Commit 2fb73dd -> merged 96acfbd (framework/md-impoc). Card R-31 done; worker archived.

## SEC-L-1..L-8 (low security batch) � IN FLIGHT (2026-09-10)
- Batch A backend worker-sec-l1-l6: L-1 login timing oracle / L-2 email+phone to privileged scope / L-3 customerId out of sale-rental DTOs / L-4 rotate admin password123 dev creds / L-5 escape LIKE wildcards / L-6 req.user?.id in intake scan controller.
- Batch B frontend worker-sec-l7-l8: L-7 frontend buildError lockstep w/ backend M-7 allow-list / L-8 vite server host localhost (was 0.0.0.0).
- Fix applied to spawn flow: spawn-request must include command:'opencode' (defaults to claude elsewhere). Both spawned + contract-delivery re-sent after earlier no-inbox drops.

## SEC-L-7..L-8 � DONE + MERGED (2026-09-10)
- worker-sec-l7-l8: L-7 shared src/platform/buildError.js (mirrors backend M-7 allow-list; masks opaque/UUID/(status:) strings; 15 services + authApi/tripsApi refactored, -199/+23), L-8 vite host true->localhost.
- Verified by god: vitest 291/27 + build PASS (worktree + main). Commit 7b19765 -> merged 981fa2f. Tasks SEC-L-7/8 done; worker deregistered; worktree auto-reclaimed.
- REMAINS in SEC-L: backend batch worker-sec-l1-l6 (L-1..L-6) in flight.

## SEC-L-1..L-6 � DONE + MERGED (2026-09-10)
- worker-sec-l1-l6: L-1 dummy argon2 on unknown-user/inactive login (timing oracle); L-2 new users.view_pii (ADMIN-only, stricter than M-5 broad-read; no current FE screen consumes email/phone); L-3 customerId dropped from sale/agreement DTOs (no FE usage); L-4 dev seed pw rotated Impoc-Devseed-2026!; L-5 escapeLike() helper on customers/units/stock LIKEs; L-6 req.user?.id.
- Verified: jest 665/665 (worktree + main); commit 005b320 -> merged 648318c. SEC-L-1..6 done; SECURITY TRACK 100% CLOSED (H/M/CR/L all done).

## NEXT BATCH DISPATCHED (2026-09-10 ~01:30Z) - R-26 UX umbrella + R-30 + R-32
- worker-ux-combo-r26-r30 (frontend): ALL 25 UX cards (UX-CR/H/M/L) + R-30 FRONTEND half (POS cart price edit). One agent owns all shared frontend files to avoid merge collisions. Vitest baseline 291/27, build PASS. Source: hive/UIUX-FINDINGS.md + tasks.json.
- worker-r32-db-views-r30 (backend): R-32 DB read-layer (SQL views for grids + matview/trigger dashboard summaries + FK/date indexes + pagination) + R-30 BACKEND half (floor-price guard in sales schema/service). Jest baseline 665/665. Source: tasks.json R-32/R-30 detail + POSTGRES-REVIEW-FINDINGS.md.
- Both spawned healthy, contracts delivered + ACK-requested 01:41Z. Awaiting DONE.

## R-26 UX UMBRELLA + R-30 FRONTEND - DONE + MERGED (2026-09-10 02:00Z)
- worker-ux-combo-r26-r30: all 25 UX cards (CR/H/M/L) + R-30 frontend half. New primitives Tab/NavItem, rentalStatus.js.
- Verified by god: vitest 293/27 + build PASS (worktree AND main). Commit 5a5ae89 -> merged 1182611 (no-ff, clean).
- 26 tasks R-26 + UX-* -> done. R-30 REMAINS doing: backend floor-guard half still in flight with worker-r32-db-views-r30.

## R-32 DB READ-LAYER + R-30 BACKEND — INTEGRATED (2026-09-10)
- worker-r32-db-views-r30 delivered (backend-only, disjoint from UX frontend work).
- Merged `4ed6479` (--no-ff) into framework/md-impoc + follow-up `4994b96` (migration ESM fix).
- R-32: 5 grid SQL views (v_sales/rentals/expenses/units/stocks_grid), 34 indexes (24 R-28 FKs + date + composites), pagination util (MAX 200), list endpoints query views (DTO shapes identical), dashboard matviews (mv_dashboard_sales/rentals/expenses + mv_inventory_snapshot, refreshed on 60s staleness). 3 migrations applied to dev DB.
- R-30 backend half: sellingPricePaise validated; below-floor -> 400 "Price cannot be below floor price" (allow-listed). Frontend half was already in 1182611.
- Fix I caught at integration: the 3 migration files shipped CommonJS `module.exports` under a `type:module` backend -> `db:migrate` threw. Converted to bound ESM named exports. Tests were green regardless (test-setup recreates views after sync, not via CLI).
- VERIFIED in main: backend jest 669/669 (38 suites), frontend build PASS.
- KANBAN: 110/110 done — 0 doing, 0 todo, 0 blocked. Backlog empty.

## R-33 — Expense Type picklist + expense form dropdown (2026-09-10, user request)
- Add a flat picklist "Expense types" (seed Rent/Travel/Food/Misc, admin-extensible) and make the expense form Category a dropdown fed by it.
- Vertical slice, one owner. Template = payment-methods module end-to-end.
- Backend: new module backend/src/modules/expense-types/, ExpenseType model + create-expense-types migration (ESM export) + idempotent seeder, mount /api/picklists/expense-types (read=authenticate, write=picklists.create/update).
- Frontend: picklistsApi getExpenseTypes(), admin PicklistManagementScreen "Expense types" tab (FlatPicklistManager), ExpenseFormDialog Category → ui Select of active expense types (category stays a string; no backend contract change).
- Boundary: category column stays free-text; no hard backend membership enforcement (keeps legacy rows/edits working). Uncommitted for god to verify+integrate; backend jest + frontend vitest + build green.
- Status: todo → dispatched to a single worker.

## R-35 — POS UPI QR checkout flow (2026-09-10, user request — PLAN ONLY, not dispatched)
- Rename sale "Charge" button -> "Checkout"; clicking it opens a payment step, sale is created only on "Mark received".
- UPI method: show a upi://pay QR (pa=VPA, pn=SHOP_NAME, am=rupees, cu=INR, tn/tr=checkout key) with the amount; "Mark received" -> create sale -> "Thank you" replaces the QR -> receipt.
- Cash method: no QR; "Mark as received" -> create sale -> thank you -> receipt.
- UPI id (VPA) configurable via a NEW picklist "UPI accounts" (label + vpa + isActive); POS uses the active account.
- Add a QR lib (none installed); buildUpiUri pure helper + tests. SALE mode only; rentals unchanged.
- Backend: only the upi-accounts picklist module; NO sale-creation change, NO payment-gateway verification (Mark received = manual confirmation).
- Depends on R-33 (soft): both touch picklistsApi.js + PicklistManagementScreen.jsx — sequence after R-33 integrates. Status: todo, awaiting human GO to dispatch.

## R-35 AMENDMENT (2026-09-10) — public customer-display page on a SEPARATE device
- User chose separate-device display (tablet/phone), so it needs a public backend live channel (SSE), not same-browser BroadcastChannel.
- Pairing code (per-terminal, localStorage) -> customer device opens /display/:code.
- Backend (ephemeral, in-memory): POST /api/pos-display/:code (auth, SALES.CREATE) publishes {status, method, amountPaise, upiUri}; GET /api/pos-display/:code/stream (PUBLIC, no auth) SSE the display subscribes to; late-join gets current state. Payload minimal (no PII/cart). Only subscribe is public.
- Frontend: App.jsx restructured so /display* renders OUTSIDE RouteGuard+AppShell (public, full-screen). States (framer-motion): idle ambient / UPI QR+amount / cash 'pay at counter' / received thank-you -> idle. POS builds upiUri + posts state on each transition; display just renders.
- Still PLAN ONLY; awaiting human GO.

## R-36 — System-wide modal/form polish (2026-09-10, user request — PLAN ONLY)
- (1) Label↔control spacing too tight (Create trip modal): bump shared primitives Input.jsx space-y-1.5→space-y-2, Select.jsx gap-1.5→gap-2 (fixes all forms).
- (2) Modal already scrolls to viewport height; hide default scrollbar, add reusable themed .themed-scrollbar (webkit + firefox) on the Dialog body (+ reuse on Select list/sidebar).
- (3) Select popover inside a modal is clipped by the body overflow and shares z-50 with the Dialog → portal the popover to body, position from trigger rect, z above modal (modal=50, popover=60+); keep outside-click/Esc/keyboard/reposition.
- Shared-component change → full vitest + build + visual check. Status: todo, awaiting human GO.

## Ops standup (2026-09-10 14:31Z)
- Floor: god only (worker-r33 reaped after R-33 integrated). No workers, no spawns, nothing stalled.
- Board: 114 cards — 112 done, 0 doing, 2 todo (R-35 POS UPI+display, R-36 modal/form polish); both plan-only awaiting GO. Nothing blocked/unowned. Git clean (HEAD d815841).

## R-37 — Reusable DataGrid for every grid (2026-09-10, user request — PLAN ONLY)
- Replace hand-rolled Table with a shared <DataGrid> on @tanstack/react-table (headless, keeps Tailwind theme). Standard for all current + future grids.
- Fix whole-page scroll: grid screens = flex column, toolbar fixed, grid fills remaining height and scrolls its OWN body (sticky header); page never scrolls.
- Per-column sort + filter + global search over each grid's available columns; column defs declare sortable/filterable + cell renderer.
- Migrate ~12 grids (Trips/Stocks/Units/Vendors/VendorDetail/TripDetail/Customers/Users/Roles/Permissions/FlatPicklist) preserving renderers (money/badges/action buttons/RBAC) + empty/loading. + a 'how to add a grid' note.
- Baseline client-side sort/filter/search/paginate; API designed to switch to server-side (R-32 views + pagination) for huge tables (phase 2). Reuse R-36 themed scrollbar.
- Large: may be phased / split at dispatch. Full vitest+build+visual. Status: todo, high, awaiting human GO.

## R-38 — App-wide themed scrollbar (2026-09-10, user request — PLAN ONLY)
- Restyle the default browser scrollbar app-wide (page/sidebar/modal/grid/dropdown) to match the theme and look good; keep it visible/usable (restyle, not hide).
- CSS-only in index.css: ::-webkit-scrollbar/-thumb/-track (thin, rounded, token colours, hover) + Firefox scrollbar-width/scrollbar-color.
- SINGLE SOURCE OF TRUTH: R-36 (modal scrollbar) + R-37 (grid scrollbar) reuse this instead of their own. Status: todo, awaiting GO.

## R-39 — Collapsible sidebar rail (icon-only) (2026-09-10, user request — PLAN ONLY)
- Toggle the desktop sidebar between full (icon+label, w-60) and icon-only rail (~w-16, icons only, names as hover tooltips). Persist in localStorage.
- Distinct from R-34 (section-group collapse): rail-collapsed = flat icon set, section headers only show in the expanded rail.
- Desktop only; mobile tab bar unchanged. AppShell.jsx + tests. Status: todo, awaiting GO.

---

# R-41 — CROSS-PLATFORM BARCODE SCANNER (2026-09-11, DONE — user-accepted)

Barcode scanning now works on **iOS, macOS and mobile**. **Windows Chrome** built-in webcam remained unreliable to decode even after the pipeline was correct; user accepts this and will use an **external camera on Windows**. Marked DONE at user request (not left blocked).

- **Root cause found (commit 9f23feb):** we captured frames via `ImageCapture.grabFrame()`, which on Windows Chrome frequently returns a BLACK frame. Rewrote the @zxing decode loop to canonical `ctx.drawImage(video,0,0,w,h)` → `HTMLCanvasElementLuminanceSource` → `HybridBinarizer` → `MultiFormatReader.decodeWithState(CODE_128)`, throttled ~10/s; removed ImageCapture entirely. Earlier fixes on the way: dropped `TRY_HARDER` (Windows canvas-rotate crash, 06033fa) and switched `decode()`→`decodeWithState()` so CODE_128 hints stick (0e5da45).
- **Permission primer (shipped):** `frontend/src/platform/mediaPermissions.js` `primeMediaPermissions()` asks for camera once right after login (guarded, checks Permissions API first, swallows denial); wired into AppShell mount.
- **Cleanup (9ddd2cc):** removed the one-time `[scanner] capture/centerBlack` debug diagnostic.
- Files: `frontend/src/components/BarcodeScanner.jsx`, `frontend/src/platform/mediaPermissions.js`, `frontend/src/app/AppShell.jsx`. Build + 298/298 vitest green. Full history in tasks.json R-41.

**Board now: only R-35 (POS UPI QR checkout) remains — todo, plan-only, awaiting user GO to dispatch.**

---

# R-35 — POS UPI-QR CHECKOUT + PUBLIC CUSTOMER DISPLAY (2026-09-11, DONE + INTEGRATED)

Merged `20105d6` (feat `d5107ff`) into framework/md-impoc. Built by `worker-r35-pos-upi-display` (Sonnet, isolated worktree, now reclaimed). Split into sub-tickets R-35a..f (all done).

- **Backend:** `upi-accounts` picklist (label+vpa+isActive; routes `GET/POST /api/picklists/upi-accounts`, `GET/PATCH /:uuid`; migration 20260911000001 applied to impoc_dev). Ephemeral in-memory `pos-display` SSE channel: `POST /api/pos-display/:code` (auth+SALES.CREATE) publishes `{status,method,amountPaise,upiUri}`; public `GET /:code/stream` (SSE, late-join + 15s heartbeat + auto-reset to idle 8s after received). error.middleware SAFE_4XX allow-list extended.
- **Frontend:** `platform/upi.js` buildUpiUri(); `qrcode.react@4.2.0` (pinned). POS `Charge`→`Checkout` opens PaymentDialog; sale created only on Mark received (SEC-M-3 checkoutKeyRef preserved). App.jsx route split → `/display`,`/display/:code` render outside RouteGuard+AppShell (public). PosDisplayScreen (EventSource + framer-motion). UPI accounts tab via existing FlatPicklistManager.
- **Verified by god in worktree:** backend jest 709/709, frontend vitest 332/332, build PASS.
- **Security:** only SSE subscribe is public (status/method/amount/upiUri for a code the viewer already has, no PII/cart); publish is auth+SALES.CREATE gated.
- **PENDING:** manual browser smoke-test recommended before relying on it — POS Checkout→UPI→Mark received→Thank you→Receipt, plus `/display/<code>` on a second device/tab.
- **Lockfile note:** `frontend/package-lock.json` is gitignored; fresh setup uses `npm install --legacy-peer-deps` (pre-existing @testing-library/react@15 vs @types/react@19 peer conflict, unrelated to R-35).

**ALL TASKS DONE (125/125). Separate un-owned item: an uncommitted "SHREE Fashion Store"→"Shree Fashion Store" rename sits in the main working tree (5 files: .env.example, receipts.service.js, delivery.test.js, AppShell.jsx, ShopLogo.jsx) — appears to be the human's branding tweak; R-35's upi.test.js still uses the old casing, so the rename is inconsistent. Not committed by god (not god's work).**

---

# R-42 — POS CUSTOMER-DISPLAY POLISH (2026-09-11, DONE + INTEGRATED)

Merged `71d3273` (feat `f86945a`) into framework/md-impoc. Built by `worker-r42-display-polish` (Sonnet). Follow-up to R-35.

- **R-42a Logo QR:** new `platform/qrLogo.js` (single swappable `LOGO_SRC` monogram data-URI + `qrLogoSettings`); `level="H"` + center logo on the 280px display QR and 200px POS QR (56px link QR untouched). *Scannability: level H ~30% recovery vs ~19% logo area — real phone scan advised before customer use.*
- **R-42b Border toggle:** `platform/displayBorderStyle.js` (localStorage); `.qr-border--pulse` (glow) + `.qr-border--marching` (rotating conic ring) in index.css, both honour `prefers-reduced-motion`; small on-display toggle, default pulse. **User will finalize one later.**
- **R-42c Spoken thank-you:** `speechSynthesis` on a live non-received→received transition — generic, or "…&lt;firstName&gt;!" when present. Payload gained optional single-token `customerFirstName` (validation `\S+` max 50; **user-approved first-name-only on the public channel**); POSScreen posts it in the received publish. One-time "Tap to enable sound" pill unlocks audio; late-join dedupe gated on real SSE message count (worker found+fixed a mount-miscount bug).
- **Verified by god:** frontend vitest 342/342 (+10), backend jest 712/712 (+3), build clean. No migration (in-memory channel).

**Board 130/130 done. Still outstanding (unchanged): uncommitted human SHREE→Shree rename (5 files) in main tree — awaiting user go to finish consistently. Two manual checks recommended on R-42: phone-scan the logo QR, and tap-to-enable-sound + hear the thank-you on the display device.**

---

# SHIFT CLOSE (2026-09-11, god)
Safe to close. Floor clear (only god; all workers archived), inbox drained, 0 pending spawn requests, working tree clean. HEAD = a0b06f3 (framework/md-impoc). This session shipped: R-35 (POS UPI-QR checkout + public display), R-42 (logo QR + border toggle + spoken thank-you), R-43 (intake colour/size per-unit fix), R-41 closed (scanner, user-accepted), SHREE->Shree rename (d617e06 + a0b06f3), R-44 mobile responsiveness pass (a0b06f3). Board 132 done. OPEN = 3 plan-only tickets parked on user decisions: R-45 (update receipt), R-46 (Campaigns IG/WhatsApp), R-47 (receipt delivery email/WhatsApp/SMS). Nothing in flight.

---

# R-48 — BARCODE VALUES: SHREE + TIMESTAMP + COUNTER (2026-09-13, DONE, built directly in session — no worker)

**Trigger (user):** barcode values were a bare reflection of `barcode_seq` (12 zero-padded digits). Drop/reset the sequence (db wipe, re-migrate) and new labels collide with labels already stuck on stock. User also wants every barcode to start with `shree`.

**Decision (user-approved):** value = `SHREE` + TS6 + CNT4 = **15 chars**, uppercase A–Z0–9 only. Example `SHREE0D4N5H000V`.
- TS6 = seconds since 2026-01-01T00:00Z, base-36, zero-padded to 6 (fits until ~2094; formatter throws after). One timestamp per generate call.
- CNT4 = `nextval(barcode_seq) mod 36^4`, base-36, zero-padded to 4 (1,679,616 per second ≫ max batch 10,000).
- Uniqueness: collision needs same second AND same counter; sequence keeps climbing inside a second; after any reset the timestamp is later than every printed label. Only a backwards clock breaks it (accepted).

**Changes (backend only; frontend had no 12-char assumption):**
- `barcode.constants.js` → `BARCODE_FORMAT` + `BARCODE_MAX_LENGTH=32`; `barcode.service.js` → exported pure `formatBarcodeValue(seq, nowMs)`, 12-digit cap removed.
- Migration `20260913000001-widen-barcode-columns` → `units/sale_lines/rental_lines.barcode` VARCHAR(12)→32, `units_barcode_length_check` 1..32. Postgres refuses ALTER TYPE under a view, so it drops the 5 R-32 grid views, widens, re-creates them by importing `VIEWS` (now exported) from `20260910000002-create-grid-views.js`. Down narrows back to 12 (fails by design if R-48 labels exist).
- Models Unit/SaleLine/RentalLine STRING(32); validators `max(12)`→`max(32)` in units / sales / rental-agreement (×2) / intake stock.
- Tests: new `tests/barcode.format.test.js` (7), integration 12-digit cases replaced.

**Verified:** backend jest **725/725** (43 suites); `db:migrate` up→undo→up clean on fresh `IMPOC` dev DB; live smoke `GET /api/barcodes/generate?pages=1` → 200 PDF with 15 values `SHREE0D4N5H000V…0019`.

**Caveat for the user to test on paper:** 15 mixed chars ≈ 1.7× the Code128 modules of 12 digits (subset C packs 2 digits/symbol) → thinner bars at the configured 35 mm. If phone scanning gets flaky, raise `barcode_width_pt` in app_settings (try 45–50 mm via the existing test sheet). Layout code untouched. Old 12-digit labels stay valid.

**Environment notes (this Mac, 2026-09-13):** Postgres 16 via Homebrew, DBs `IMPOC` / `IMPOC_test` (owner `postgres`) wiped + re-migrated + seeded; `.env` filled (store address/phone, fresh JWT secrets, `COOKIE_SECURE=false` for home-wifi HTTP). `npm i` in backend needs a working Xcode CLT (`argon2` native build hit `'functional' file not found` → reinstall CLT); frontend needs `--legacy-peer-deps`.

---

# R-49 — PRINT LABELS: NO-REFRESH FLOW + LABEL LAYOUT (2026-09-13, DONE — user-tested)

**Trigger (user):** after one sheet downloaded, the screen had to be refreshed to request another; wanted a normal top-right toast instead of the inline banner and the input always visible. Also: too much empty space under the barcode and a tiny price box.

**Frontend** ([BarcodePrintScreen.jsx](frontend/src/screens/BarcodePrintScreen.jsx)): success → `toast.success('Sheet generated', 'N page(s) downloaded as barcodes.pdf.')`; replay (JSON) → `toast.info('Sheet already generated')`. Form is always rendered. requestKey now a lazy `useState(() => createRequestKey())` and **re-minted after every completed request** (`finishAttempt`) — SEC-M-3 kept: the key is reused only on retry of the same attempt, a new sheet is a new intent. Inline success/replay banners removed; waking + error banners unchanged. Tests wrapped in `ToastProvider`; new test asserts form stays usable and the 2nd request carries a different requestUuid. vitest 362/362.

**Backend** ([barcode.generator.js](backend/src/modules/barcode/barcode.generator.js) `drawLabel`): code area = `paddingTop + barcode.heightPt + textMarginTop + fontSize + paddingBottom` (content-driven, clamped so the info box never drops below its 14pt floor); the divider moves up and the price box takes the whole remainder (~100pt ≈ 35mm on the 3×5 grid). No geometry keys changed. jest barcode suites 33/33; rendered PDF checked visually (tight barcode strip, large empty box).

**Also this session (no ticket, user request):** friendly server-failure messages — [apiClient.js](frontend/src/platform/apiClient.js) `friendlyServerMessage()` rewrites no-response / 502-504 / 5xx axios errors to plain wording ("Cannot reach the server…", "The server is not responding right now…", "Something went wrong on the server…"); `buildError` passes it through; BarcodePrintScreen honours it. 5 tests.

**CLOSED 2026-09-13:** user printed + scanned + re-requested without refresh — confirmed working. (R-48 15-char code scans fine at 35 mm.)

---

# R-50 — BARCODE LABEL CONFIGURATOR (2026-09-13, DONE — user-tested)

**Trigger (user):** one page to configure everything about the label sheet with a preview; persist in a NEW table. **Decision (user): single config, no presets.**

**Data:** `barcode_layouts` (migration `20260913000002`), exactly one row (`CHECK id = 1`), all lengths in **mm** (`DECIMAL(6,2)`), font/border in pt; seeded from today's sheet so output is unchanged until edited. The old `app_settings barcode_*` keys are no longer read by the generator (left in place). New permission `inventory.barcode_layout_manage` (migration `20260913000003`, Admin only).

**Geometry — single source of truth:** `backend/src/modules/barcode-layouts/barcode-layout.geometry.js` (`computeSheetGeometry`, `DEFAULT_LAYOUT`, `PAGE_SIZES_PT`), mirrored 1:1 in `frontend/src/platform/labelLayout.js` so the live preview and the PDF agree. Returns label/barcode/text sizes in pt, `codeAreaHeight` (content-driven, R-49), `infoBox.height` = remainder, and `problems[]` (grid off page / barcode wider than label / label too short).

**Backend:** `GET /api/barcode-layouts` (barcode_generate) — findOrCreate the row; `PUT` (barcode_layout_manage) — zod `.strict()` ranges + geometry fit check → 400 `Layout does not fit: …` (allow-listed both sides). `GET /api/barcodes/preview` (barcode_generate) — one sample page with the SAVED layout, dummy `SHREE000000000N` values, **no sequence draw, no request_keys row**, `Content-Disposition: inline`. `barcode.generator.js` now takes geometry from the layout (page size/orientation from PDFKit point sizes; `generateBarcodePdf(values, tx, layoutOverride)` + `generateSampleSheetPdf`). `barcode.service.js` reads columns/rows from the layout. Obsolete app_settings error-classification test rewritten. jest **732/732**.

**Frontend (revised per user, same day):** NO separate tab — the configurator is a collapsible section on **Print labels** (`/barcode-sheets`) behind a "Configure barcode sheet" link under the form; `LabelLayoutScreen.jsx` is the embedded section. Inputs + Save disabled without `barcode_layout_manage`. Default corner radius 0 mm (user). Form grouped Page / Grid / Label / Barcode / Code text; right column: one-label SVG to scale (fake bars, code text, divider, grey "price / size written by hand"), size read-outs (label, barcode, price-box height, labels per page), page thumbnail of the grid, red fit warning. Buttons: Load defaults / Discard changes / Preview PDF (saved layout, opens tab; download fallback if popup blocked) / Save layout (dirty-gated). `services/barcodeLayoutApi.js`. vitest **369/369**, build OK.

**Verified live:** PUT landscape A4 2×4 45 mm → `GET /api/barcodes/preview` rendered exactly that (eyeballed PNG), barcode_seq untouched; bad layout → 400 with the fit message. Dev row restored to defaults afterwards.

**CLOSED 2026-09-13:** user exercised the embedded configurator (edit → preview → save → PDF) and printed — confirmed working.

---

# SHIFT CLOSE (2026-09-13, claude direct session — no hive workers)
This session shipped on the `context` branch (ALL UNCOMMITTED, awaiting user's go): R-48 barcode values SHREE+timestamp+counter (+ column widening migration), friendly server-down/5xx wording (no ticket), R-49 Print labels no-refresh flow + label layout, R-50 barcode sheet configurator (single-row `barcode_layouts`, embedded on Print labels, live preview + PDF preview). Backend jest 732/732, frontend vitest 370/370, build clean. Dev DB `IMPOC` wiped + re-migrated (37 migrations) + seeded. OPEN = R-46, R-47 (plan-only, parked on user decisions). Local-only helpers not to commit: `.claude/launch.json`, `frontend/vite.http.config.js`.

---

# R-51 — GST ON PURCHASES (2026-09-13, DONE — user-tested) · R-52 — BUYING TEMPLATES DECISION (parked ~1 month)

**Why (user):** vendors charge GST; bills show CGST+SGST rate per line and final CGST/SGST ₹ at the subtotal. Nothing was recorded. The inventory manager needs the true per-unit cost when choosing a selling price.

**Decisions (user):** stock level = **percent rates** (`cgstRatePct`, `sgstRatePct`); bill level (Add vendor to trip) = **rupee amounts** (`cgstPaise`, `sgstPaise`); **Total paid is entered GST-inclusive → no variance/reconciliation**; buying templates get **no changes** (user is retiring that module → R-52); landed-cost hint is **client-side only**.

**Data:** migration `20260913000004` — `stocks.cgst_rate_pct` / `sgst_rate_pct` DECIMAL(5,2) NOT NULL DEFAULT 0 + CHECK 0..100; `trip_vendors.cgst_paise` / `sgst_paise` BIGINT NOT NULL DEFAULT 0 + CHECK ≥ 0. Existing rows = 0. Grid views dropped/re-created (R-48 pattern); `v_stocks_grid` now exposes the rates (mirrored in `tests/utils/test-setup.js`).

**Backend:** models Stock/TripVendor; zod `gstRateSchema` (0..100, ≤2 decimals) on stock create/update, `cgstPaise/sgstPaise` (paise, optional, default 0) on both trip-vendor bill schemas; services pass-through; DTOs return rates as numbers, paise as strings. `tests/intake/gst.test.js` (6). jest **738/738**.

**Frontend:** `platform/gst.js` — `landedCostPerUnit({buying, whole, quantity, cgst, sgst})` → base/gst/total paise (whole ÷ qty fallback, paisa rounding) + `parsePercent`. StockForm: `CGST (%)` / `SGST (%)` inputs beside buying price; hint under **Selling price**: “Cost per unit incl. GST: ₹1,050.00 (buying ₹1,000.00 + GST 5% = ₹50.00)”, live. TripDetail: `CGST (₹)` / `SGST (₹)` on the bill dialog, “GST incl. (₹)” column in the vendors grid. Stocks grid: “GST 2.5% + 2.5%” under per-unit price. vitest **379/379**, build OK.

**R-52 (blocked, humanQA on card):** Hide / Remove / Keep the Buying templates module. No work until the user answers.

**CLOSED 2026-09-13:** user tested stock rates + hint, vendor bill GST and both grids — 'working great'. **R-52:** user will run production for ~1 month first, then decide (revisit ~2026-10-13).

---

# SHIFT CLOSE #2 (2026-09-13, claude direct session)
R-51 done (user-tested). R-52 parked until ~mid-Oct 2026 by user choice (production trial first). Board: 138 done / 0 doing / 1 blocked (R-52) / 2 todo (R-46, R-47). R-51 code + docs UNCOMMITTED on `context` at close — commit code to both branches (docs to `context` only) when the user says so.

---

# R-53 — DIGITAL PET ON THE CUSTOMER DISPLAY (2026-09-13, DONE — user-accepted)

**Trigger (user):** a hand-drawn blue-bird mascot (`pet/test.png` spritesheet + `pet/pet-engine.html` canvas demo). Show it on `/display/:code` while idle, playing random animations for defined durations; the **last three rows** (blink / coding / reading) should run much longer than the others. Move the files into the frontend.

**Sheet analysis (pixel-measured):** 1536×1872 RGBA, **8×9 grid → 192×208 px cells**, every sprite inside its cell, frames per row `[6,8,8,4,5,8,6,6,6]`. Rows: 0 idle · 1 fly (right) · 2 walk (left) · 3 cheer (one-shot) · 4 sleepy · 5 worried (one-shot) · 6 blink · 7 coding · 8 reading. The demo's cell size (232×251) was for a different export — corrected.

**Where things live now:** `frontend/public/pet/pet-sheet.png` (image) · `frontend/src/platform/petEngine.js` (SpriteEngine + `PET_SHEET` + `PET_ANIMATIONS` + `pickWeighted` + `createPetScheduler` + `validatePetConfig`) · `frontend/src/components/DigitalPet.jsx` · `frontend/public/pet/pet-engine.html` (dev-only tuning page; imports the module from `/src`, so one copy of the engine). The root `pet/` folder is gone.

**Scheduler:** weighted random, never the same animation twice in a row; looping anims are held for a random time in their `holdMs` range (idle 4–8 s, fly/walk 3–6 s, sleepy 4–7 s, **blink 12–20 s, coding/reading 15–25 s**); one-shots (cheer, worried) play once then move on. Injectable RNG/timers → deterministic tests. Component pauses when the tab is hidden; `prefers-reduced-motion` → slow idle only.

**Verified:** vitest **390/390** (+12), build OK; live on `/display/1234`: blink 12.6 s → walk 3.6 s → blink 19.2 s → cheer → idle.

**Tuning:** weights/holds are the two numbers per row in `PET_ANIMATIONS`; open `http://localhost:5173/pet/pet-engine.html` under `vite dev` to try animations and the scheduler by hand.

**R-48 follow-up (2026-09-13, no ticket — user request):** POS 'Scan or enter barcode', rental-create and stock-intake inputs capped at `maxLength={12}` and silently truncated the new 15-char codes. All three now use `BARCODE_MAX_LENGTH` (32) from `frontend/src/constants/barcode.js`. vitest 390/390.

**R-53 revision (user, same day):** per-row **fps from the sheet** — measured mean inter-frame pixel change: fly/walk (~0.12, even steps) → 12 fps; idle 0.07 → 6; blink 0.10 → 4; key-pose rows sleepy 0.22 → 3, coding 0.22 → 4, worried 0.21 → 5, reading 0.15 → 5; cheer 8 (one-shot). **Poke:** any click/touch on the display → `scheduler.poke()` plays row 0 (idle/attention) for 4 s (`PET_POKE`), repeated taps restart the hold, then the random cycle resumes. Verified live. vitest 393/393.
**R-53 polish (user):** idle view shows only the bird + shop name (waiting line removed). Pet canvas is now viewport-capped (`min(384px, 88vw, 50vh·192/208)`, height auto) — the fixed 384 px canvas was clipping on phones; frames in the PNG are intact (bbox check: none touch a cell edge).
**R-53 closed (user):** the half sparkle in coding frame 2 is in the PNG itself (verified: transparent gap before the 192-px boundary, no sprite touches any boundary) — not a grid issue; accepted as-is.

---

# R-54 — GOOGLE REVIEW QR AFTER PAYMENT (2026-09-13, DONE — user-tested)

**Validated with the user first:** Google's write-review link cannot pre-select stars or pre-fill text, and templated/steered reviews break Google's review policy (removals, listing penalties). User accepted a plain review QR.

**Decisions (user):** after *Mark received* the display shows Thank-you + review QR and **stays** until the cashier clicks **Close transaction** on POS — no DB change, it only publishes `idle`. Review link managed in a new Picklists tab.

**Backend:** `review-links` module (mirror of `upi-accounts`): `review_links` (label, url ≤2000 https-only, is_active; migration `20260913000005`), `/api/picklists/review-links` GET/POST/GET:uuid/PATCH under PICKLISTS perms. `pos-display`: `reviewUrl` (https, ≤2000) accepted on publish, `IDLE_STATE.reviewUrl=null`; the 8 s received auto-reset is now a **15 min safety net** (forgotten display / guessed code). jest **744/744**.

**Frontend:** `getReviewLinks`; Picklists → **Review links** (label + link). POS: loads links, sends the **first active** url as `reviewUrl` with the received publish; receipt screen's button is now **Close transaction** (publishes idle, starts a fresh sale). Display `ReceivedView`: thank-you + 200 px level-H logo QR + “Loved it? Scan to leave us a Google review”. vitest **395/395**. Live-verified on `/display/R54DEMO` (persisted >12 s, cleared by idle).

**CLOSED 2026-09-13:** user ran a sale with the real link, saw the QR, closed the transaction — 'working great'.

# SHIFT CLOSE #3 (2026-09-13)
R-53 + R-54 done. Board: 141 done / 0 doing / 1 blocked (R-52, parked to ~2026-10-13) / 2 todo (R-46, R-47). Committed + pushed: code on `context` and `main`, docs on `context`.

---

# R-55 — VENDOR BILL PHOTO: TAKE / GALLERY / REVIEW / RETAKE (2026-09-13, DONE — user-tested on device)

**Inventory first (user asked):** the app has exactly ONE file input — Trip detail → Add vendor → bill receipt (`FileReader` → base64 → `trip_vendors.receipt_image` TEXT). No other image/file columns anywhere (checked `information_schema`).

**User wants:** Take photo on every device + Choose from gallery; review the shot, retake if bad, then submit.

**Built:** `components/PhotoCapture.jsx` — two buttons → one review dialog (Cancel / Retake / Use photo). Camera = `getUserMedia` (rear cam on phones, webcam on laptops; stream attached by effect once the portalled `<video>` exists; tracks stopped on close/unmount). Any camera failure → plain message + the button becomes a native `<input capture="environment">` (phone camera app); no `getUserMedia` at all → native from the start. Gallery = plain file input → same review. `platform/imageResize.js` downsizes everything to ≤1600 px JPEG q0.82 (EXIF orientation via `createImageBitmap`), so a phone photo lands at ~200–400 KB. `platform/camera.js` holds constraints + error wording. Nothing changed server-side (`receipt_image`, 10 MB cap).

**Also:** two pre-existing test races fixed (LabelLayout acted before `loading=false`; POS helper polled for the 450 ms thank-you) + suite-wide `asyncUtilTimeout` 5 s — the suite now passes 3× in a row under load (405/405). Dev harness for the component at `/dev/photo-capture.html` (vite dev only).

**Verified:** harness in the browser: 3000×2000 PNG → review shows 1600×1067 JPEG (138 KB → 20 KB); camera blocked in the pane → fallback path shown. **CLOSED 2026-09-13:** user tested the real camera + gallery + review/retake on device — 'working really good'.

# SHIFT CLOSE #4 (2026-09-13)
R-55 done. Board: 142 done / 0 doing / 1 blocked (R-52, parked to ~2026-10-13) / 2 todo (R-46, R-47). Committed + pushed: code on `context` and `main`, docs on `context`.

**Follow-up (not ticketed):** if more uploads come, move files out of the DB (disk/object storage + attachments table) and migrate `receipt_image`.

---

# R-56 — SHEET CONFIGURATOR: TEMPLATES + PAGE SIZES A3/A4/A5/LETTER/CUSTOM (2026-09-13, DONE — user-tested)

**Constraint honoured:** `backend/app.js` is being edited by the user for production — template routes are mounted inside `barcode-layout.routes.js` (`/api/barcode-layouts/templates`), app.js untouched.

**Templates:** new `barcode_layout_templates` (uuid, name unique case-insensitively among live rows, `layout` JSONB snapshot, soft delete; migration `20260913000006`). GET (read perm) / POST (manage perm; 409 duplicate name, 400 if the layout doesn't fit) / DELETE. UI: **Templates** card at the top of *Configure barcode sheet* — pick + **Apply** (fills the form only; *Save layout* makes it print) + **Delete**; "Save the current settings as a template" + **Save as template**.

**Page sizes:** `A3` added (841.89 × 1190.55 pt); new `CUSTOM` with `page_custom_width_mm` / `page_custom_height_mm` (50–2000 mm, default 4 × 6 in). UI: Page size → *Custom size…* reveals Width / Height + a **Unit** picker (mm / cm / inch); values convert live and are **stored in mm**; the unit choice is remembered (localStorage). Geometry mirrors updated together (`resolvePageSizePt`, `LENGTH_UNITS`, `mmToUnit`/`unitToMm`).

**Verified:** jest **748/748**, vitest **410/410** (3 clean runs), build OK; live API: template saved → custom 4×6 in layout saved → preview PDF page 288 × 432 pt with 2×3 labels (eyeballed). **PENDING user test** in the browser.
**R-56 fix (user):** the 10 rows / 10 columns cap is gone — validator, UI and DB CHECK (migration `20260913000007`) now share `GRID_MAX = 100` as a typo guard only; the fit check is the real validation. A3 4×14 = 56 labels/page verified live.
**CLOSED 2026-09-13:** user tested templates, custom sizes and >10-row grids — working as expected.

# SHIFT CLOSE #5 (2026-09-13)
R-56 done. Board: 143 done / 0 doing / 1 blocked (R-52, parked to ~2026-10-13) / 2 todo (R-46, R-47). Committed + pushed: code on `context` and `main`, docs on `context`. The user's production-deployment work (app.js, .env.example, ecosystem.config.cjs, deploy/, docs/, .env.production, .gitignore) stays uncommitted by their choice.

**db:refresh fix (2026-09-13, no ticket):** `undo:all` failed on three of today's migrations. Grid views are now built by a column-aware `createGridViews()` helper (20260910000002) used by the R-48 and R-51 migrations; rollbacks of 0006/0007/0001 tolerate existing rows. Full refresh verified twice. Rule recorded in god-memory.

---

# R-57 — ADD-UNIT PAGE: INLINE NEW COLOUR / SIZE (2026-09-13, DONE)

**User:** on the scan/add-unit page, add a new colour or size straight from the dropdown; make them searchable. **Search already existed** (the app's cmdk Select filters as you type). **Built:** Colour + Size selects are now `creatable` for users with `picklists.create` — typing a name that matches nothing shows **+ Add colour "…"** / **+ Add size "…"**; picking it creates the picklist item, adds it to the list, selects it and toasts (so the auto-commit fires as usual once both are chosen). No backend change. vitest **413/413**.
**CLOSED 2026-09-13** (user: push). 

# SHIFT CLOSE #6 (2026-09-13)
R-57 done. Board: 144 done / 0 doing / 1 blocked (R-52, parked to ~2026-10-13) / 2 todo (R-46, R-47). All pushed. `main` still lacks the Windows deployment commits (6b6ca91 + 0efe6ed) — user's call.

---

# R-58 — THEME DRAWER: SHOP NAME + LOGO, CUSTOM ACCENT PICKER (2026-09-14, DONE — user-tested)

**User:** edit the shop name and logo/monogram from the top-right gear drawer; add a colour picker beside the accent presets.

**Branding (shared, server-side):** `branding` module → `app_settings` rows `shop_name` / `shop_logo` (data-URL ≤ 200 KB). `GET /api/branding` is **public** (sign-in page + `/display` need it before login; exposes only name + logo). `PUT` needs the new **`branding.manage`** permission (ADMIN; migration `20260914000001`). Receipts now read the shop name from settings (env `STORE_NAME` is the fallback) and print the uploaded logo instead of the monogram. Frontend `BrandingProvider` (fetch once + localStorage cache for first paint) feeds `ShopLogo`, the display, the POS UPI payee name, both QR centres and the branded receipt dialog.

**Drawer:** *Color preset* row gains a **Custom** swatch that opens the native colour picker; `ThemeProvider` derives `--primary` / hover (12 % darker) / foreground (black or white by luminance) / focus ring from the hex and sets them inline (presets clear them). Per-browser like the rest of the theme. New **Shop** section: name input, Upload / Change / Remove logo (client-resized to 256 px PNG), Save — read-only for users without `branding.manage`.

**Verified:** jest **753/753**, vitest **420/420**, build OK; live: `PUT` renamed the shop and the public `/display` showed it without login. **PENDING user test** in the drawer (rename, upload logo, custom colour).
**CLOSED 2026-09-14:** user found the desktop header still hard-coded (fixed: AppShell uses `useBranding`), then confirmed — 'working super nice'.

# SHIFT CLOSE #7 (2026-09-14)
R-58 done. Board: 145 done / 0 doing / 1 blocked (R-52, parked to ~2026-10-13) / 2 todo (R-46, R-47). Committed + pushed: code on `context` and `main`, docs on `context`. `main` still lacks the Windows deployment commits (6b6ca91, 0efe6ed) — user's call.

---

# R-59 — UNITS PAGE: SCAN A BARCODE TO FIND THE UNIT (2026-09-14, DONE — user-tested)

**Scan** button next to the Search box opens the same camera dialog POS uses (R-41 scanner). A detected code closes the dialog, clears the stock filter, drops the barcode into Search (grid filters to it) and toasts *Unit found* / *No unit with this barcode*. No backend change. vitest **421/421**.
**CLOSED 2026-09-14:** search bar + Scan button sized to match (Input `size="lg"` in a flex-1 wrapper); user tested the camera on device — works.

# SHIFT CLOSE #8 (2026-09-14)
R-59 done. Board: 146 done / 0 doing / 1 blocked (R-52, parked to ~2026-10-13) / 2 todo (R-46, R-47). Pushed to `context` + `main`.

---

# R-60 — DURABLE BACKUPS ON THE SHOP LAPTOP (2026-09-14, BUILT — awaiting user run of setup.cmd)

**User:** local DB backup twice a day (times asked at setup, 24h), a manual cloud upload to Google Drive (personal gmail) in date-wise folders, all wired by the setup script; the laptop already ran setup once → strictly additive, idempotent, a failing step must never touch what runs.

**Shape:** everything under `C:\IMPOC-backups\` (outside the repo; `IMPOC_BACKUP_ROOT` overrides). Shared `lib\backup-common.ps1`: verified dumps (`pg_dump -Fc` → `.partial` → `pg_restore --list` → rename), pruning, atomic `last-status.json`, monthly log, rclone lookup. `backup-local.ps1/.cmd` (14-day retention) — registered as two scheduled tasks by setup step 10 (validated `HH:mm,HH:mm` prompt or `-BackupTimes`; StartWhenAvailable; first backup taken immediately). `backup-cloud.ps1/.cmd` — fresh dump → `rclone copy --checksum` to encrypted `gdrive-crypt:YYYY/MM/DD/` + `.env` → `config/`, confirmed with `lsl`, 90-day cloud prune, token-expiry hint. `restore-db.ps1` — pick local/cloud, type-DB-name confirm, safety dump, pm2 stop → drop/create → `pg_restore` → migrate → pm2 start, failure prints the way back. Setup step 11 (`-SkipCloud` to bypass): rclone via winget or zip, Google sign-in (`drive.file` scope), crypt remote with generated password + salt **shown once** and written to `CLOUD-BACKUP-PASSWORD-SAVE-ME.txt`, connection test. Steps 10–11 are try/catch → warnings only, placed after pm2/firewall/startup. `update.ps1` pre-migration dump now uses the helper. Docs §8 rewritten.

**Verified here:** all 7 scripts parse under pwsh 7.6; the helper ran for real against the dev DB (181 KB verified dump, prune, corrupt-file rejection, status/log, no `.partial` leftovers). **Windows-only parts untested locally** (Task Scheduler, rclone install/sign-in) — user re-runs `setup.cmd` on the laptop.

**Scanner zoom (2026-09-14, no ticket — user request):** `BarcodeScanner` now takes a `zoom` prop, **default 2×**. Applied only when the camera reports a zoom capability (optical or digital) and clamped to its min/max; cameras without zoom get no stepper and no constraint. The ± stepper (0.5 steps) already existed. Tests +3 (vitest 424/424).

---

# R-61 — SCANNER ZOOM PRESETS 1× / 2× / 3× (2026-09-14, DONE — user-tested)

**User:** default 2× zoom when the camera supports it; never ask each time — three presets only, remembered on the device. **Built:** `platform/scannerZoom.js` (presets `[1,2,3]`, default 2, localStorage `impoc-scanner-zoom`); `BarcodeScanner` reads the stored preset on open, applies it only when `getCapabilities().zoom` exists (clamped), and shows three pill buttons (role group *Camera zoom*) in place of the old ± stepper; a tap saves + applies. No-zoom cameras: no control, no constraint. Shared by POS, intake and Units scanners. vitest **426/426**.
**CLOSED 2026-09-14:** user tested on device — working. Board: 147 done / 1 doing (R-60 backups, awaiting laptop run) / 1 blocked (R-52) / 2 todo (R-46, R-47).
