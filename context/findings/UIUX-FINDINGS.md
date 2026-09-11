# UI/UX Implementation Review — IMPOC Frontend (Phase R-25)

**Reviewer:** Erin (UI/UX Designer) + Design System Guardian lens
**Tree:** `frontend/` — current committed state (post-R-08 dark-primary revamp, master `4e55c3a`)
**Date:** 2026-09-07
**Scope:** READ-ONLY. `frontend/src`, `frontend/index.html`, `frontend/vite.config.js`, `frontend/package.json`. No files modified except this report.
**Basis:** `md-framework/agents/uiux/uiux-designer.md` + `design-system-guardian.md` + skills (`user-flows`, `usability-review`, `visual-hierarchy`, `interaction-design`, `accessibility`, `design-review`, `design-system-audit`, `design-tokens`, `typography`, `color-system`, `spacing-system`, `component-consistency`, `component-library`, `loading-states`).

---

## Executive summary

The app is in good shape structurally: a coherent semantic token layer, one shared UI primitive library, role-gated grouped navigation, and consistent permission-absent-not-disabled handling across the board. The colour system is token-clean except for a handful of raw-hex leaks. The POS checkout journey is appropriately tap-lean with no spurious confirmations.

The main gaps are three systemic themes:

1. **Touch targets / density** — the shared `Button` `sm`=`h-8` (32px) and `md`=`h-10` (40px) sizes sit below the 44px floor that the brief mandates, and this is applied app-wide (every table row action, chip, result row). This is a *library* failure, not discipline: the primitive provides no ≥44px touch size, so screens improvise undersized controls.
2. **Money display** — the design system *defines* `.typography-money*` with `tabular-nums` right-aligned money, but most screens bypass it and render `formatPaise()` inline in left-aligned prose/`<strong>`. Digit width wobbles and numeric columns can't be scanned.
3. **Inventory "tables" aren't tables** — every list is stacked `<ul>/<li>` cards instead of the `ui/Table` primitive, so there is no sticky header, no frozen identity column, and no right-aligned numeric columns. The INVENTORY TABLES archetype is therefore largely unmet.

Plus a set of flow-level findings (POS total hierarchy, scan-loop cadence, rental refund blind-commit, no post-login landing route) and accessibility gaps (bare `<button>` bypassing focus-visible ring, colour-alone status signalling).

---

## Findings summary table

| ID | Priority | Area | Location | Short title |
|----|----------|------|----------|-------------|
| UX-C1 | Critical | Flow | `app/AppShell.jsx`, `app/navigation.js`, `app/App.jsx` | No post-login landing route — user hits "Nothing here yet" on `/` |
| UX-C2 | Critical | Flow/Till | `screens/pos/POSScreen.jsx` | Money in `text-lg`+`<strong>` — total is not the largest element; no `tabular-nums` |
| UX-C3 | Critical | Ren/bind | `screens/rentals/ReturnUnitsDialog.jsx`, `screens/rentals/RentalsScreen.jsx` | Rental return commits deposit/late/damage with **no pre-submit refund preview** (blind money move) |
| UX-H1 | High | Library | `components/ui/Button.jsx` (sm=32px, md=40px) + all callers | Sub-44px touch targets app-wide |
| UX-H2 | High | Styling | `screens/*` (POS, Rentals, Expenses, admin, inventory lists) | Money lacks `tabular-nums` + right alignment (bypasses `.typography-money*`) |
| UX-H3 | High | Styling | `screens/inventory/*` (TripsScreen/StocksScreen/UnitsScreen/TripDetail/VendorDetail) | Lists are stacked cards, no `Table`, no sticky header/frozen column/right-aligned numerics |
| UX-H4 | High | A11y | `screens/inventory/*` (TripsScreen.jsx:178, VendorDetail.jsx:155, TripDetailScreen.jsx:439, StocksScreen.jsx:186) | Status/state signalled by **colour alone** (green/red text, no icon/symbol) |
| UX-H5 | High | Flow | `screens/inventory/StockIntake.jsx` | Scan loop re-arms manually every unit (~3–5 taps/unit); no auto commit-repeat |
| UX-H6 | High | A11y | AppShell, admin, inventory, rentals, customers | Many bare `<button>`/`<div onClick>` bypassing primitives → lost `focus-visible` rg + semantics |
| UX-H7 | High | Flow | `screens/pos/POSScreen.jsx` | No loading state on barcode lookup → double-scan race; silent picklist-fetch failure |
| UX-H8 | High | Ren/bind | `components/rentals/RentalsScreen.jsx:340` | Line `unitStatus` forced `Badge variant="neutral"` → no status differentiation |
| UX-M1 | Medium | Flow | `screens/inventory/StockIntake.jsx:191-194` | Save-failure fallback dumps to IDLE, discards barcode + colour/size |
| UX-M2 | Medium | Styling | SignIn.jsx:65, Dashboard.jsx:387, StockIntake.jsx:228 | Raw hex/rgba leaks (`rgba(183,29,54,0.1)` etc.) vs `var(--danger)/10` |
| UX-M3 | Medium | A11y | `components/ui/Table.jsx` | TableHead not sticky; no frozen first column |
| UX-M4 | Medium | Styling | admin/UsersScreen, RolesScreen, FlatPicklistManager, ProductTypesManager | `window.confirm()` / bare chips lacking focus-visible + tablet semantics (Picklist tabs) |
| UX-M5 | Medium | Flow | `screens/pos/POSScreen.jsx` | "Clear cart" destructive with no lightweight confirm; receipt only has bottom "New transaction" |
| UX-M6 | Medium | Styling | `screens/expenses/ExpensesScreen.jsx:185` | Bare "Loading expenses…" text, no skeleton (inconsistent with sibling screens) |
| UX-M7 | Medium | A11y | `app/Dashboard.jsx:428-439` | Tab buttons lack `role="tab"`/`aria-selected`/arrow-key nav |
| UX-M8 | Medium | Styling | `screens/customers/CustomersScreen.jsx:190-204` | Consent chips ~20px hit area, no focus-visible, no in-flight guard |
| UX-M9 | Medium | Flow | `screens/inventory/BarcodeScanner.jsx` + StockIntake | Scanner/camera errors surfaced only inside internal card; no accessible retry/stop |
| UX-M10 | Medium | Flow | `screens/inventory/TripDetailScreen.jsx`/`StocksScreen.jsx` | `text-[13px]` arbitrary font sizes vs semantic typography tokens |
| UX-L1 | Low | Styling | `platform`/screens | Inline `style={{...}}` (App.jsx/RouteGuard padding, ProductTypesManager pl) |
| UX-L2 | Low | Styling | inventory screens | Duplicate STOCK_FULL blocks (StockIntake.jsx:414 & :425); `hover:` overrides on TableRow |
| UX-L3 | Low | A11y | ReceiptPreview/SaleReceipt | Malformed `sale.lines` could crash; no empty guard |
| UX-L4 | Low | Flow | `screens/inventory/StockIntake.jsx` hands-off | Cancel in ARMED wipes prefilled state with no confirm (acceptable, note) |

---

## CRITICAL

### UX-C1 — No post-login landing route (login → role landing broken)
- **Files:** `app/App.jsx` (no default route), `app/AppShell.jsx` (no auto-navigation), `app/navigation.js`
- **Why it's wrong (brief):** The brief requires a "login → role landing" journey that lands the user somewhere sensible with the right context. After sign-in there is **no default route** — `/` falls through the `*` catch-all and renders "Nothing here yet / You don't have access to any screens". Sign-out navigates to `/` (AppShell.jsx:149), so sign-out→sign-in always dumps here. Navigation is purely passive (sidebar links) and never auto-navigates to the user's first permitted screen.
- **Fix:** Add `<Route path="/" element={<Navigate to={firstAccessiblePath} replace />} />` (computed from the user's permissions against `navigationRegistry`), or auto-navigate in `AppShell` on mount when `location.pathname === "/"`. Absent-not-disabled already filters sections correctly; reuse that for the redirect target.

### UX-C2 — POS total is not the largest element; money lacks tabular numerals
- **File:** `screens/pos/POSScreen.jsx:498-504` (and `SaleReceipt.jsx:59-62`)
- **Why it's wrong (TILL archetype):** "The total is the largest element." The total is rendered `text-lg` (18px) with `<strong>`, no larger than the card titles, and the item prices are `text-sm`. It is not visually dominant. Money is rendered via plain `<strong>{formatPaise(...)}</strong>` **without** `font-variant-numeric: tabular-nums` even though the design system defines `.typography-money*` for exactly this (`frontend/src/index.css:366-406`). On a till where totals change every sale, wobbling digit widths and a non-dominant total are measurable errors.
- **Fix:** Apply `.typography-money-lg` (28px, bold, `tabular-nums`) to the grand total and `.typography-money`/`.typography-money-sm` + `text-right` to line prices. Ensure the total is the single largest element in the checkout card.

### UX-C3 — Rental return commits money with no pre-submit refund preview
- **Files:** `screens/rentals/ReturnUnitsDialog.jsx`, `screens/rentals/RentalsScreen.jsx`
- **Why it's wrong (TILL + confirm-only-financial archetype):** In the return dialog, the operator selects per-unit damage grades/changes, but the computed `depositRefundedPaise` (late/damage deductions) is only shown **after** "Process return" is submitted (RentalsScreen.jsx:379). Money moves on a blind tap. This violates "confirm only financial actions" in spirit — financial actions must be *visible and confirmable*, and here the amount isn't even previewable before committing.
- **Fix:** Compute and display live per-line + total refund/late/damage in the return dialog before submit, plus a final one-line confirm on the total (e.g. "Refund ₹X — Process return").

---

## HIGH

### UX-H1 — Touch targets below 44px app-wide (library failure)
- **File:** `components/ui/Button.jsx:27-32` (`sm`=`h-8`=32px, `md`=`h-10`=40px), plus all `size="sm"` callers: `UsersScreen.jsx:266,271,276,285`, `RolesScreen.jsx:202,207,212`, `FlatPicklistManager.jsx:148,153`, `ProductTypesManager.jsx:33,38`, `VendorsScreen.jsx:204,208,213`, `TripsScreen.jsx:190-191`, `TripDetailScreen.jsx:394-399`, `StocksScreen.jsx:202,205`, `TemplateForm.jsx:365-366`, `RentalsScreen.jsx:252,268`, `ExpensesScreen.jsx:212,215`, `RentalCreateDialog.jsx:142,161`, `CustomersScreen.jsx:190-203`, `Dashboard.jsx:357-364`.
- **Why it's wrong (brief):** "44px touch targets with generous separation around destructive actions" is a hard floor. Every `sm` action button and every `md` default button falls short. Also undersized: consent chips `px-2 py-0.5 text-[11px]` ≈20px, size-run chips `px-3 py-1` ≈24px, CustomerPicker result rows `py-2` ≈32px, chip-removal `×` buttons ≈16px, AppShell mobile settings `p-2` ≈36px.
- **Fix (library-first per guardian):** Raise `sm`→`h-11` (44px) and `md`→`h-11`/`min-h-11`; add a `tabular`/dense option that keeps ≥44px hit area via padding wrapper for tables if density is truly needed. Then sweep chips/rows with `min-h-[44px]`. Standardize on this so the fix propagates everywhere.

### UX-H2 — Money not tabular / right-aligned in list surfaces
- **Files:** `screens/pos/POSScreen.jsx:430-433`, `SaleReceipt.jsx`, `ReceiptPreview.jsx:101-140`, `RentalsScreen.jsx:251,316,335-379`, `ExpensesScreen.jsx:209`, `VendorsScreen.jsx:289-290`, inventory list rows (`StocksScreen.jsx:184-199`, `VendorDetail.jsx`), `TripDetail` variance strip partially OK.
- **Why it's wrong (brief):** Money uses tabular numerals and right alignment; numeric columns right-aligned. The system defines the tooling (`.typography-money*`) but screens bypass it → digit width wobble and non-scanable columns.
- **Fix:** Apply `.typography-money*`/`tabular-nums` and `text-right` to every monetary cell/row; restructure inline-prose money (e.g. the Returns cards `RentalsScreen.jsx:373-380`) into aligned label/value rows.

### UX-H3 — Inventory "tables" are stacked cards; no sticky/frozen/right-aligned columns
- **Files:** `screens/inventory/TripsScreen.jsx:161`, `StocksScreen.jsx:161`, `UnitsScreen.jsx:202` (all `<ul>` lists), `VendorDetail.jsx`. The `ui/Table` primitive exists but is unused for these.
- **Why it's wrong (INVENTORY TABLES archetype):** Tables should be dense and scanned, with sticky header, frozen identity column, sorted by attention, numeric right-aligned. Stacked cards cannot do any of these: no sticky header, no frozen identity column, numeric columns cannot right-align, and scanning several rows of numbers is hard.
- **Fix:** Adopt `ui/Table` for Trips/Stocks/Units lists (sticky `thead`, frozen first column, right-aligned money + `tabular-nums`). This is the primary inventory-archetype remediation.

### UX-H4 — Status/state signalled by colour alone
- **Files:** `screens/inventory/TripsScreen.jsx:178`, `VendorDetail.jsx:155` (variance = green/red text with no icon/±), `TripDetailScreen.jsx:439` + `StocksScreen.jsx:186` (stock "complete" = green text only).
- **Why it's wrong (brief):** "Status colour ALWAYS paired with an icon or text" and "never colour alone" (WCAG colour-blind). A green-vs-red text-only distinction is invisible to colour-blind operators and gives no scannable glyph.
- **Fix:** Pair colour with an icon/symbol (`↑`/`↓`/`✓`/`!`) and/or explicit text in every variance/complete indicator. TripDetail's "Stock complete" text+colour block is the pattern to replicate site-wide.

### UX-H5 — Stock scan loop re-arms manually every unit
- **Files:** `screens/inventory/StockIntake.jsx:179,283-285`, `components/BarcodeScanner.jsx:281-321`
- **Why it's wrong (TILL + workflow):** After each save the flow returns to `IDLE`, forcing a manual "Scan next unit/store" tap plus re-selecting colour/size each unit — roughly **3–5 taps per unit**. For a lot of N units that's ~3N taps before saving any. Not a clean arm→decode→commit cadence.
- **Fix:** After a successful commit, auto re-arm the camera and auto-submit when colour+size are prefilled (repeat-commit loop); keep a single explicit "back to IDLE" affordance. Use the last-saved colour to default the next unit.

### UX-H6 — Bare interactive elements bypassing primitives (lost focus-visible + semantics)
- **Files:** AppShell nav rail + tab bar + mobile header (`app/AppShell.jsx:180-196,216-234,258-266,304-318`), inventory (`TripsScreen.jsx:167`, `StockIntake.jsx:291,307,319,455`, `StockForm.jsx:261,344`, `UnitsScreen.jsx:133`), admin Picklist tabs (`PicklistManagementScreen.jsx:72-84`), chip-removal `×` (`UsersScreen.jsx:342-349`, `RolesScreen.jsx:273-279`), `CustomerPicker.jsx:150-157,189-223`, consent chips (`CustomersScreen.jsx:190-204`), Dashboard tabs (`Dashboard.jsx:428-439`), `<div onClick>` backdrops (`StockIntake.jsx:439-440`).
- **Why it's wrong (guardian):** The shared primitives define the `focus-visible:ring` and interaction states; bare elements lose them and give no keyboard/focus-visible affordance. The guardian's "most divergence is a library failure" lens applies: no nav/tab/`ToggleGroup` primitive exists, so screens improvise.
- **Fix:** Add a `NavItem`/`Tab`/`ToggleGroup` primitive with full `focus-visible` + `aria-current`/`aria-selected`/`aria-pressed`; migrate bare buttons/backdrops (use the accessible `Dialog` for backdrops).

### UX-H7 — POS barcode lookup has no loading state (double-scan race) + silent picklist failure
- **File:** `screens/pos/POSScreen.jsx` (barcode lookup), `POSScreen.jsx:62-74` (`.catch(() => {})` swallows picklist fetch errors), `CustomerPicker.jsx:62`.
- **Why it's wrong (visibility + preventing double entry):** While `addByBarcode` is in flight there's no spinner/disabled input, so an operator can scan again → race. Silent picklist-fetch failure shows an empty dropdown with no reason.
- **Fix:** Add a `lookupLoading` state (disable the scan input, show a spinner); surface picklist fetch failure via inline banner/toast.

### UX-H8 — Rental line `unitStatus` forced to neutral — no status differentiation
- **File:** `screens/rentals/RentalsScreen.jsx:340`
- **Why it's wrong (brief):** Every unit line's status badge uses `Badge variant="neutral"`, so a rented/overdue/lost line has the same visual weight as an available line; the only signal is the raw word.
- **Fix:** Map `line.unitStatus` to meaningful variants (`danger` for late/lost, `success` returned, `info` rented), mirrors of the agreement-level `statusBadgeVariant` (RentalsScreen.jsx:23-34). Keep text present (rule respected, weight added).

---

## MEDIUM

- **UX-M1** — `StockIntake.jsx:191-194`: non-404/non-dup save failure falls back to `IDLE`, discarding the barcode + selected colour/size. Keep `DECODED` with entered values + inline retry.
- **UX-M2** — Raw-hex leaks bypassing tokens: `SignIn.jsx:65` `rgba(183,29,54,0.1)`, `Dashboard.jsx:387` `rgba(179,38,30,0.1)`, `StockIntake.jsx:228` `rgba(179,38,30,0.1)` → use `var(--danger)/10` like every other screen.
- **UX-M3** — `Table.jsx` `TableHead` has no `sticky top-0`; no frozen first column. Add `sticky top-0 bg-[var(--surface-raised)] z-10` and sticky left on first column for long lists.
- **UX-M4** — Destructive deletes use OS `window.confirm()` (`UsersScreen.jsx:130`, `RolesScreen.jsx:102`, `ProductTypesManager.jsx:105`) — unstyleable, inconsistent with the `Dialog` primitive. Migrate to in-app confirmation `Dialog` (justified — destructive).
- **UX-M5** — `POSScreen.jsx:508` "Clear cart" is destructive with no lightweight confirm (wipe customer/cart/receipt) and the receipt view's "New transaction" is only at the bottom. Add a sticky top "New transaction" on the receipt view + a 3s "Confirm clear?" inline toggle on Clear.
- **UX-M6** — `ExpensesScreen.jsx:185` loading is bare text, inconsistent with the skeleton pattern used by Rentals/Customers/Dashboard.
- **UX-M7** — `Dashboard.jsx:428-439` tabs are bare `<button>`s with no `role="tab"`/`aria-selected`/arrow-key nav.
- **UX-M8** — `CustomersScreen.jsx:190-204` consent chips ≈20px, no `focus-visible` ring, no in-flight disable (double-click risk).
- **UX-M9** — `BarcodeScanner.jsx` error card is internal CSS-styled + bare "Try again"; surface camera errors in StockIntake with accessible retry + a real stop affordance.
- **UX-M10** — Arbitrary `text-[13px]` (TripDetailScreen.jsx:374,430,438, StocksScreen.jsx:179,184, UnitsScreen.jsx:219,227, VendorDetail.jsx:168) instead of semantic typography tokens.

---

## LOW

- **UX-L1** — Inline `style={{...}}` for padding: `App.jsx:36-38,95-98`, `RouteGuard.jsx:51,77-84`, `ProductTypesManager.jsx:26` → Tailwind utility classes.
- **UX-L2** — Duplicate `STOCK_FULL` blocks (`StockIntake.jsx:414` & `:425`); `SaleReceipt.jsx:40` `hover:bg-transparent` override → add a `noHover` prop to `TableRow` instead.
- **UX-L3** — `ReceiptPreview.jsx:19` / `SaleReceipt.jsx` return null on missing data (acceptable for usage, but add a defensive `sale?.lines` guard).
- **UX-L4** — `StockIntake.jsx:108-117` Cancel in ARMED wipes prefilled state without confirmation (worth a lightweight guard).

---

## Top frequent journeys & tap counts

### POS checkout (TILL) — fastest frequent path
| Step | Taps/keys |
|------|-----------|
| Scan item (barcode gun types + Enter / camera) | 0–1 |
| Add item to cart (auto) | 0 |
| Customer (optional) | 2–3 |
| Payment method (defaults Cash) | 0 |
| Charge (Pay) | 1 |
| **Minimum (scan→pay) / typical (scan+customer+pay)** | **1 / 4–5** |

**Verdict:** Excellent — no confirmation on Pay (correct per brief), scan input `autoFocus`, total is the commitment step. **Fix the total hierarchy (UX-C2)** and **barcode-lookup loading (UX-H7)**.

### Inventory intake: trip → vendor → template → stock → scan
| Step | Taps |
|------|------|
| Create trip | 3 (New trip, name, Create) |
| Add vendor to trip | 4–5 |
| Add stock | 6+ (vendor/type/subtype/qty/buy/sell/floor/Save + back-nav) |
| Start scanning | 1 |
| Per unit: tap scan → decode → colour → size → Save | **3–5 per unit** |

**Biggest flow friction:** the scan loop (UX-H5) — ~3–5 taps/unit, not an arm→decode→commit auto-loop. For a lot of N this is ~3N unnecessary taps.

### Rental mode
1. New agreement → CustomerPicker → scan/Add unit(s) → days → Check out (**~7–9 taps**).
2. Return: Process return → per-unit grade + charge + notes (**~5–6 taps/unit**) → **commits without a refund preview (UX-C3 — Critical)**.

### Expenses / Customers / Admin picklists
- Record expense: **4 taps** (Record → amount/category/purpose → submit). Edit amount disabled after record (good).
- Create customer + consent: **4–5 taps**.
- Admin picklist item: **5 taps** (navigate → tab → Add → form → submit). Reasonable.

### Login → role landing
- Sign-in → **lands on `/` which shows "Nothing here yet"** (UX-C1 — Critical). Should auto-redirect to first permitted screen.

---

## UI workflow improvements (prioritised)

> **Sequencing principle (guardian):** accessibility first, then library consolidations, then token drift in churn-heavy files; never a big-bang rewrite. All work below is incremental.

1. **P0 — Post-login landing (UX-C1).** Auto-redirect signed-in users from `/` to their first permitted screen. Small, high impact, unblocks muscle-memory landing.
2. **P0 — Rental refund preview (UX-C3).** Show live refund/late/damage total before "Process return". Financial transparency on a till.
3. **P0 — POS total + money typography (UX-C2, UX-H2).** Apply `.typography-money*` + right-alignment through POS/receipts; make the total dominant.
4. **P1 — 44px touch floor (UX-H1).** Fix at the `Button` primitive (`sm`/`md` ≥44px) then sweep chips/rows. One library change fixes dozens of screens.
5. **P1 — Scan-loop cadence (UX-H5).** Auto re-arm + auto-commit repeat loop; save ~3 taps/unit on intake.
6. **P1 — Adopt `Table` for inventory lists (UX-H3, UX-M3).** Sticky header, frozen identity col, right-aligned money. Biggest inventory-archetype win.
7. **P1 — Colour-alone statuses (UX-H4).** Add icon/text to every variance/complete indicator.
8. **P2 — Bare-button/primitives (UX-H6, UX-M4, UX-M7).** Add `NavItem`/`Tab`/`ToggleGroup` primitive; migrate deletion dialogs off `window.confirm` to `Dialog`.
9. **P2 — Raw-hex token cleanup (UX-M2).** Swap the 3 `rgba(...)` leaks to `var(--danger)/10`.
10. **P2 — Loading/empty/error standardisation (UX-M6).** Match the skeleton pattern across Expenses; standardise empty/error states with Retry on the inventory pattern in`VendorDetail.jsx:138-141`.
11. **P2 — POS feedback (UX-H7, UX-M5).** Barcode-lookup loading, picklist-fetch failure surfacing, sticky "New transaction" on receipt.

---

## Positive findings (no action needed)
- **Token layer is clean and single-source-of-truth:** `index.css` merges Tailwind v4 `@theme` + semantic custom-property tokens; theming is token-redefinition not component conditionals; `themeRuntime.test.jsx` locks runtime re-skin.
- **POS has no spurious confirmations** on non-destructive/regular Pay flow — matches "confirm only destructive/financial".
- **Colour-always-with-text on status Badges** across admin/rentals/customers (the exceptions are UX-H4/UX-H8 in inventory/rentals).
- **Permission gating** is thorough and absent-not-disabled across all screens.
- **Loading/empty/error states are largely designed** (skeletons, `role="alert"` banners, empty copy) — the main gaps are UX-M6/UX-M9/UX-L3.
- **`ui/Select` is the single standard dropdown** (cmdk combobox) — no native `<select>` left.

---

*End of report. Findings are uncommitted (as with R-23 pattern) pending human review; no code changed.*
