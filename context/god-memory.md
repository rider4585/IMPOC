# Memory — Michael (god)

_Append durable facts, decisions, and context below._

---

## 📌 Durable facts (pinned — never condensed)

Security fixes consolidated: SEC-CR-1 (money-out TOCTOU refund/cancel via CAS) @ 9523749, SEC-CR-2 (role escalation) @ 0b585ee, SEC-CR-3 (JWT forgery bind sub + pin HS256) @ 8ef04b4, SEC-H-1/9/10 (rate-limit/suspended-user/refresh-secure) @ 1924b6d.
RequestUuid SEC-M-3 (R-31, 96acfbd): 8 money-write functions require requestUuid in POST body (createSale/cancelSale/refundSale, createRental/cancelRental/processReturn, createExpense/cancelExpense). Frontend mint-on-intent, reuse on retry.
Database optimization R-32 (4ed6479): 5 grid views (v_sales/rentals/expenses/units/stocks_grid), 34 indexes (24 missing FK, sold_at/expense_date/start_date, 7 composite), 2 matviews (mv_dashboard_sales/rentals/expenses on 60s staleness, mv_inventory_snapshot), pagination MAX_PAGE_SIZE=200.
Dark mode still in codebase (index.css dark tokens present) but app decided light-only in R-08. User decision pending: strip dark or keep tokens.
Bug fixes in-session: logout-on-reload StrictMode race (26c0ead dedupedBootRefresh), modal focus-ring clip (421514b -mx offset), POS sticky bar bleed (408f626 top offset).
Spawn-request JSON lesson: command:'opencode' MANDATORY; forward-slash paths only (C:/ not C:\); BOM-free; objective as SCALAR STRING.
Worker patterns: check memory.md+worktree+outbox/.sent/bad-* for completion evidence (inbox done msgs can fail silently); breaker steer/constrain on reads=false-positives.
Test DB contention: impoc_test shared; jest --runInBand CAUSES failures; use default parallel; migrations don't run in jest (use test-setup.js).
Branch: framework/md-impoc (vendored md-framework on top of main @ 4e55c3a). Git HEAD 421514b. All 35 migrations UP on dev DB impoc_dev.

## 🗜 Condensed history

**Project IMPOC** (Inventory/POS/rental management, SHREE Fashion Store) on branch framework/md-impoc @ 421514b. Backend: Express 5 + Sequelize/Postgres (16.15), JWT+argon2 auth. Frontend: React 19 + Vite 8.2, @zxing barcode, minimals dark-primary Tailwind+shadcn light-only design.

**Completed: 110/111 cards, 1 in-flight (R-33).** All major phases delivered:
- Foundation (T-00..02, dace5ca): auth+cleanup+design system
- Backend core (T-06/08/10/12/14): units, sales, rentals, expenses, reports
- Frontend (T-03/05/07/09/11/13/15/16/21): admin/ops/service screens, dashboard, full QA
- Schema V2 (R-09..13): templates, vendor-scoped stocks, trips/vendors/stocks/units nav
- UI revamp (R-01..07, 4e55c3a): Tailwind restyle all screens
- Security remediations: SEC-CR-1..3 (money TOCTOU/role privesc/JWT forgery), SEC-H-1..10 (rate-limit/PII/IDOR/localStorage/money>2^53), SEC-M-1..10 (idempotency/scoping/validation/delivery), SEC-L-1..8 (timing/creds/error-masking). All integrated (796ea5b..648318c). Backend reviews (R-27/28, hive/BACKEND-REVIEW-FINDINGS.md, hive/POSTGRES-REVIEW-FINDINGS.md) confirmed + fixed. Backend 669/669 jest (38 suites, 3 pre-existing auth failures eliminated after SEC fixes).
- UI/UX remediation (R-26, 1182611): 25 UX cards (3C/8H/10M/4L findings) all implemented. Frontend 294/294 vitest.
- Database optimization (R-32, 4ed6479): 5 grid views, 34 indexes (24 FK + dates + 7 composite), matviews (mv_dashboard_*, mv_inventory_snapshot), pagination MAX_PAGE_SIZE 200.
- Bug fixes (26c0ead, 421514b, 408f626): logout-on-reload StrictMode (dedupedBootRefresh + isMountedRef re-arm), modal focus-ring clip (-mx offset in overflow), POS sticky bar bleed (top offset by main padding).

**Key architectural locks:** Money=integer paise, never UPDATE completed, append-only reversals, partial-unique backstop indexes. Auth=JWT+httpOnly cookie+session_id separate from sub, no localStorage tokens. Permissions=role-based+per-resource scopes, ADMIN-only privileged-role. Transactions=FOR UPDATE + CAS on status, reuse tx where possible. Idempotency=requestUuid on money-writes (SEC-M-3, R-31, 96acfbd, 8 functions), mint-on-intent reuse-on-retry. Rentals=days+deposit refunded on return minus damage, late-fees at return. POS=dual-mode retail/rental, single cart. Dashboard=MATVIEW REFRESH CONCURRENTLY, 60s staleness check.

**Test baselines:** Backend 669/669 (35 suites post-consolidation from 38), frontend 294/294 vitest (25 files post-UX), vite build PASS (>500kB chunk pre-existing non-blocking). All 35 migrations UP on dev DB (20260903000001..20260910000003).

**Critical protocols:** (1) Spawn-request JSON: ASCII-only, NO BOM, forward-slash paths (C:/ not C:\), command:'opencode' MANDATORY, cwd required, objective=SCALAR STRING. (2) Worker patterns: check memory.md+worktree+outbox/.sent/bad-* (done msgs can fail silently); breaker steer/constrain on rapid reads=known false-positives; NO reply to scheduler (bounces). (3) Test contention: impoc_test shared; jest --runInBand CAUSES failures; use default parallel; migrations don't run in jest. (4) Integration: verify worktree suite → commit on agent branch → ff-merge to framework/md-impoc → re-verify MAIN. (5) Frontend vitest runs from frontend/ subdir; backend jest needs NODE_OPTIONS='--experimental-vm-modules' npx jest --forceExit. (6) Money ALWAYS BigInt in SQL + String in DTO (never Number). (7) RequestUuid on all 8 money-write POST paths (SEC-M-3). (8) Focus rings need -mx offset in overflow; sticky elements offset top by parent padding. (9) Dev creds in postman/.env.template/.env.example now 'Impoc-Devseed-2026!' (not stored in code beyond examples, per L-4). (10) Auth-session: now separate from JWT sub; JWT bound to user_id (SEC-CR-3, commit 8ef04b4). (11) Floor guard: sellingPricePaise below floorPricePaise returns 400 'Price cannot be below floor price' (R-30, 4ed6479).

**Unresolved:** (1) Dark mode tokens still in index.css (user chose light-only; decision pending strip). (2) AppShell nav collapsible + focus-ring width (ring-2/offset-2 -> ring-1/offset-1) parked backlog. (3) DashboardPlaceholder vs full Dashboard.jsx (T-15 delivered screens but placeholder may still exist; verify). (4) Code-splitting chunk warning (pre-existing, non-blocking).

**Current state:** framework/md-impoc @ 421514b, working tree clean (untracked: colors.zip, colors/, frontend/doc/, tunnels.json, worktrees/). Kanban: 111 tasks, 110 done, 1 in-flight (R-33 expense-type picklist). Fleet: god only, worker-r33 active. All migrations applied to impoc_dev. No blocked/unowned cards.

## Recent

## [2026-09-10 ~04:10Z] R-34 DONE — collapsible desktop nav sections (user request, god did it)
- User: "plan and do one task, please make the nav items collapsable" = the parked AppShell nav-collapsible item. god implemented directly (small self-contained AppShell.jsx change; no file conflict with the running R-33 worker which touches expenses/admin/picklist files).
- Impl (commit 5a2ad64): desktop left-rail railSection header is now a <button aria-expanded aria-controls> with a ChevronDown (rotates -90 when collapsed); click toggles that section's items (conditional render). Collapsed map persisted in localStorage key 'appshell:nav-collapsed' (loadCollapsedSections + toggleSection, both try/catch). Default expanded so existing item-presence tests stay green. Mobile flat tab bar untouched (no groups there). Added AppShell collapse/expand test + localStorage.clear() in beforeEach (state leaks across tests otherwise). Frontend 295 green, build passes.
- Inbox: filed a stale [worker spawn rejected] notice for the FIRST malformed r33 spawn (already fixed; worker-r33 is live). 
- Board: R-34 done. Now 111 done / 1 doing (R-33 in flight).

## [2026-09-10 ~04:20Z] R-35 PLANNED (not dispatched) — POS UPI QR checkout flow (user request)
- User: on POS rename 'Charge' -> 'Checkout'; clicking opens payment step. UPI method -> show UPI QR with amount, customer scans, 'Mark received' -> then 'Thank you' replaces the scanner. Cash -> just 'Mark as received'. UPI id configurable from a picklist. Include important UPI params. "just plan, don't work on it."
- GROUNDED: POSScreen.jsx checkout Card (line ~631-711): CustomerPicker + paymentMethod Select (from payment-methods picklist, default 'Cash') + 'Charge' button -> handleCheckout creates sale immediately (SEC-M-3 checkoutKeyRef idempotency). SHOP_NAME const in components/ShopLogo.jsx = 'SHREE Fashion Store'. NO qr lib installed. Select + Dialog primitives exist.
- KEY DESIGN in card R-35: sale is created on 'Mark received' (not on Checkout click) so a cancelled UPI leaves no sale; sale number unknown pre-create so UPI tr/tn use the checkout idempotency key. UPI accounts = a NEW picklist needing TWO fields (label + vpa), so FlatPicklistManager needs an extra-field variant. upi://pay params pa/pn/am/cu=INR/tn/tr. Manual 'Mark received' (no gateway verify). SALE mode only.
- SEQUENCING: R-35 deps R-33 (soft) — both edit picklistsApi.js + PicklistManagementScreen.jsx; dispatch R-35 only AFTER R-33 integrates, to avoid merge conflicts. Card is todo/unassigned; NOT dispatched (user said plan only). Board R-35 section added. 113 cards: 111 done / 1 doing (R-33) / 1 todo (R-35).

## [2026-09-10 ~04:25Z] R-33 INTEGRATED (expense-types picklist + expense form dropdown)
- worker-r33 done msg: backend module+model+migration(20260910000004, ESM export - heeded warning)+seeder(20260910000000, Rent/Travel/Food/Misc)+mount /api/picklists/expense-types (auth read, PICKLISTS.CREATE/UPDATE write); frontend picklistsApi getExpenseTypes + admin tab + ExpenseFormDialog Category Input->Select. 13 backend + 3 frontend tests.
- GOTCHA: isolate:true did NOT create a real git worktree. worktrees/worker-r33-expense-type-picklist/ toplevel = MAIN repo on framework/md-impoc; worker wrote changes straight into the MAIN working tree (uncommitted). `git worktree list` showed only main; the agent/worker-r33 branch had 0 commits. So integration = commit in place on framework/md-impoc (no branch merge). Watch for this: recent temps write to main working tree, not an isolated worktree.
- VERIFIED in main: backend jest 682/682 (39 suites), frontend vitest 298/298, build PASS. Ran db:migrate (already applied) + seeded expense-types on dev; live API GET returns Misc/Food/Travel/Rent.
- Committed d815841 (staged R-33 files explicitly; left human artifacts colors.zip/colors//frontend/doc//tunnels.json untracked). tasks R-33 -> done. inbox filed.
- R-35 (POS UPI QR) soft-deps R-33 (shared picklistsApi.js + PicklistManagementScreen.jsx) - now unblocked but still PLAN-ONLY per user; leave todo until human says go.
- Board: 112 done / 0 doing / 1 todo (R-35). Floor: god + worker-r33 (will be reaped, done).

## [2026-09-10 ~04:35Z] R-35 amended — public customer-display page (SEPARATE device, user decision)
- User asked to add a no-auth customer-facing page that mirrors POS payment state: show UPI QR when generated, thank-you animation when marked received, ambient animation otherwise.
- ASKED the architecture question (same-browser vs separate device) -> user chose SEPARATE DEVICE (tablet/phone). => needs a PUBLIC backend live channel (SSE), not BroadcastChannel.
- Grounded: App.jsx currently wraps ALL routes in RouteGuard+AppShell (no public route exists; SignIn is rendered by RouteGuard when signed out). So a public /display route requires a top-level Routes split outside the guard. framer-motion already a dep (Dialog). BroadcastChannel unused.
- Plan folded into R-35 details + board: pairing code per terminal -> /display/:code; backend POST /api/pos-display/:code (auth SALES.CREATE) publish + GET /api/pos-display/:code/stream (PUBLIC no-auth) SSE with late-join current-state; in-memory ephemeral Map; minimal payload {status,method,amountPaise,upiUri} (no PII/cart); POS builds upiUri (VPA from UPI-accounts picklist) and posts on each transition; display renders QR from upiUri + framer states (idle/UPI/cash/received). Only subscribe is public; publish auth-gated to prevent fake-QR injection.
- STILL PLAN ONLY (R-35 todo, deps R-33 which is now integrated). Not dispatched. Board 112 done / 0 doing / 1 todo (R-35).

## [2026-09-10 ~14:35Z] New session; R-36 planned (system-wide modal/form polish) + standup
- worker-r33 reaped (R-33 done+integrated last session, commit d815841). Floor: god only.
- User asked (PLAN ONLY) a system-wide fix to shared UI primitives. Created R-36 (todo, unassigned):
  1. Label/control spacing: Input.jsx space-y-1.5->space-y-2, Select.jsx gap-1.5->gap-2 (Create trip modal uses generic <Input label>; TripsScreen.jsx:258-260 confirmed). Fixes all forms.
  2. Modal scroll already exists (Dialog body overflow-y-auto + modal max-h-[85vh]); hide default scrollbar + add reusable themed .themed-scrollbar (webkit ::-webkit-scrollbar/-thumb + firefox scrollbar-color) in index.css; apply to Dialog body + Select list/sidebar. (No scrollbar CSS exists today.)
  3. Dropdown over modal: Select popover is inside the modal's overflow-y-auto body at z-50 == Dialog z-50 -> clipped + same z-plane. Fix = portal popover to document.body, position from trigger rect, z-index above modal (scale: modal 50, popover 60+); preserve outside-click/Esc/cmdk-keyboard/reposition-on-scroll.
- BOUNDARY: shared-component ripple -> full vitest+build+visual verify (POS checkout/expense modal w/ Select; overflowing modal). Not dispatched.
- Standup (14:31Z) filed to .done; no scheduler reply (convention). Board updated. 114 cards: 112 done / 0 doing / 2 todo (R-35, R-36).
- Pending user GO to spawn: R-35 (POS UPI flow + public SSE customer-display, separate device) and R-36. R-35 deps R-33 (met). Both plan-only.

## [2026-09-10 ~14:45Z] R-37 planned — reusable DataGrid, no page-scroll, per-column sort/filter/search (user, PLAN ONLY)
- Trigger: Trips grid scrolls the whole page after many records; user wants a proper grid package + internal-only scroll + filter/search/sort per available column on EVERY grid + future grids.
- GROUNDED: grids use a hand-rolled shadcn Table primitive (frontend/src/components/ui/Table.jsx: div overflow-auto + <table>, sticky-head + frozen-col helpers). ~12 screens use it (Trips/Stocks/Units/Vendors/VendorDetail/TripDetail/Customers + admin Users/Roles/Permissions/FlatPicklist; SaleReceipt is a static receipt). NO grid package installed. Page scrolls because content overflows AppShell <main> overflow-y-auto (main p-6).
- PLAN (R-37, todo/high): shared <DataGrid> on @tanstack/react-table (headless, React19-ok, keep Tailwind theme; NOT ag-grid/MUI). Screen layout flex-col + grid flex-1 min-h-0 overflow-auto sticky header so only the grid body scrolls. Per-column sort/filter + global search via TanStack sorting/columnFilters/globalFilter; column defs per screen declare sortable/filterable + cell renderer (preserve formatPaise/Badge/action buttons/RBAC/empty+loading). Baseline client-side; API designed to flip to server-side (manual) using R-32 grid views + limit/offset for huge tables (phase 2). Reuse R-36 .themed-scrollbar on grid body. Migrate all grids + 'how to add a grid' note; standard for future grids.
- BOUNDARY: large shared change ~12 screens; may phase (DataGrid+scroll+2-3 grids first) / split at dispatch. Full vitest+build. Not dispatched.
- Board now 115 cards: 112 done / 0 doing / 3 todo (R-35 POS UPI+display, R-36 modal/form polish, R-37 DataGrid). All plan-only awaiting GO. Floor: god only.

## [2026-09-10 ~14:50Z] R-38 planned — app-wide themed scrollbar (user, PLAN ONLY)
- User: change the default scrollbar look app-wide to match our style. Created R-38 (todo/low): CSS-only in index.css, ::-webkit-scrollbar/-thumb/-track (thin/rounded/token colours/hover) + Firefox scrollbar-width/scrollbar-color; global (html/body + scroll containers); keep visible (restyle not hide). No scrollbar CSS exists today.
- DEDUP: R-38 is the single source of truth for scrollbar styling; R-36's 'themed modal scrollbar' sub-item and R-37's grid-body scrollbar REUSE it (do not define their own). Noted in all three cards' intent.
- Board now 116 cards: 112 done / 0 doing / 4 todo (R-35, R-36, R-37, R-38), all plan-only awaiting GO. Floor: god only.

## [2026-09-10 ~14:55Z] R-39 planned — collapsible sidebar rail (icon-only) (user, PLAN ONLY)
- User: side navbar collapsible; collapsed = icons only, expanded = icons + tab names. Created R-39 (todo/medium).
- Scope: AppShell.jsx desktop <nav> (currently w-60). Toggle (chevron) + localStorage persist (same pattern as R-34). Collapsed ~w-16 icon-only, names via title/aria-label tooltip, active highlight kept, brand+SignOut collapse to icon. Expanded unchanged.
- DISTINCT from R-34 (per-section group collapse): when rail is icon-collapsed, section grouping/headers don't apply (flat icon set, optional divider); section-collapse UI shows only in expanded rail. They coexist.
- Desktop only; mobile bottom tab bar unchanged. Not dispatched.
- Board now 117 cards: 112 done / 0 doing / 5 todo (R-35 POS UPI+display, R-36 modal/form polish, R-37 DataGrid, R-38 scrollbar, R-39 sidebar rail). All plan-only awaiting GO. Floor: god only.

## [2026-09-10 ~15:00Z] R-38 DISPATCHED (user said 'start R-34' but via the question chose R-38)
- Clarified: R-34 already done+committed (5a2ad64); user picked R-38 (app-wide themed scrollbar) to start.
- Spawn worker-r38-themed-scrollbar (character phyllis, command opencode, cwd C:/projects/IMPOC-main forward-slash valid JSON). ACCEPTED, live. R-38 -> doing.
- Contract: CSS-only in frontend/src/index.css (webkit ::-webkit-scrollbar/-thumb/-track + firefox scrollbar-width/color, theme tokens, global, restyle-not-hide). Single source of truth (R-36/R-37 reuse later). Uncommitted for god to integrate; build must pass.
- On done: verify build + eyeball, integrate on framework/md-impoc, mark R-38 done. Watch outbox/.sent/bad-* for dropped done msgs.
- Board: 112 done / 1 doing (R-38) / 4 todo (R-35, R-36, R-37, R-39).

## [2026-09-10 ~15:05Z] SPAWN DEFAULT CHANGED (user): claude code + Haiku
- User: new agents should use Claude Code with the Haiku model. STANDING DEFAULT for all FUTURE spawn-requests from now on:
  - "command": "claude"   (NOT opencode)
  - "provider": "claude"
  - "model": "claude-haiku-4-5-20251001"   (Haiku 4.5; id from session env)
- VERIFIED claude CLI is installed now: /c/Users/Rushikesh Naik/AppData/Roaming/npm/claude . The old memory note "command:claude FAILED / not installed" (2026-09-03) is STALE — superseded.
- Spawn-request fields (PROTOCOL.md 110-112): command (engine CLI), provider (claude|codex|...), model (override). cwd forward-slash + valid JSON via node still required.
- Currently-running worker-r38-themed-scrollbar stays on opencode (already spawned); the new default applies to the NEXT spawn. If a claude+haiku spawn fails, fall back to opencode and tell the user.

## [2026-09-10 ~15:10Z] R-38 respawned under claude+haiku (user requested)
- User asked to despawn the opencode R-38 worker and respawn with the new config. NO god-side despawn CLI exists (COMMANDS.md /stop = own session only; harness owns lifecycle). Couldn't hard-kill.
- Sent stand-down inform to worker-r38-themed-scrollbar (abort, don't edit files, report done). It never picked up (backlog grew 2, 'no activity yet') but index.css stayed CLEAN — no stray edit.
- Spawned replacement worker-r38b-themed-scrollbar-claude with command:claude, provider:claude, model:claude-haiku-4-5-20251001, isolate:true (FIRST use of the new claude+haiku default — spawn ACCEPTED, worker live). Concurrency cap allows 2 (both on floor).
- R-38 card -> doing, assignee worker-r38b-themed-scrollbar-claude. Old opencode worker left to be reaped by harness; if it ever emits a stray index.css edit, DISCARD it at integration (I'm sole integrator; only merge the claude worker's work).
- FIRST claude-engine spawn on this floor worked -> confirms the new default is viable.

## [2026-09-10 ~15:15Z] R-38 INTEGRATED (built by claude+haiku worker)
- worker-r38b-themed-scrollbar-claude DONE. THIS TIME isolate:true made a REAL worktree (worktrees/worker-r38b-...; dirty, 0 commits ahead) — claude engine respects isolation (unlike the earlier opencode temps that wrote to main tree). index.css in main stayed clean; change was in the worktree.
- Diff reviewed: clean scrollbar CSS in frontend/src/index.css — html{scrollbar-width:thin;scrollbar-color:var(--border-strong) transparent} + ::-webkit-scrollbar 10px, thumb var(--ink-faint) rounded inset border, hover --border-strong, transparent track/corner. Added missing trailing newline. Committed 8375c9a in worktree branch, merged --no-ff b0dbc55 into framework/md-impoc. Build PASS in main.
- tasks R-38 -> done. Worktree removed. Inbox (done + worktree-preserved inform) filed to .done.
- Old opencode worker-r38-themed-scrollbar: user is killing it manually; it did NO work (index.css clean before merge). Harmless; harness/user reaps.
- Board: 113 done / 0 doing / 4 todo (R-35, R-36, R-37, R-39). R-38 = first successfully integrated claude+haiku deliverable — new spawn default validated end-to-end.

## [2026-09-10 ~15:25Z] DISPATCHED R-36+R-37+R-39 to ONE haiku worker (user)
- User: spawn one agent (haiku) to do R-36, R-37, R-39. All frontend, mostly disjoint files -> one worker avoids inter-worker conflicts + quota-friendly.
- worker-r36-r37-r39-frontend-batch (character kevin, command claude, provider claude, model claude-haiku-4-5-20251001, isolate true). ACCEPTED, live. Cards -> doing (assignee worker-r36-r37-r39-frontend-batch).
- Contract order: R-36 (Input/Select gap + portal Select popover above modal z + reuse R-38 scrollbar on Dialog) -> R-39 (AppShell sidebar icon-rail collapse, localStorage, coexist R-34) -> R-37 (LARGEST: @tanstack/react-table DataGrid + internal-only scroll + sort/filter/search + migrate ~12 grids; phase if low budget, report remaining). All UNCOMMITTED for god; build+vitest green after each; full specs in tasks.json cards.
- RISK: big batch on Haiku (esp. R-37). Watch for breaker/context limits; expect phased/partial R-37. On done: verify build+vitest, integrate per-task, mark done individually; check outbox/.sent/bad-* for dropped msgs.
- Board: 113 done / 3 doing (R-36/37/39) / 1 todo (R-35). Floor: god + the batch worker.

## [2026-09-10 ~15:20Z] R-36 + R-39 DONE, R-37 PARTIAL (foundation) — haiku batch integrated
- worker-r36-r37-r39-frontend-batch (claude+haiku) done in a REAL isolated worktree. Merged c324759 -> 11a58ae into framework/md-impoc. npm install --legacy-peer-deps in MAIN frontend (pulled @tanstack/react-table@9.2.4 — verified real + installed, build compiles DataGrid). Build PASS + vitest 298/298 (28 files) in main.
- R-36 DONE: Input space-y-2 / Select gap-2; Select popover PORTALED to document.body above modal (z-60 vs dialog z-50) via new frontend/src/lib/usePopoverPosition.js, positioned from trigger rect, outside-click/Esc preserved; reuses R-38 themed scrollbar. SearchableSelect.test updated for portal.
- R-39 DONE: AppShell desktop rail collapse w-60<->w-16 (icons-only + tooltips), RAIL_COLLAPSED_KEY localStorage, coexists with R-34 section collapse.
- R-37 PARTIAL -> back to TODO (unassigned): DataGrid component built (frontend/src/components/ui/DataGrid.jsx, @tanstack/react-table@9.2.4) but NO screen migrations. Card details prepended with STATUS: foundation merged, ~12 grid migrations + per-screen no-page-scroll layout + how-to note REMAIN. DataGrid is additive (no screen imports it) so merging was safe/no regression.
- NOTE: @tanstack/react-table is v9.2.4 (not the more common v8). It installed + DataGrid built against it OK; if grid-migration work later hits API mismatches, check v9 API. package.json committed via merge; lockfile not separately tracked/changed.
- Board: 115 done / 0 doing / 2 todo (R-35 POS UPI+display, R-37 grid migrations remainder). Floor: god only (batch worker ended, worktree reclaimed).

## [2026-09-10 ~15:35Z] DISPATCHED R-40 (nav polish) + R-37 (grid migrations) to one haiku worker (user)
- User: take R-37 next + small navbar change — collapse toggle should be a CIRCULAR arrow button on the sidebar RIGHT EDGE (minimals.cc/dashboard style) instead of the separate bottom button; and use a logout ICON (not '→') for the collapsed Sign Out.
- Created R-40 (nav polish): AppShell.jsx — remove bottom toggle (~lines 352-357), add absolute rounded-full edge button (-right-3 top-7) with ChevronLeft/ChevronRight flip; collapsed Sign Out '→' (~line 349) -> <LogOut/> from lucide. Desktop only.
- worker-r40-r37-frontend (kevin, claude+haiku, isolate). Order: R-40 FIRST (small, guaranteed) then R-37 (migrate ~12 grids onto the already-merged DataGrid + no-page-scroll layout; phase + report remaining if low). Both UNCOMMITTED; build+vitest after each. Cards -> doing.
- Board: 115 done / 2 doing (R-40, R-37) / 1 todo (R-35). Floor: god + worker-r40-r37-frontend.
- On done: verify build+vitest, integrate; R-37 likely partial again (12 grids on haiku) -> re-open remainder if so.

## [2026-09-10 ~15:40Z] R-40 DONE; R-37 unblocked (tanstack v8) + re-dispatched
- worker-r40-r37-frontend: R-40 DONE (nav edge circular toggle + LogOut icon), R-37 BLOCKED. Merged R-40 752a2e0 (298/298 + build). 
- R-37 BLOCK ROOT CAUSE: DataGrid.jsx imports v8 API (useReactTable/getCoreRowModel/getSortedRowModel/getFilteredRowModel/flexRender) but batch worker had installed @tanstack/react-table ^9.2.4 which doesn't export those. Earlier build 'passed' only because NO screen imports DataGrid (tree-shaken). FIX (god, commit b947b3b): npm pkg set @tanstack/react-table ^8.21.3 + install; verified all 5 exports resolve; build green. LESSON: an unused component's bad imports won't fail the build — a 'foundation merged + build passes' claim doesn't prove the component compiles until something imports it.
- R-40 -> done. R-37 -> re-dispatched to worker-r37-grid-migrations (oscar, claude+haiku): wire DataGrid into one screen first (confirm v8 compiles), then migrate TripsScreen/StocksScreen/UnitsScreen/Vendors/VendorDetail/TripDetail/Customers/admin Users/Roles/Permissions/FlatPicklist + no-page-scroll layout; keep dep at v8; phase + report remaining. UNCOMMITTED.
- Board: 116 done / 1 doing (R-37) / 1 todo (R-35). Floor: god + worker-r37-grid-migrations.

## [2026-09-10 ~15:45Z] Hourly standup (15:31Z)
- Floor: god + worker-r37-grid-migrations (oscar, claude+haiku) — active, breaker healthy, ctx 62%, progressing on grid migrations. Not stalled.
- Board: 118 cards — 116 done / 1 doing (R-37, owned by worker-r37-grid-migrations) / 1 todo (R-35 POS UPI+display). Nothing blocked/unowned.
- No scheduler reply (no addressable scheduler; convention). Filed to .done.

## [2026-09-10 ~15:50Z] R-37 PHASE 1 integrated (3 grids)
- worker-r37-grid-migrations done (EMPTY body — inspected worktree myself). Migrated TripsScreen, StocksScreen, UnitsScreen to DataGrid (+2-line DataGrid.jsx tweak). Merged into framework/md-impoc. Build + vitest 298/298 green in main — DataGrid now compiles into the graph via 3 real screens (v8 pin b947b3b validated in practice).
- R-37 -> todo (unblocked, partial). REMAINING 8 grids: VendorsScreen, VendorDetail, TripDetailScreen, CustomersScreen, admin UsersScreen/RolesScreen/PermissionsScreen/FlatPicklistManager. Card details updated with phase-1-done + remaining list. Keep tanstack v8.
- Inbox filed (done + worktree-preserved). Worktree reclaimed.
- Board: 116 done / 0 doing / 2 todo (R-35 POS UPI+display, R-37 remaining 8 grids). Floor: god only.
- Pattern working: phased big task across haiku workers, ~3 grids per pass; re-dispatch remaining when user says go.

## [2026-09-10 ~16:00Z] R-37 finish dispatched: filter redesign + remaining grids
- BUG FIX (god, commit 56ff324): TripsScreen 'setTotal is not defined' — DataGrid migration left dangling setTotal() calls after dropping the total state (unused; DataGrid shows own count). Removed. 298/298 + build green.
- USER filter redesign folded into R-37: remove the universal/global search from DataGrid top; filtering is PER-COLUMN with typed controls — text->input, number->input, date->date, picklist->DROPDOWN of options (not search). Column def gains filter:{type, options?}. Apply to the 3 done grids (Trips/Stocks/Units) too.
- Dispatched worker-r37-finish-filters (oscar, claude+haiku): Step1 DataGrid filter redesign, Step2 update Trips/Stocks/Units, Step3 migrate remaining 8 (Vendors/VendorDetail/TripDetail/Customers/admin Users/Roles/Permissions/FlatPicklist). Keep tanstack v8. Phase + report remaining. UNCOMMITTED.
- Board: 117 done / 1 doing (R-37) / 1 todo (R-35). Floor: god + worker-r37-finish-filters.

## [2026-09-10 ~16:10Z] R-37 phase 2 integrated (5/11 grids) + final pass dispatched
- worker-r37-finish-filters DONE (partial): DataGrid global-search REMOVED, per-column typed filters (text/number/date/picklist-dropdown) via column.filter descriptor. 5/11 grids: Trips, Stocks, Units, Vendors, Roles. Merged into framework/md-impoc, 298/298 + build green (my setTotal fix 56ff324 survived merge). Generic registry/how-to doc NOT added (addendum arrived too late).
- Re-dispatched worker-r37-final (oscar, claude+haiku): PART A = last 6 grids (Permissions, FlatPicklistManager, Customers, Users [preserve role-assign dialog], VendorDetail, TripDetail [main grid only]); PART B = generic polish (filter-type REGISTRY type->{renderControl,filterFn}, picklist-options-from-distinct helper, 'How to add a grid' doc). Keep v8. UNCOMMITTED.
- Board: 117 done / 1 doing (R-37) / 1 todo (R-35). Floor: god + worker-r37-final.
- Pattern: haiku ~2-3 net grids/pass; this is pass 3 of R-37. Expect maybe one more pass to fully finish.

## [2026-09-10 ~16:20Z] R-37 fix routed to worker-r37-final: Units Status column had no filter
- User: Units grid Status column shows no filter. ROOT CAUSE: UnitsScreen status column (accessorKey 'status') has NO filter descriptor -> DataGrid renders no filter for it (a cell-renderer column without column.filter silently gets no filter). Also a leftover standalone status <Select> (~lines 206-212, server-side) duplicates filtering.
- Sent addendum to the RUNNING worker-r37-final: add filter:{type:'picklist', options from UNIT_STATUSES} to the status column; remove the redundant external status Select; GENERIC RULE: every enum/status/role/category column must declare filter:{type:'picklist'} (explicit options or the distinct-values helper). Apply to remaining grids too. No new card; folded into R-37.
- GENERIC-GAP note: the missing-filter-descriptor -> no-filter behavior is exactly why the registry/distinct-options helper (Part B) matters; a status column should default to picklist.

## [2026-09-10 ~16:30Z] R-37 phase 3 integrated (5 grids) + regressions fixed + final pass dispatched
- worker-r37-final (empty done) migrated 5 grids: Permissions, FlatPicklist, Users, Customers, TripDetail. Merged. Full vitest CAUGHT 5 failures -> 2 real regressions in TripDetailScreen: (1) vendorColumns useMemo placed AFTER early returns -> 'Rendered more hooks than during previous render' (moved it above guards via node script); (2) Table import dropped but stocks-by-vendor section still uses <Table> -> ReferenceError (re-added Table family import). Fixed forward, commit 7cf1a7f. 298/298 + build green. LESSON: always run FULL vitest after a grid migration merge — build passing doesn't catch hooks-order or runtime ReferenceErrors in untested-by-build paths; and the empty-done worker reports mean I must verify everything myself.
- R-37 now 10/11 grids done. Units status-filter fix STILL not applied (mid-flight message missed). 
- Re-dispatched worker-r37-finish-final (haiku) with 3 baked tasks: (1) Units status picklist filter + remove leftover status Select; (2) migrate last grid VendorDetail; (3) Part B generic polish (filter registry, distinct-options helper, how-to doc, enum=picklist rule). Keep v8.
- Board: 117 done / 1 doing (R-37) / 1 todo (R-35). Floor: god + worker-r37-finish-final.
- LESSON: bake fixes into the SPAWN objective, not a mid-flight message — the earlier status-filter note sent to a running worker was not acted on.

## [2026-09-10 ~16:45Z] R-37 COMPLETE — all 11 grids on generic DataGrid
- worker-r37-finish-final COMMITTED a53607b (1 commit ahead — first haiku worker to commit cleanly). Merged into framework/md-impoc. 298/298 + build green.
- Delivered: Units status column picklist filter (VERIFIED: filter:{type:'picklist',options:UNIT_STATUSES} at UnitsScreen.jsx:150) + removed redundant standalone status Select; VendorDetail migrated (last grid); GENERIC POLISH — DataGrid.jsx FILTER_REGISTRY (line 55, filterType->{renderControl,filterFn}), derivePicklistOptions() (line 110, auto options from distinct values), 'How to add a grid' doc (top of file), GENERIC RULE documented (enum/status/role/category columns MUST be filter:{type:'picklist'}).
- ALL 11 GRIDS migrated: Trips, Stocks, Units, Vendors, Roles, Permissions, FlatPicklist, Users, Customers, TripDetail, VendorDetail. (SaleReceipt static, left.) Global search removed; per-column typed filters everywhere; internal-only scroll + sticky header + themed scrollbar (R-38).
- Stale worker-r37-final inbox msgs (done + worktree-preserved) filed — already integrated in phase 3. Worktrees reclaimed.
- Board: 118 done / 0 doing / 1 todo (R-35 POS UPI+display). Floor: god only. R-37 CLOSED across 4 haiku passes + god regression fixes (56ff324 setTotal, 7cf1a7f TripDetail hooks+Table).

## [2026-09-10 ~22:40Z] Grid page-scroll fixes (Customers/Picklists/Expenses) + Sales->DataGrid (god, personal, commit d2ec2a4)
- Customers still scrolled: my earlier node replace hit the FIRST 'mx-auto flex max-w-[1100px]...' occurrence = the LOADING-branch return, not the main one. LESSON: multiple returns per component — target the MAIN return. Fixed main return h-full min-h-0 overflow-hidden + gap-4 wrapper flex-1 min-h-0 + DataGrid className flex-1.
- Picklists = tabbed PicklistManagementScreen with FlatPicklistManager panes inside <Card> (not flex). Fix: root h-full min-h-0 overflow-hidden + wrap the pane conditionals in one `flex min-h-0 flex-1 flex-col overflow-y-auto` container (whole pane scrolls internally; grid sticky header sticks to this scrollport). Avoided Card surgery.
- Expenses = a <ul> list, NOT a DataGrid (was never in the 11). Fix: root constrained + Card wrapped in internal-scroll container. (Could migrate to DataGrid later for per-column filters — not done; user only asked to stop page scroll.)
- Sales = SalesListScreen converted from <ul> to DataGrid: columns Sale#(text)/Date(date)/Customer(text)/Lines/Status(picklist)/Total(number)/Actions; internal scroll layout. DataGrid now exported from components/ui/index.js (was only importable via direct path).
- 298/298 + build green. Standup (16:31Z) filed.
- GRID STATUS: inventory grids good (user confirmed). Now also fixed: Customers, Picklists, Expenses(list), Sales(new grid). VendorDetail/TripDetail = detail pages, normal page scroll (grid embedded). Board unchanged: 118 done / 1 todo (R-35).

## [2026-09-10 ~17:50Z] R-41 (done) — barcode scanner Windows Chrome fix, ticketed after the fact
- User asked to create a ticket for the scanner fix already made. Added R-41 (done, assignee god). Cause: DecodeHintType.TRY_HARDER triggered zxing 1D 90deg rotate -> HTMLCanvasElementLuminanceSource.rotate 'Could not create a Canvas element' on Windows Chrome (@zxing/browser 0.2.1); fine on macOS/iOS. Fix: removed TRY_HARDER (kept CODE_128), commit 06033fa, 298/298+build green. Awaiting user verify on Windows.

## [2026-09-10 ~18:00Z] R-41 reopened -> doing: cross-platform scanner + post-login permission primer
- TRY_HARDER removal (06033fa) fixed the canvas crash but Windows Chrome still doesn't DECODE; console now logs NotFoundException per frame = normal no-barcode result, so frames aren't yielding a resolvable Code128 (likely laptop fixed-focus webcam / resolution / permission). Can't reproduce here — verification is user-only across iOS/macOS/Windows.
- Camera setup (BarcodeScanner.jsx ~465): getUserMedia video facingMode environment ideal, 1920x1080 ideal, 30fps; applies continuous focusMode + zoom if capabilities allow; decodeFromVideoElement continuous loop; callback only reads result (NotFound noise is zxing-internal). Looks reasonable; Windows miss is likely hardware focus/distance.
- SHIPPED post-login permission primer (commit 666224e): frontend/src/platform/mediaPermissions.js primeMediaPermissions() called from AppShell mount (post-login) — requests camera once, skips if already granted, releases stream, swallows denial. 298/298 + build green.
- R-41 STAYS doing until user confirms scanning works on Windows. Asked user diagnostics (preview live? ever decodes? camera/barcode/distance) to target the next fix. Candidate next steps if preview works but no decode: ROI/center-crop + upscale before decode, or a still-capture-and-decode retry, or manual barcode entry fallback.

## [2026-09-10 ~18:15Z] R-41 scanner: REAL Windows root cause found + reworked (still doing, awaiting user verify)
- User diagnostics: Windows Chrome shows SMOOTH live video but NEVER decodes (even a crisp barcode on a screen). Rules out focus/hardware.
- ROOT CAUSE: on this Windows Chrome, native BarcodeDetector does not offer 'code_128' (getSupportedFormats), so it falls to the zxing path. zxing's decodeFromVideoElement draws <video> to a 2D canvas via drawImage(video) — which returns a BLACK frame on Windows Chrome with hardware-accelerated video decode (preview composits fine via GPU, but 2D-canvas capture is blank). So every frame decodes to nothing. Confirmed via HTMLCanvasElementLuminanceSource internals + the earlier 'Could not create a Canvas element' (rotate) both pointing at the zxing canvas layer.
- FIX (commit 2c44e57): replaced decodeFromVideoElement with a manual loop — grab CPU-side frames via ImageCapture.grabFrame() (fallback createImageBitmap(video)), drawImage(bitmap) onto our own willReadFrequently canvas, decode via @zxing/library (HTMLCanvasElementLuminanceSource + HybridBinarizer + MultiFormatReader, CODE_128, no TRY_HARDER). grabFrame/createImageBitmap are CPU-side so immune to the drawImage(video)-black bug. Native BarcodeDetector path kept for where it works. 298/298 + build green.
- ALSO earlier (666224e): post-login camera permission primer.
- R-41 STAYS doing. Must be user-verified on Windows + re-checked on macOS/iOS (didn't regress). If Windows STILL fails after this: next lever is forcing the BarcodeDetector off / ensuring grabFrame track readiness / trying ImageCapture only. Only mark done on user confirm; then record final resolution.

## R-41 barcode scanner — DONE (2026-09-11, user-accepted)
Works on iOS/macOS/mobile. Windows Chrome built-in webcam still would not decode reliably even with a correct pipeline; user accepts and will attach an external camera on Windows. Marked done at user request (NOT blocked).
ROOT CAUSE of the Windows failure: `ImageCapture.grabFrame()` returns black frames on Windows Chrome. Fix = canonical `ctx.drawImage(video,0,0,w,h)` capture → HTMLCanvasElementLuminanceSource → HybridBinarizer → MultiFormatReader.decodeWithState(CODE_128), ~10/s; ImageCapture removed. (commits 9f23feb capture fix, 9ddd2cc diagnostic cleanup; earlier 06033fa dropped TRY_HARDER canvas-rotate crash, 0e5da45 decode()->decodeWithState() so CODE_128 hints persist.)
Permission primer: frontend/src/platform/mediaPermissions.js primeMediaPermissions() runs once at AppShell mount to grant camera before the scanner is reached.
LESSON: when our scanner failed but a reference site scanned on the SAME laptop, that disproved a hardware theory and pointed straight at our capture path — ImageCapture.grabFrame was the self-inflicted bug. Prefer drawImage(video) for canvas capture.
Build + 298/298 vitest green on framework/md-impoc.

## Board state 2026-09-11
Only R-35 (POS UPI QR checkout + separate-device public SSE customer display) remains: todo, PLAN-ONLY, awaiting user GO to dispatch. Everything else done. tasks.json counts: 118 done, 1 todo.

## R-35 DONE + INTEGRATED (2026-09-11)
Merged 20105d6 (feat d5107ff) into framework/md-impoc. worker-r35-pos-upi-display (sonnet). Backend 709/709, frontend 332/332, build PASS (all re-verified by god in worktree pre-merge). Migration 20260911000001-create-upi-accounts applied to impoc_dev.
New backend: src/modules/upi-accounts/ (picklist w/ vpa col) + src/modules/pos-display/ (ephemeral in-memory SSE, no DB). New frontend: platform/upi.js, screens/pos/PaymentDialog.jsx, screens/display/PosDisplayScreen.jsx, posDisplay{Code,Stream,Api}, qrcode.react@4.2.0. App.jsx route-split puts /display* outside RouteGuard+AppShell. apiClient getApiBaseUrl() added for EventSource.
GOTCHA: frontend/package-lock.json is GITIGNORED. Project installs with `npm install --legacy-peer-deps` (pre-existing @testing-library/react@15 peer conflict vs @types/react@19). Worker worktrees miss node_modules -> junctioned to main + copied backend/.env (R-31 pattern).
PENDING: manual browser smoke-test (POS Checkout->UPI->Mark received->Thank you->Receipt + /display/<code> 2nd tab) — no browser-automation in worker session.

## Uncommitted human edit in main working tree (2026-09-11)
5 files carry a "SHREE Fashion Store"->"Shree Fashion Store" rename (backend/.env.example, receipts.service.js storeInfo default, tests/delivery/delivery.test.js fixture, AppShell.jsx header x2, ShopLogo.jsx SHOP_NAME). Uncommitted, NOT god's work, NOT part of R-35 (merge excluded them). Rename is INCONSISTENT: frontend/src/platform/upi.test.js (R-35) still uses old-caps "SHREE Fashion Store". Left untouched pending user direction — do not commit/revert their in-progress edit without asking.

## Standup handling (2026-09-11)
The hourly "scheduler" standup is NOT a floor agent — replying to `scheduler` via outbox bounces straight back as undeliverable. Handle standups locally: review floor + board, fix anything stale, and just file the request to .done. Do NOT write an outbox reply to scheduler.

## R-42 DONE + INTEGRATED (2026-09-11)
Merged 71d3273 (feat f86945a). worker-r42-display-polish (sonnet). frontend 342/342, backend 712/712, build clean. Follow-up to R-35 on the POS customer display.
- New frontend/src/platform/qrLogo.js: LOGO_SRC = single swappable monogram data-URI -> when the user gives a real logo, replace LOGO_SRC (one line). QR uses level="H" so it still scans with the ~19% center logo.
- New frontend/src/platform/displayBorderStyle.js + index.css .qr-border--pulse / .qr-border--marching: BOTH border animations shipped with a localStorage toggle on the display; user will finalize one later (then we can drop the other + the toggle).
- Spoken thank-you: window.speechSynthesis on live non-received->received only; needs a one-time "Tap to enable sound" on the display device (browser autoplay gate). customerFirstName (first token only) now flows POSScreen -> pos-display payload -> display; validation \S+ max 50. USER-APPROVED putting first name on the public channel.
PENDING user manual checks: phone-scan the logo QR; tap-to-enable-sound then hear thank-you.

## R-43 intake-scan colour/size form fix (2026-09-11, god direct, b89d196)
StockIntake.jsx auto-committed units 2+ using the previous unit's prefilled colour/size the instant the barcode decoded, so the form was never shown. Fixed by gating the UX-H5 auto-commit on pickedSinceDecodeRef (true only when operator actively changes colour/size; reset on each decode). Prefill kept as editable defaults confirmed via Save unit. Size-run fast mode + first-unit flow unchanged. Frontend-only, 342/342 + build. Did this directly (one file + test) rather than spawning — small, already root-caused.

## R-43 follow-up (2026-09-11, cdcf655)
First fix (b89d196) kept prefill + auto-commit-on-both, so on unit 2 one field was pre-filled and changing the OTHER dropdown auto-submitted -> user unhappy. FINAL behaviour: normal mode starts each unit BLANK (colour/size cleared on every decode, no carry-over from previous unit); auto-commit fires only when BOTH are freshly picked (picking the 2nd field commits, same as unit 1); changing one alone never submits. Size-run mode unchanged (colour carry + size-sequence prefill = fast path). Removed pickedSinceDecodeRef. 342/342 + build.

## R-46 Campaigns module (planned 2026-09-11, web-researched, NOT started)
Feature: manage campaigns -> publish IG posts+stories, WhatsApp offers, + insights. FEASIBILITY (verified vs 2026 Meta docs): IG posts/stories via Content Publishing API (3-step container, public media URL, ~100/24h) + Graph Insights = feasible. WhatsApp offers = OFFICIAL Cloud API marketing templates to OPTED-IN customers, billed per delivered msg (aligns with our consent flags + delivery_logs). BLOCKERS (told user): WhatsApp Status has NO API; WhatsApp CHANNELS has NO official Meta API (only unofficial Whapi/Maytapi/WAHA = reverse-engineered client, ToS violation, number-ban risk -> not recommended). Needs: Meta Business + verification, FB Page + IG Professional, Dev App + App Review, WABA + dedicated number + approved templates, public media hosting, public webhook, scheduler. Arch: Campaign->CampaignPost(per-channel)->CampaignMetric + provider-adapter layer (InstagramAdapter/WhatsAppAdapter). Full detail in tasks.json R-46. 3 open decisions pending (WhatsApp official-vs-Channels, which accounts exist, IG posts+stories+which metrics).

## R-47 Receipt delivery module (planned 2026-09-11, HIGH priority, NOT started)
Send receipt at checkout on customer's subscribed channels: email / WhatsApp / SMS. HUGE REUSE: delivery_logs + receipt digital payload + consent flags already exist (Schema V2 T-18). Email=Phase1 (SMTP/SES/Resend + verified domain, no gate). WhatsApp=Phase2 (official Cloud API UTILITY template, WABA shared with R-46). SMS=Phase3 (Twilio/MSG91 + INDIA DLT registration gate; send link not full receipt). Arch: ASYNC dispatch after sale commit (never block checkout), provider-adapter layer (Email/WhatsApp/Sms), delivery_logs ledger + webhooks + retry, public tokenized /receipt/:token page (reuse R-35 route-split), per-sale-per-channel idempotency, optional server PDF. Depends R-45 (content), shares WhatsApp infra with R-46. 5 open decisions (auto-vs-cashier-pick, link/PDF/both, SMS now-or-defer, provider prefs, accounts in hand). Full detail tasks.json R-47.

## R-44 mobile responsiveness pass DONE (2026-09-11, a0b06f3)
User-confirmed on-device. 8 files committed. ROOT CAUSE of "nothing scrolls on mobile": AppShell mobile content div + <main> lacked min-h-0 in the h-dvh COLUMN flex, so main grew to content height instead of clamping -> no overflow engaged (desktop = row, unaffected). Fix = min-h-0 both nodes. Plus: Toast mobile sizing; StockIntake+PosDisplayScreen min-h-screen->min-h-dvh; safe-area-aware bottom tab bar + main bottom clearance (gated on JS isDesktop not sm: to avoid 640-767px gap); removed main mobile side double-padding (40->24px); POS cart row stacks on mobile (icon-only Remove); ExpensesScreen <ul>->DataGrid + column filters; Input.jsx global ~10px label gap; SignIn brand text shrink/wrap <640px. This commit ALSO carried the AppShell SHREE->Shree rename lines (rest of rename was d617e06). Worker ran isolate:FALSE in main tree (edits hot-reloaded for the user's live page-by-page testing) -- good pattern for interactive UI work. LESSON: min-h-0 on every flex ancestor is required for an internal-scroll child to bound in a COLUMN flex; a ROW-flex desktop hides the bug.

## R-45 branded receipt DONE + INTEGRATED (2026-09-11, 121afca)
User-approved colourful A5 HTML receipt recreating their reference (cream/brown, lotus+श्री monogram, FASHION STORE wordmark, S.No/Description/Qty/Rate/Amount table + Total, Amount-in-Words Indian numbering, thank-you+Signature, lotus corner watermarks). Self-contained (inline CSS+SVG) so it prints to PDF + reusable for R-47 email. Monogram swappable via RECEIPT_LOGO_SRC (frontend receiptBrand.js + backend receipts.html.js). In-app via "Branded receipt" button in ReceiptSection.jsx -> iframe-isolated dialog. Server copy buildBrandedReceiptHtml in receipts.html.js (kept in sync by hand with frontend brandedReceiptHtml.js; no route yet, R-47 owns exposing it). Standalone preview: frontend/doc/receipt-preview.html via `npm run receipt:preview --prefix frontend` (frontend/scripts/generate-receipt-preview.mjs). Reference image saved at frontend/doc/receipt-ref.jpeg (untracked). Thermal 58/80mm text receipt untouched (user does not use thermal). frontend 357, backend 718, build clean. worker-receipt-redesign (sonnet, isolate:false). NOTE dev artifacts frontend/doc/* + colors/ + tunnels.json intentionally NOT committed.

## R-46 + R-47 DEFERRED (2026-09-11)
User chose not to plan the Campaigns (R-46) or receipt-delivery (R-47) tickets immediately. Both stay todo. R-47 now carries the FOSS analysis: recommended Option B = thin build (pg-boss on existing Postgres + Nodemailer + thin REST adapters to WhatsApp Cloud API/SMS gateway, reuse delivery_logs + R-45 branded receipt HTML + tokenized /receipt page); Novu = the heavier full-platform alt (separate service). No FOSS escape for paid WhatsApp/SMS delivery. Awaiting user go + the open decisions before either is dispatched.

## [2026-09-13 ~05:30Z] R-48 DONE — barcode values SHREE+timestamp+counter (done directly, no worker)
- New Mac setup for the user (Homebrew Postgres 16; DBs IMPOC/IMPOC_test wiped via DROP SCHEMA public, re-migrated 36 migrations + seeded; .env filled; COOKIE_SECURE=false, FRONTEND_ORIGIN still localhost:3000 — set to the LAN URL if phones will open the app). Backend `npm i` blocked on stale Xcode CLT (argon2 'functional' header) — user to reinstall; jest still ran (prebuilt argon2 present).
- FORMAT LOCK: `SHREE` + 6-char base36 seconds-since-2026-01-01 + 4-char base36 (seq mod 36^4) = 15 chars, uppercase alnum. formatBarcodeValue(seq, nowMs) exported from barcode.service.js; constants BARCODE_FORMAT / BARCODE_MAX_LENGTH(32) in barcode.constants.js. One timestamp per batch.
- GOTCHA: ALTER COLUMN TYPE on units/sale_lines/rental_lines.barcode fails while v_*_grid views exist → migration 20260913000001 drops/re-creates them via `export const VIEWS` added to 20260910000002-create-grid-views.js. Any future barcode/line column type change must do the same.
- Validators now max(32) (units regex still ^[A-Z0-9]+$ — scanner output must be uppercase; our values are). Frontend untouched.
- Verified: jest 725/725, migrate up/undo/up clean, live generate smoke → SHREE0D4N5H000V..0019 in the PDF.
- OPEN for user: physical scan test at 35mm; raise barcode_width_pt if flaky. Ticket R-48 marked done in tasks.json.

## [2026-09-13 ~06:30Z] R-49 built, IN TEST (user rule: don't mark done until tested + confirmed)
- BarcodePrintScreen: toasts (useToast; tests need ToastProvider), form always visible, requestKey re-minted per completed request via finishAttempt (lazy useState init — the old useEffect+setState tripped react-hooks/set-state-in-effect). Keep `import React` — vitest uses the classic JSX runtime here even though eslint flags it unused.
- Generator: label code area is content-driven now; infoBox.minHeight=14 is a floor, not the height. Any future label geometry work: price box = label remainder.
- Friendly 5xx/transport errors done centrally in apiClient interceptor (isServerUnavailable flag) — no ticket by user choice.
- Local verification tooling: `.claude/launch.json` (backend/frontend/frontend-http); `frontend/vite.http.config.js` is a TEMP plain-HTTP vite config for the in-app browser (self-signed basic-ssl cert is rejected there) — delete or gitignore, do not commit. PDF eyeballing: pypdfium2+pillow in scratchpad/pylibs (no poppler on this Mac).
- Uncommitted: R-48, friendly-errors, R-49. User to say when to commit.

## [2026-09-13 ~07:30Z] R-50 built, IN TEST — label layout configurator (single row)
- GEOMETRY LOCK: barcode-layout.geometry.js (backend) == platform/labelLayout.js (frontend). Change one → change both; tests in tests/barcode-layout.integration.test.js + LabelLayoutScreen.test.jsx pin the historic A4 3×5 numbers (label 173.86×145.70pt).
- app_settings barcode_* keys are DEAD (generator reads barcode_layouts). Don't seed/patch them for new behaviour; the seed migration + its test stay for history.
- Test DBs use sync(): no seed row → service findOrCreate(DEFAULT_LAYOUT). Any code path touching the layout must tolerate a missing row the same way.
- Preview endpoint deliberately renders the SAVED layout only (user saves, then previews) — no draft-in-query to keep the URL simple and idempotency untouched.
- Browser check blocked on login (I don't type passwords) — user to sign in at http://localhost:5174 (temp HTTP vite) or use their own browser.
- Open tickets: R-49 (paper test), R-50 (browser test). All uncommitted with R-48 + friendly-error fix.

- REVISION: user wanted no extra tab → configurator embedded on Print labels (toggle). /label-layout route removed; don't re-add a nav item. Corner radius default 0.

## [2026-09-13 ~08:30Z] R-49 + R-50 CLOSED (user-tested: browser + paper, 'working super fine')
- Also confirms R-48's caveat is moot: the 15-char SHREE code scans at the 35 mm default width.
- Board: 137 done / 0 doing / 2 todo (R-46 Campaigns, R-47 Receipt delivery — both plan-only on user decisions).
- Everything from this session is still UNCOMMITTED on `context`; user has not asked to commit. Keep `.claude/launch.json` + `frontend/vite.http.config.js` out of any commit.

## [2026-09-13 ~10:30Z] R-51 GST on purchases BUILT (awaiting user test); R-52 buying-templates decision BLOCKED
- LOCKS: stock GST = percent rates (DECIMAL(5,2)); bill GST = paise amounts; total_paid is GST-INCLUSIVE and never reconciled against them (user rule — don't add variance math). Landed cost hint is client-only (platform/gst.js); backend stores, never computes.
- Templates module is frozen: no GST fields there; R-52 asks Hide/Remove/Keep. Don't touch template.* until answered.
- Any new column on stocks/sale_lines/rental_lines/trip_vendors that a v_*_grid view reads → drop/re-create views in the migration AND mirror in tests/utils/test-setup.js gridViews (test DB uses sync(), not migrations) — this bit me here (list endpoint read v_stocks_grid without the new columns).
- Uncommitted: R-51 code + these docs.

## [2026-09-13 ~11:00Z] R-51 CLOSED (user-tested); R-52 parked ~1 month
- User will trial the system in production (~until 2026-10-13) before deciding the templates module. Don't nudge before then; the humanQA answer is on the card.
- Board: 138 done / 1 blocked (R-52) / 2 todo (R-46, R-47). R-51 uncommitted.

## [2026-09-13 ~13:00Z] R-53 digital pet BUILT (awaiting user look)
- Sheet grid is 192x208 (8x9) — NOT the 232x251 in the user's original demo. validatePetConfig() + a test pin it; if the user re-exports the PNG, re-measure (Pillow in scratchpad/pylibs) and update PET_SHEET.
- All tuning lives in PET_ANIMATIONS (weight, holdMs). User's rule: last three rows hold long. Dev page: /pet/pet-engine.html (vite dev only; imports /src module).
- /display is public → browser-verifiable without login (used javascript_tool to log data-animation transitions).
- Uncommitted: R-53 + LabelLayout test headroom tweak + docs.

- FOLLOW-UP R-48 (2026-09-13): three barcode inputs (POS add item, rental create, stock intake) still had maxLength=12 -> 15-char codes were truncated on the client. Now `BARCODE_MAX_LENGTH` (32) from frontend/src/constants/barcode.js. Grep for hard-coded 12s whenever the barcode shape changes.
- R-53 rev: fps per row derived from Pillow inter-frame diff (method in board). Poke = window pointerdown → scheduler.poke(); NO document.hidden guard on poke (the in-app browser pane reports hidden=true while visible — cost me a false negative).

## [2026-09-13 ~16:00Z] R-54 review QR BUILT (awaiting user test)
- POLICY LOCK: never pre-fill/steer Google reviews (told the user; accepted). Review QR only.
- Display 'received' now persists (15-min safety reset); POS must publish idle on Close transaction / New transaction / Clear cart — all three do. If a new POS exit path is added, publish idle there too.
- Test-DB gotcha: don't add ADMIN users in new suites — SEC-CR-2 counts active admins across the shared impoc_test; use MANAGER (has picklists.*).
- Uncommitted: R-54 + docs.

## [2026-09-13 ~16:30Z] R-54 CLOSED (user-tested). Board 141 done / R-52 blocked / R-46, R-47 todo. All committed + pushed.

## [2026-09-13 ~18:00Z] R-55 photo capture BUILT (awaiting user device test)
- PhotoCapture is reusable: any future image field should use it (onPhoto(dataUrl)) + imageResize — don't add bare <input type=file> again.
- Camera in the in-app browser pane is always blocked → only the fallback path is verifiable here; real getUserMedia needs the user's device (HTTPS).
- Test hygiene: asyncUtilTimeout 5s in vitest.setup.js; when a screen sets data then loading=false in separate renders, tests must wait for the loaded UI (buttons enabled), not the first value. POS thank-you banner is a 450ms window — wait on createSale instead.
- Vite dev pages that use React must live under the project root (frontend/dev/*.html + src/dev/*.jsx), not public/ (no plugin-react preamble there).
- Uncommitted: R-55 + docs.

## [2026-09-13 ~18:30Z] R-55 CLOSED (user-tested on device). Board 142 done / R-52 blocked / R-46, R-47 todo. All committed + pushed.

## [2026-09-13 ~20:00Z] R-56 BUILT (awaiting user test) — templates + A3 + custom page sizes
- app.js is OFF LIMITS while the user's production work is uncommitted (also .env.example, ecosystem.config.cjs, deploy/, docs/, frontend/.env.production). Mount new routes on existing routers if needed.
- Jest gotcha: one describe's afterAll closes sequelize → a second describe in the same file can't connect. One lifecycle per file.
- Custom sizes: storage is mm; UI unit is presentation only (LENGTH_UNITS). A3 in PAGE_SIZES_PT. Both geometry copies changed together (tests pin them).
- Uncommitted: R-56 + docs.

## [2026-09-13 ~21:00Z] R-56 CLOSED (user-tested). Board 143 done / R-52 blocked / R-46, R-47 todo. Committed + pushed; user's deploy files left uncommitted on purpose.

## [2026-09-13 ~21:30Z] db:refresh (undo:all) fixed — migration rollback rules
- Grid views are re-created via `createGridViews()` / `dropGridViews()` exported from 20260910000002 — COLUMN-AWARE (omits projections for optional columns like stocks.cgst_rate_pct when absent). Every migration that touches a column the views read must use these helpers (R-48 widen + R-51 GST do). NEVER inline `view.sql` in an up/down again: on a fresh DB the views migration runs before later columns exist, and on undo the columns are gone before older downs re-create views.
- Downs must tolerate current data: 0006 down resets A3/CUSTOM→A4 before re-adding the old CHECK; 0007 down clamps rows/cols to 10; 0001 down no longer narrows barcode to 12 (would truncate). User: system not in production, data loss acceptable — but the fixes stand.
- Verified: `npm run db:refresh` twice from a consistent state → 55 migrations, 5 views (+GST cols), 4 matviews, admin seeded.

## [2026-09-13 ~22:30Z] R-57 BUILT (awaiting user test) — the Select's `creatable`/`onCreate` row only shows when the query matches NOTHING (cmdk filter is fuzzy + case-insensitive), so an 'existing name' dedupe path is unreachable from the UI. Uncommitted.

## [2026-09-13 ~23:00Z] R-57 CLOSED. Board 144 done / R-52 blocked / R-46, R-47 todo. Pushed context + main.
